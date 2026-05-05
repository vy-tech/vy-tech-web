# H017 smoothing port — implementation handoff

This document describes how to add post-bucket and live-UI score smoothing to the Vy scoring stack. It is a port of work validated in the sibling `model-improvment` repo (hypothesis H017, closed 2026-04-28).

## Background

The H017 hypothesis bench (4 critical-event probes, API-vs-local Pearson r over 180-bucket 3-minute summaries) found that **per-bucket noise** — not residual model magnitude — was the dominant correlation killer between the Vy API summary and a locally-rescored summary. A causal rolling mean over 10 buckets recovered ~67% of the lost correlation (mean r 0.305 → 0.508 across the 4 samples), with no model change.

The H017 doc (`docs/hypotheses/H017-vy-score-smoothing.md` in the `model-improvment` repo) explicitly recommends porting the validated transform into `summarizer.js`. While porting, it makes sense to also add a complementary smoothing pass in `scoring.js` for the live UI dial, so viewers see a calmed-down number that's consistent with what the dashboard summary shows. **The two passes are mathematically distinct and need separate knobs** — see "Why two passes" below.

## What was validated

H017 ran a single transform: a causal rolling mean (window = 10 buckets = 10 seconds) applied to the **bucket score field** _after_ the summarizer's max-magnitude aggregation. Result on the 4-sample probe:

| Sample     | r raw    | r causal w=10 |
| ---------- | -------- | ------------- |
| RBI 9-0    | 0.58     | 0.74          |
| RBI 1-0    | 0.29     | 0.44          |
| Earthquake | 0.12     | 0.33          |
| Light pole | 0.23     | 0.53          |
| **mean**   | **0.30** | **0.508**     |

`count` and `maxScore` pass through unchanged; only the `score` field is smoothed.

The Python reference implementation lives at `vy_score.py:smooth_summary` in the `model-improvment` repo. Reproduced here for convenience:

```python
def smooth_summary(results, window, mode):
    """Apply post-bucket rolling-mean smoothing to the `score` field of each
    summary entry. `count` and `maxScore` pass through unchanged."""
    if window <= 1 or mode == "none":
        return results
    n = len(results)
    smoothed = [dict(r) for r in results]
    for i in range(n):
        if mode == "centered":
            half = window // 2
            lo = max(0, i - half)
            hi = min(n, i + half + 1)
        elif mode == "causal":
            lo = max(0, i - window + 1)
            hi = i + 1
        else:
            raise ValueError(f"unknown smooth-mode: {mode}")
        scores = [results[j]["score"] for j in range(lo, hi)]
        smoothed[i]["score"] = sum(scores) / len(scores)
    return smoothed
```

## Why two passes (not just one)

It's tempting to put smoothing only in `scoring.js` (smooth `currentScore` per tick) and let it flow through to the summarizer "for free." That changes the math:

- **H017-validated path** (max-then-smooth): per-second bucket score = max(|currentScore|) over the 4 ticks in that second; then rolling mean over 10 such buckets.
- **Smoothing currentScore in scoring.js only** (smooth-then-max): each tick's `currentScore` is a rolling mean of the past ~40 ticks; bucket then takes max of 4 already-smoothed values. Peaks are diluted _before_ max selection, so bucket scores are systematically lower than H017's validated path.

The two are not equivalent and the second is **untested**. For a production rollout that we can stand behind with the H017 numbers, keep the validated bucket-level smoothing on the summarizer side, and add a separate, independently-configurable per-tick smoothing for the live UI dial.

## Implementation

### Part A — `src/scoring/summarizer.js` (faithful H017 port)

This is the load-bearing change. It mirrors `vy_score.py:smooth_summary` and operates on the per-second bucket array immediately before the summarizer returns it.

**Add to the `Summarizer` constructor:**

```js
// H017: post-bucket rolling-mean smoothing on the `score` field.
// Defaults match the H017 production recommendation: causal w=10.
// Set smoothWindow <= 1 or smoothMode = "none" to disable.
this.smoothWindow = 10;
this.smoothMode = "causal"; // "causal" | "centered" | "none"
```

**Add a method on `Summarizer`:**

