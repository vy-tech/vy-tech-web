# H019 — Port to vy-tech-web/summarizer.js

Working spec for porting the H019 per-track state-space filter from the Python
implementation in `vy_score.py` to the production scoring path in
`vy-tech-web/src/scoring/`. Hand this document to the agent doing the JS work.

## Context

H019 is pre-registered at [docs/hypotheses/H019-state-filter-scoring-layer.md](hypotheses/H019-state-filter-scoring-layer.md). It introduces a per-(track, emotion) 2nd-order critically-damped state-space filter, slotted as a *transform layer* between detection loading and scoring. The filter rewrites `emotions[*].score` in place; scoring code is unchanged.

What's already landed in Python:

- [vy_tracker.py](../vy_tracker.py) — `Tracker` class. Assigns stable `person` IDs to detection rows that lack them (API expressions) via greedy bbox-IoU per consecutive-frame pair. When detections already carry `person` (local ves output), it passes through and optionally re-maps IDs across chunks via FaceNet centroid cosine similarity.
- [vy_filter.py](../vy_filter.py) — `StateFilter` class. 2nd-order critically-damped ODE per `(track, emotion)`, integrated with the **exact closed-form step** (Euler was tried first and overshot on real data; exact step is unconditionally stable for any `dt` and keeps state within the convex hull of measurements). Two modes: `forward` (production-deployable, causal) and `forward_backward` (offline smoother — forward pass + backward pass averaged per detection).
- [vy_score.py](../vy_score.py) — CLI integration. `--filter on|off`, `--filter-tau FLOAT` (uniform), `--filter-tau-config PATH` (per-emotion JSON), `--filter-mode forward|forward_backward`. Filter is called between detection load and scoring; no changes to scoring functions.

What this doc covers: the JS port. The data flow you're implementing is

    pipeline output (per-chunk) → Tracker → StateFilter → existing summarizer logic

inside `vy-tech-web/src/scoring/` such that the production UI sees filtered detection scores. Scoring code on the JS side stays agnostic to whether the filter ran.

## Measured behavior (for context)

The Python filter has been measured on the H017 4-probe archive at four global τ values, plus a per-emotion configuration. Headline findings (full details in the H019 doc):

- **P4 (within-track stdev reduction)**: strong pass. Local Boredom L/A ratio 2.15× → 1.09× of API (well under 1.5× pre-reg threshold). Every emotion improves 29–55%. This is the user-visible win — the "red↔green flicker" problem H018 noted on the per-track heatmap.
- **P1/P2 (engagement-summary Pearson r)**: pre-reg thresholds fail at every global τ ∈ {0.5, 1.0, 2.0, 3.0}. Per-emotion τ recovers RBI 9-0 to baseline but leaves RBI 1-0 regressed. **Important caveat**: Pearson r is sensitive to small phase shifts the filter introduces; the user's read on the score plots is that alignment is "within human observable tolerances" even where r drops, and the per-track stability win likely dominates the UX. **The JS port is happening because the UI is where we need to evaluate this trade-off, not the headline-metric falsification.**