```js
smoothSummary(results) {
    const window = this.smoothWindow;
    const mode = this.smoothMode;
    if (window <= 1 || mode === "none") return results;

    const n = results.length;
    // Snapshot the original scores so each smoothed value is computed
    // from raw inputs, not from previously-smoothed neighbors.
    const raw = results.map((r) => r.score);

    for (let i = 0; i < n; i++) {
        let lo, hi;
        if (mode === "centered") {
            const half = Math.floor(window / 2);
            lo = Math.max(0, i - half);
            hi = Math.min(n, i + half + 1);
        } else if (mode === "causal") {
            lo = Math.max(0, i - window + 1);
            hi = i + 1;
        } else {
            console.error(`Unknown smoothMode: ${mode}; smoothing skipped`);
            return results;
        }
        let sum = 0;
        for (let j = lo; j < hi; j++) sum += raw[j];
        results[i].score = sum / (hi - lo);
    }
    return results;
}
```

**Wire it into `Summarizer.create()`** — apply _after_ the existing `score.score = score.maxScore` averaging loop and _before_ `return Object.values(scores)`. The current summarizer ends like this (around `summarizer.js:99-110`):

```js
// Compute averages and format times
for (const second in scores) {
    const score = scores[second];
    score.score = score.maxScore; //Math.round(score.score / score.count);
    score.people = Math.round(score.people / score.count);
    score.startTime = score.startTime.toFixed(2);
    score.endTime = score.endTime.toFixed(2);
}

closed.val = true;

return Object.values(scores);
```

Change the tail to:

```js
// Compute averages and format times
for (const second in scores) {
    const score = scores[second];
    score.score = score.maxScore;
    score.people = Math.round(score.people / score.count);
    score.startTime = score.startTime.toFixed(2);
    score.endTime = score.endTime.toFixed(2);
}

// H017: post-bucket smoothing pass. `count` and `maxScore` pass
// through unchanged; only `score` is smoothed.
const result = this.smoothSummary(Object.values(scores));

closed.val = true;
return result;
```

**Invariants to preserve:**

- `count`, `maxScore`, `people`, `startTime`, `endTime` are untouched by smoothing.
- With `smoothWindow <= 1` or `smoothMode === "none"`, `create()` is byte-identical to the pre-change behavior.
- Bucket order is unchanged; smoothing operates on the array as-returned by `Object.values(scores)` (insertion order, which by JS spec is integer-key ascending — matches the second-by-second sort H017 assumed).
- Smoothed values are computed from the raw input snapshot (`raw[]`), not from already-smoothed neighbors. This matches the Python reference, which uses `[results[j]["score"] for j in ...]` against the unmodified input list.

### Part B — `src/scoring/scoring.js` (live-UI smoothing, new)

This pass smooths `currentScore` for the live dial so viewers don't see a noisy ±200 jitter. It is **not** the H017 transform and has no validated correlation number behind it; it's a UX change.

**Add to the `Score` constructor (in the "New Recipe" block around line 126-134):**

```js
// Live-UI smoothing: causal rolling mean over the last N currentScore values.
// Independent of the summarizer's bucket-level smoothing (H017).
// At 0.25s ticks, liveSmoothWindow=40 ≈ 10 seconds of lookback.
// Set liveSmoothWindow <= 1 to disable.
this.liveSmoothWindow = 40;
this.liveSmoothBuffer = [];
```

**Add a smoothing pass at the end of `updateCurrentFromWindow()`** — after `this.currentScore = this.combineScores(scores)` and `this.applyVolatilities()`, but before `activeBoxManager.update(...)` (so the dial reads the smoothed value):

```js
// Live-UI causal smoothing of currentScore. Buffer the raw post-volatility
// score, then replace currentScore with the rolling mean.
if (this.liveSmoothWindow > 1) {
    this.liveSmoothBuffer.push(this.currentScore);
    if (this.liveSmoothBuffer.length > this.liveSmoothWindow) {
        this.liveSmoothBuffer.shift();
    }
    let sum = 0;
    for (const v of this.liveSmoothBuffer) sum += v;
    this.currentScore = sum / this.liveSmoothBuffer.length;
}
```

**Reset the buffer in `handleTimeSeek()`** (around `scoring.js:551`) and `resetWindow()` (around line 489) so the live dial doesn't carry stale state across seeks:

```js
this.liveSmoothBuffer = [];
```