The per-emotion τ knob lets us give drift-prone emotions (Boredom / Concentration / Confusion) a long τ while keeping fast-onset ones (Horror / Fear / Surprise) near-identity. Recommended starting config (mirrored verbatim from the Python testing): see [Configuration](#configuration) below.

## Architecture

Same shape as the Python:

```
detections ───→ Tracker.assign() ───→ StateFilter.apply() ───→ existing scoring
   (per chunk)                                                  (unchanged)
```

Each is a **stateful object instantiated per scoring run / per event**. State carries across chunks so that:

- Tracker can re-map this chunk's track IDs to last chunk's track IDs via signatures (when present)
- StateFilter's per-(track, emotion) state continues across chunk boundaries, dissolving the chunk-edge initialization transient

In `vy-tech-web/src/scoring/scoring.js`, the natural insertion point is **between `loadDetections(url)` and `applyProfileToRows(rows, ...)`** inside `loadExpressions(url, timeOffset)` at scoring.js:224-235.

Current code (scoring.js:224-235):
```javascript
async loadExpressions(url, timeOffset = 0.0) {
    var rows = await this.loadDetections(url);
    this.applyProfileToRows(rows, profilesData.profile, timeOffset);
    return rows;
}
```

Post-port:
```javascript
async loadExpressions(url, timeOffset = 0.0) {
    var rows = await this.loadDetections(url);

    // H019 transform layer. Tracker assigns `person` IDs if absent;
    // StateFilter rewrites emotions[].score in place. Both are stateful
    // across chunks within a single Score / Summarizer instance.
    if (this.filterEnabled) {
        this.tracker.assign(rows, /* chunkSignatures */ null);
        this.stateFilter.apply(rows);
    }

    this.applyProfileToRows(rows, profilesData.profile, timeOffset);
    return rows;
}
```

Tracker and StateFilter are instance fields on the `Score` class (scoring.js:94), constructed in its constructor or reset by `resetWindow()` / `rewindWindow()` so a fresh scoring run starts with clean state.

`Summarizer` (summarizer.js:10) gets the filter for free through its `Score` instance — no changes needed there as long as `Score` owns the filter.

## Algorithm: Tracker

For each call to `assign(rows, chunkSignatures)`:

1. **If every row already has a numeric `person` field** (this is the local pipeline path — ves writes it), skip to step 3 and treat the existing IDs as authoritative. The current production JS path receives API data which has no `person`, so step 2 is the operative case for v1.

2. **Bbox-IoU greedy matching within the chunk** (when `person` is absent):
   - Group rows by `frame` (integer frame index).
   - Maintain `active = Map<trackId, {lastTime, lastBox}>` across frames.
   - For each frame's rows in time-ascending order, against the active tracks whose `lastTime` is within `timeGapS` of the current row's `time`:
     - Compute IoU between every (row.box, active.lastBox) pair.
     - Greedy-match the highest IoU pair ≥ `iouThreshold`, mark both used, repeat until no remaining pair clears the threshold.
     - Unmatched rows get a fresh track ID from the Tracker's monotonic counter.
   - Update `active` with the matched rows' (time, box) and prune entries whose `lastTime` is older than `timeGapS` from the current frame's time.
   - Write the assigned ID into `row.person`.

   IoU formula on `{x, y, w, h}` boxes:
   ```javascript
   function bboxIoU(a, b) {
       if (!a || !b) return 0;
       const ix1 = Math.max(a.x, b.x);
       const iy1 = Math.max(a.y, b.y);
       const ix2 = Math.min(a.x + a.w, b.x + b.w);
       const iy2 = Math.min(a.y + a.h, b.y + b.h);
       const iw = Math.max(0, ix2 - ix1);
       const ih = Math.max(0, iy2 - iy1);
       const inter = iw * ih;
       if (inter <= 0) return 0;
       const union = a.w * a.h + b.w * b.h - inter;
       return union > 0 ? inter / union : 0;
   }
   ```

3. **Cross-chunk re-id via signatures** (optional; both `chunkSignatures` and the Tracker's `priorSignatures` must be present):
   - Each chunk's signatures live in a top-level `tracks[]` field on the ves output (one entry per track, containing `track_id`, `signature.fingerprint`, and optionally `signature.centroid_b64`).
   - Decode each centroid (see [Signature decode](#signature-decode-base64-int8) below) → L2-normalized Float32Array of length 512.
   - Compute the cosine-similarity matrix between this chunk's track centroids and the prior chunk's track centroids (the Tracker stashed those from the previous `assign()` call).
   - **Mutual-best match** (A's best B must also pick A as its best) above `signatureThreshold = 0.7`. For each matched pair, rewrite this chunk's detections' `row.person` to the prior chunk's track ID.

   This is currently dead code in the v1 JS port if signatures aren't loaded from the local pipeline. The full plumbing matters once ves output also flows through the JS side — for v1 on API data, signatures are simply absent and step 3 is a no-op.

**Tracker defaults**: `iouThreshold = 0.3`, `timeGapS = 0.5`, `signatureThreshold = 0.7`. Mirror the Python defaults exactly.

## Algorithm: StateFilter

For each detection in walk-order per track (ascending `time` for forward pass, descending for backward), per emotion:

```
dt          = |t − t_last_for_this_track|
innovation  = measurement − state                  // Kalman residual / Newton displacement
tau         = perEmotionTau(emotion.name)          // see Configuration below
omega       = 1 / tau

// Exact closed-form step of the critical-damped 2nd-order ODE under a constant
// measurement target over [0, dt]:
//   ÿ + 2ω·ẏ + ω²·y = 0       where y = state − measurement
// Solution: y(t) = (A + B·t)·exp(−ω·t),  A = y₀,  B = v₀ + ω·y₀

y0    = state − measurement
b     = v + omega * y0
decay = exp(−omega * dt)
y1    = (y0 + b * dt) * decay
v_new = decay * (v * (1 − omega * dt) − omega² * y0 * dt)
s_new = measurement + y1
```

Then write `emotion.score = s_new` and persist `(s_new, v_new, t)` as the new state for `(trackId, emotionName)`.

**First-sight initialization** (state has never been touched for this `(trackId, emotionName)`): set `s = measurement, v = 0, t_last = t`. The first frame writes through unchanged — no cold-start transient.

**Newton vocabulary on the LHS / Kalman commentary**: think of the state as a bead with mass 1 on a 1-D rail. Each measurement is a target point that exerts a spring force on the bead, and a damper proportional to velocity prevents oscillation. Critical damping (ζ=1.0) is the fastest stable response with no overshoot.

**Critical damping is fixed**. `zeta = 1.0` is the only damping choice in v1. The lone tuning knob is `tau` (and now `tau` is per-emotion). A future H020 / H021 may promote to a true Kalman with per-detection R; v1 doesn't.

**Forward vs forward_backward** (mode):
- `forward`: causal, single pass over each track in time-ascending order. **This is the production-deployable mode.** Streaming clients run this.
- `forward_backward`: forward pass, snapshot the per-detection filtered scores, reset state, run the same filter on each track in time-descending order, snapshot again, write `(forwardScore + backwardScore) / 2` as the final score per detection. **Offline only** — requires the full event timeline. v1 of the JS port should implement `forward` and leave `forward_backward` for a follow-up if there's demand for offline summary regeneration with smoothing.

**Reverse-time correctness** (for `forward_backward`): walk each track in *descending* time order, computing `dt = |t − t_last|`. The dynamics are time-symmetric for critical damping, so the same update rule works. The state map must be reset between the two passes.

## Configuration

The per-emotion τ config is a flat JSON object. Special key `default` is the τ for any emotion not explicitly listed. Used by both Python and JS:

```json
{
  "Joy": 0.3,
  "Amusement": 0.3,
  "Excitement": 0.3,
  "Triumph": 0.3,
  "Surprise (positive)": 0.3,
  "Adoration": 0.3,
  "Love": 0.3,
  "Awe": 0.3,
  "Realization": 0.3,
  "Interest": 0.3,
  "Admiration": 0.3,
  "Horror": 0.3,
  "Fear": 0.3,
  "Surprise (negative)": 0.3,
  "Distress": 0.3,
  "Pain": 0.3,
  "Empathic Pain": 0.3,
  "Boredom": 3.0,
  "Concentration": 3.0,
  "Confusion": 3.0,
  "default": 1.0
}
```

**Why these values** (so the agent has the model in their head, not magic numbers):

- **Fast τ ≈ 0.3 s for already-stable and fast-onset emotions** (Joy, Amusement, Excitement, the Surprise family, Horror / Fear for the safety profile). These either don't need smoothing or *must not* be smoothed because their value to the product is in their sharp onset. τ=0.3 s with the ~3 fps detection cadence makes the filter essentially identity.
- **Long τ = 3.0 s for the three drift-prone emotions** the model over-fires on (Boredom, Concentration, Confusion). These are where P4's win comes from — the model's belief drifts slowly and the filter integrates over a long window to suppress it.
- **default τ = 1.0 s** for everything else (40-emotion scope minus the two groups). Moderate smoothing.

The tau-loading interface should accept either a number (uniform) or a config object (per-emotion with `default`). The Python `StateFilter` constructor accepts both shapes; mirror that in JS.

Where the config comes from in JS is a product decision — could be:

- Hard-coded as a JS module export (`scoring/filterConfig.js`) for v1.
- Loaded from a JSON file in the deployment (alongside `profile.json` which the UI already serves).
- Editable in the dev tools / settings panel.

The Python side uses option 2 (`--filter-tau-config /path/to.json`). For parity / shared tuning, the JS side should at minimum load from a JSON URL.

## Data shapes

### Row (input/output to the filter)

```typescript
type Row = {
  frame:    number,
  time?:    number,        // seconds within source video; computed by applyProfileToRows
                            //   if absent. Filter requires this — call after time
                            //   is populated OR populate it itself.
  fps?:     number,
  box:      { x: number, y: number, w: number, h: number },
  person?:  number,        // present on local ves output, absent on Hume API
  emotions: Array<{
    name:       string,
    score:      number,    // filter rewrites this in place
    confidence: number     // unchanged
  }>
};
```

**Critical**: the filter needs `time`. In current JS code, `row.time` is computed inside `applyProfileToRows` (scoring.js:196). The filter must run *after* `time` is set, OR the filter call site must compute `time` first.

Cleanest fix: compute `time` in `loadDetections` (or in a small helper called immediately after) so it's present before the filter runs. Then `applyProfileToRows` can be simplified to not recompute it. The Python side has `time` on every row from disk, so this is a JS-only concern.

### Signature (input to Tracker for cross-chunk re-id; v1 may skip)

Top-level `tracks[]` on a ves results.json (not present on Hume API output):

```typescript
type TrackSignature = {
  track_id: number,
  n_detections: number,
  first_frame: number, last_frame: number,
  first_timestamp_sec: number, last_timestamp_sec: number,
  first_bbox: BBox | null, last_bbox: BBox | null,
  signature: {
    embedding_dim: number,        // 512 for FaceNet
    fingerprint: string,          // 128 hex chars, sign-bit hash of the centroid
    centroid_b64?: string         // base64-encoded int8 centroid; optional
  } | null
};
```

### Signature decode (base64 int8)

The centroid is encoded as int8 (one byte per dimension) scaled by 127 and base64-wrapped. Decode in JS:

```javascript
function decodeSignatureCentroid(b64) {
    const raw = atob(b64);
    const buf = new Int8Array(raw.length);
    for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i) << 24 >> 24;
    const v = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) v[i] = buf[i] / 127.0;
    // L2-renormalize.
    let n = 0;
    for (let i = 0; i < v.length; i++) n += v[i] * v[i];
    n = Math.sqrt(n);
    if (n < 1e-8) return v;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
}
```

(int8 sign-extend: `raw.charCodeAt(i)` gives 0..255; the shift trick maps high bytes to negative.)

Then cosine similarity is just the dot product (both sides are unit-normalized):
```javascript
function cosineSim(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
}
```

## Testing

Mirror the Python self-tests in JS:

1. **Constant input → constant output.** Feed a single track of 30 detections all with one emotion at score=0.5; filter (τ=3) should preserve every score within 1e-9.
2. **Step input → critical-damped ramp.**  5 detections at 0.0 then 60 at 1.0, single track, τ=3. Pre-step state stays 0; post-step state rises monotonically to ~1; no value exceeds 1.0+ε (no overshoot).
3. **Single-frame impulse → small bounded deflection.** State barely rises, then decays back toward zero.
4. **Two tracks don't contaminate.** Two interleaved tracks with constant scores (track 0 at 1.0, track 1 at 0.0) keep their values exactly.
5. **Per-emotion τ.** Same step input on Joy (τ=0.3) and Boredom (τ=3.0), same track: Joy settles faster than Boredom by at least 0.2 at idx 8 after the step.

These match `vy_filter.py:_self_test()` in the Python implementation; replicate the test cases verbatim where possible.

Plus a **cross-implementation check**: pick one chunk from the H019 example set (e.g., `exampleset/api/01/expressions_0110.json`) and verify that running it through the JS filter + JS scorer produces bucket scores that match the Python filter + Python scorer to within ~1e-6 (any divergence is a porting bug). Reference Python output is at `exampleset/api_scores_filtered/01/summary.json`.

## Open questions for the JS implementer

- **Where does the filter config live?** Hard-coded module / JSON file at known URL / editable in settings? Product decision.
- **Should the filter be a feature flag in v1?** Recommended yes — `Score.constructor` reads a `filterEnabled` flag, defaulting to false, so the filter ships behind a toggle for A/B comparison in the UI.
- **Should the UI ever expose the raw scores?** If yes (e.g., for the per-track heatmap to show "model says X" while the engagement summary uses smoothed values), then the JS port needs to preserve the raw score in a separate field rather than rewriting in place. Python's current behavior is rewrite-in-place; this is correctable if needed.
- **Logging / telemetry.** The Python `vy_score.py` prints a one-line summary of the filter config to stderr. The JS port should at least `console.log` the loaded τ config once so we can verify configuration in deployment.

## Files to reference

| What | Python source |
|---|---|
| Tracker | [vy_tracker.py](../vy_tracker.py) |
| StateFilter | [vy_filter.py](../vy_filter.py) |
| CLI integration | [vy_score.py](../vy_score.py) (search for `--filter`) |
| Hypothesis | [docs/hypotheses/H019-state-filter-scoring-layer.md](hypotheses/H019-state-filter-scoring-layer.md) |
| Sample per-emotion config | inline above (or `/tmp/h019_tau_per_emotion.json` if still on disk) |
| Reference scoring output | [exampleset/api_scores_filtered/01..10/summary.json](../exampleset/api_scores_filtered/), [exampleset/local_scores_filtered/01..10/summary.json](../exampleset/local_scores_filtered/) |

## Out of scope

- `forward_backward` mode. Implement only `forward` in v1; the smoother is offline-only and can land as a follow-up if the UI surfaces an "offline summary regeneration" feature.
- Per-detection R / true Kalman gain. v1 uses fixed critical damping; only τ varies.
- Filter as a quality-weighting signal (Kalman variance → softmax weight). Future hypothesis.
- Cross-chunk signature re-id when ves output flows through the JS side. v1 implements the bbox-IoU per-chunk tracker; the signature decode + cosine matching code is documented here for the eventual upgrade.

## Acceptance

- Self-tests #1–5 above pass on `npm test` (or equivalent).
- Cross-implementation check: bucket scores from JS filter + JS scorer match Python filter + Python scorer to ~1e-6 on the verification chunk.
- Feature flag works in the UI: toggling the filter on/off rebuilds the summary and visibly changes the per-track heatmap stability (the "red↔green flicker" should disappear when filter is on).
- Adding this doc to vy-tech-web's `HISTORY.md` with a dated entry per `vy-tech-web/CLAUDE.md`'s change-history rule.