**Important caveat about the summarizer interaction:** the summarizer reads `scoring.currentScore` per tick to populate `maxScore`. With this change, `currentScore` is the smoothed value, so the summarizer's bucket `maxScore` will also be smoothed-then-maxed (the path H017 explicitly did _not_ validate). This is fine for two reasons:

1. The bucket `score` field then gets the H017-validated max-then-smooth pass on top via `Summarizer.smoothSummary`. The dashboard r-metric is computed against `score`, not `maxScore`.
2. If `liveSmoothWindow=40` and `Summarizer.smoothWindow=10` are both active, the final `score` field is essentially smoothed twice (once at tick scale, once at bucket scale). This will be slightly more attenuated than H017's pure max-then-smooth result. If the bench rerun (see Validation) shows the double-smoothing degrades correlation, the fix is to either (a) lower `Summarizer.smoothWindow` toward 5, or (b) gate the live smoothing so the summarizer-create path uses raw `currentScore` while the playback path uses smoothed.

Option (b) — recommended if the bench shows a regression — adds a `liveSmoothEnabled` flag on `Score`:

```js
// In Score constructor:
this.liveSmoothEnabled = true;

// Wrap the smoothing block in updateCurrentFromWindow():
if (this.liveSmoothEnabled && this.liveSmoothWindow > 1) {
    // ... rolling mean as above
}
```

Then in `Summarizer.create()`, before the fragment loop, disable it for the offline pass:

```js
const prevLiveSmooth = scoring.liveSmoothEnabled;
scoring.liveSmoothEnabled = false;
try {
    // ... existing fragment-walk loop ...
} finally {
    scoring.liveSmoothEnabled = prevLiveSmooth;
}
```

This keeps the summarizer on the H017-validated math while the live UI gets its smoothed dial. Start without the flag (simpler); add it if the bench rerun shows correlation regress.

## Validation

After implementing, validate against H017's expectations:

1. **No-op check**: with `smoothWindow=0` (or `mode="none"`) and `liveSmoothWindow=0`, summary output must be byte-identical to the current production output for at least one known sample. This catches accidental changes to the non-smoothing path.

2. **H017 bench rerun** (optional but recommended): export a fresh summary for the 4 critical-event samples used in H017 (`raimondi:20250711:02` RBI 9-0, `raimondi:20250727:01` RBI 1-0, `raimondi:20250905:01` Earthquake, `raimondi:20250905:02` Light pole) with `smoothWindow=10, smoothMode="causal", liveSmoothWindow=0`. Compare to the API summary using Pearson r over the 180 buckets covering the critical 3-minute window. Expected mean r ≈ 0.508 (matches H017 Python bench within FP tolerance).

3. **Double-smoothing check** (only if implementing Part B without the `liveSmoothEnabled` gate): rerun the same bench with `liveSmoothWindow=40, smoothWindow=10` and confirm mean r is within ~0.05 of the Part-A-only run. If it drops more than that, add the `liveSmoothEnabled` gate (described above).

The 4 sample summaries and the Python bench script live at `dev_data/_critical_probe/` in the `model-improvment` repo.

## Defaults summary

| Knob                | Where        | Default                              | Purpose                                                                               |
| ------------------- | ------------ | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `smoothWindow`      | `Summarizer` | `10`                                 | Bucket-level smoothing width (seconds). H017 sweet spot.                              |
| `smoothMode`        | `Summarizer` | `"causal"`                           | H017 found causal ≥ centered on the 4-sample probe; production-deployable either way. |
| `liveSmoothWindow`  | `Score`      | `40`                                 | Per-tick smoothing for the live UI dial; 40 × 0.25s ≈ 10s lookback.                   |
| `liveSmoothEnabled` | `Score`      | (omit unless bench shows regression) | Disables per-tick smoothing during summarizer rebuild so the H017 math is preserved.  |

Setting any window to `0` or `1` disables that pass; production behavior should be a strict superset of the pre-change behavior when both are disabled.

## References

- `vy_score.py:smooth_summary` (model-improvment repo) — the validated Python reference.
- `docs/hypotheses/H017-vy-score-smoothing.md` (model-improvment repo) — full hypothesis writeup, predictions, and result table.
- `dev_data/_critical_probe/` (model-improvment repo) — archived probe samples and bench script (`run_h017.py`).
