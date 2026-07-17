# Pipeline bug: `silhouette` is not associated with the row it ships in

**Status: FIXED 2026-07-16 in the processing pipeline.** Kept for the diagnosis
and for the acceptance tests, which are worth re-running whenever the
segmentation or detection stages change — the failure was silent (well-formed
outlines, plausible-looking output) and only geometry caught it.

**Found:** 2026-07-16, while building the x001 Synthetic View in `vy-tech-web`.
**Sample:** `https://s.vy.vision/play/vy/video/coke/expressions-vy-video-coke-0146.json`
(hierarchy `vy:video:coke`, chunk 0146, public — `curl` it directly)

## Resolution

Root cause: outlines were only being produced for people who needed neighbor
removal, and were then attached to rows that hadn't asked for them. The pipeline
now produces them for everyone and binds them to the right detection.

Both acceptance tests below pass on re-processed data, and the fix landed
alongside several other improvements:

| measure | before | after |
|---|---|---|
| face inside its own silhouette | 24.8% | **99.7%** |
| silhouette movement/frame, same track | 947.5px | **17.3px** |
| `person` teleports >200px between frames | 14.1% | **0.0%** |
| people detected per frame | 42 | **70** |
| `silhouette` coverage | 99.7% (but wrong) | **67.6%** (correct) |

Also added by the pipeline in the same pass: `person_box` (94.1% coverage, the
body bbox this doc noted was missing), `face_confidence`, `frame_idx`, a
top-level `tracks[]` array carrying per-track 512-dim re-id signatures, and an
(empty) `frame_data`.

Notes for whoever picks this up next:

- **`person_box` is noisy** — p90 movement 179px/frame vs the face box's 13.6px,
  jumping >200px on 8.3% of frames. Good for geometry and hit-testing, not for
  identity. The face box remains the most stable anchor.
- **`pose.track_id` is a worse anchor than `person`** (10.8% teleport rate).
- **The `tracks[]` signatures are weakly separated.** 41% of *different-person*
  pairs within one chunk exceed the 0.7 cosine threshold `tracker.js` uses.
  Across a chunk boundary, mutual-best gives 57% recall at 84.6% precision.
  Plain geometry beats it outright on this static camera — 78% recall, 4.9px
  median match distance — so `vy-tech-web` matches across chunks geometrically
  and does not consume the signatures. They'd need to be more discriminative to
  be worth wiring up.
- **`capabilities` is still absent** from the JSON, so the web app's Synthetic
  toggle still relies on a hardcoded `vy:video:coke` override.

Everything below is the original report, unchanged.

---

## TL;DR

Each expressions row contains a face detection (`box`, `emotion`, `emotions`) and a
32-point body outline (`silhouette`). **They are different people.** The face and the
silhouette in the same row are not the same human, and the mismatch re-rolls every
frame. Face tracking is fine; the silhouette payload is effectively randomised.

Any consumer that draws `silhouette` and colours it using that row's `emotion` is
drawing person A's body tinted by person B's emotion.

## What the data looks like

Top level is `{video, results}`. `video` carries `width: 3840`, `height: 2160`,
`fps: 19.98`, `extraction_fps: 3`. One `results` row per detected face per extracted
frame:

```json
{
  "frame": 0, "time": 0.0, "person": 0,
  "image": "data/output/faces/frame_000000_person_00_face.jpg",
  "box": { "x": 3486, "y": 1171, "w": 118, "h": 118 },
  "emotion": "Sadness",
  "emotions": [ { "name": "Sadness", "confidence": 0.6437, "score": 0.6437 }, ... ],
  "silhouette": [3521, 1105, 3492, 1126, ...],
  "pose": null
}
```

For chunk 0146: 7584 rows, 180 frames (3fps over 60s), 21–60 people per frame
(mean 42).

| field | meaning | coverage |
|---|---|---|
| `box` | **face** bounding box, source-pixel space. Mean 67px wide. The `image` path (`.../faces/..._face.jpg`) confirms it is a face crop. | 7584/7584 |
| `silhouette` | flat `[x0,y0,x1,y1,...]`, 64 numbers = 32 points, source-pixel space. Head-and-shoulders outline. Mean extent 175×274px. | 7564/7584 |
| `person` | track id. Max id 168, 169 distinct over the chunk. Not a per-frame index (ids exceed max people/frame; id 0 appears in 127/180 frames). | 7584/7584 |
| `pose` | present-as-key on every row, non-null on 4237 | 4237/7584 |

There is **no person/body bounding box** in the output. `silhouette`'s polygon extent
is currently the only source of person geometry.

Note: `person` is not the `person_NN` slot in the `image` filename — they disagree on
7498/7584 rows. The filename slot appears to be the raw detection index; `person` is
an assigned track.

## The evidence

### 1. Faces do not fall inside their own silhouette

A head-and-shoulders outline (mean 175×274px) must contain its own face (mean 67px).
Testing each row's face centre against its own row's silhouette **bbox** (a generous
test — the bbox is a superset of the polygon):

| result | rows | share |
|---|---|---|
| face is inside **its own** row's silhouette | 1875 | **24.8%** |
| face is inside a **different** row's silhouette | 2038 | 26.9% |
| face is inside **no** silhouette in that frame | 3651 | 48.3% |

### 2. The track follows the face but not the silhouette

This is the decisive one. For the same `person` id between **consecutive** frames
(0.33s apart), how far did each thing move?

| percentile | `box` (face) centre | `silhouette` centroid |
|---|---|---|
| p50 | **4.1 px** | **947.5 px** |
| p75 | 9.8 px | 1670.0 px |
| p90 | 609.3 px | 2397.7 px |
| max | 3392.5 px | 3679.9 px |
| **moves < 50px** | **84.7%** | **15.0%** |

Spectators are seated. The face track is excellent — 4px median. The silhouette
riding along with that same track jumps ~950px per frame, in a 3840px-wide frame.
That is not a tracking error; the silhouette bound to each row is essentially
arbitrary.

### 3. Visual

Rendering one frame with face boxes, silhouettes, and a line from each face centre to
*its own row's* silhouette centroid produces lines crisscrossing the entire frame.
Correct pairing would be short stubs inside each shape. See the repro below to
regenerate.

## What is NOT the problem

- **The silhouettes themselves are good.** They are clean, plausible head-and-shoulders
  outlines at real people's positions. Rendering a frame's silhouettes with no row
  association at all produces a correct-looking crowd. Only the row binding is wrong.
- **Face tracking is good.** 4px median, stable 85% of the time.
- **Not a coordinate-space or offset bug.** Both `box` and `silhouette` are in the same
  3840×2160 source-pixel space, and the error is not a constant offset — median dx is
  0 with a stdev of 1232px. It is a pairing error, not a transform error.
- **Not sparse data.** `silhouette` is present on 99.7% of rows.

## Likely cause

Segmentation masks and face detections appear to be **zipped together by index rather
than matched by geometry**. The two models also have different recall (48.3% of faces
land inside no silhouette at all), so the lists cannot be positionally aligned even in
principle — some segmented bodies have no detected face, and vice versa.

## What correct output looks like

1. Each row's `silhouette` must be the outline of the **same human** as that row's
   `box`. The row's face centre should fall inside its own silhouette polygon.
2. When a face has **no** matching mask, emit `silhouette: null` rather than an
   unmatched polygon. Null is already the convention for missing optional fields
   (`pose` is present-as-key and null on 3347 rows), and consumers handle it.
   A wrong polygon is far worse than an absent one.
3. Containment is the natural matching rule — assign each face to the mask whose
   polygon contains its centre, resolving contention by mask/face overlap area.

## Also worth fixing: `person` teleports

Independent of the above, the `person` track jumps >200px between consecutive frames
on **14.1%** of transitions (756/5377) — roughly 6 of the 42 on-screen people every
frame. Worst observed: `person 35` at `(3523, 337)` at t=51.00 and `(344, 1519)` at
t=51.33 — opposite corners, 0.33s apart, and the `image` slot changed from
`person_18` to `person_100`.

Lower priority than the association bug, but it means `person` cannot currently be
trusted as identity by downstream consumers. (Web-side note: chunks are processed in
parallel, so `person` ids are also only unique *within* a chunk — `vy-tech-web`
namespaces them per chunk in `src/scoring/tracker.js` to avoid cross-chunk collisions.
A globally stable id from the pipeline would let that go away.)

## Repro

```bash
curl -sS -o coke.json \
  https://s.vy.vision/play/vy/video/coke/expressions-vy-video-coke-0146.json

python3 - <<'EOF'
import json, collections, math, statistics
d = json.load(open('coke.json')); rows = d['results']
frames = sorted({r['frame'] for r in rows})
stepmap = {f: i for i, f in enumerate(frames)}
for r in rows: r['step'] = stepmap[r['frame']]

def cen(s): return (statistics.mean(s[0::2]), statistics.mean(s[1::2]))
def fc(r): b = r['box']; return (b['x'] + b['w']/2, b['y'] + b['h']/2)
def bbox(s):
    xs, ys = s[0::2], s[1::2]
    return min(xs), min(ys), max(xs), max(ys)

# 1. containment
sil = [r for r in rows if r.get('silhouette')]
own = sum(1 for r in sil
          if bbox(r['silhouette'])[0] <= fc(r)[0] <= bbox(r['silhouette'])[2]
          and bbox(r['silhouette'])[1] <= fc(r)[1] <= bbox(r['silhouette'])[3])
print('face inside own silhouette bbox: %.1f%% (target: ~95%%+)' % (100*own/len(sil)))

# 2. per-track movement, face vs silhouette
by = collections.defaultdict(list)
for r in sil: by[r['person']].append(r)
face, silm = [], []
for pid, rs in by.items():
    rs.sort(key=lambda r: r['step'])
    for a, b in zip(rs, rs[1:]):
        if b['step'] - a['step'] != 1: continue
        face.append(math.dist(fc(a), fc(b)))
        silm.append(math.dist(cen(a['silhouette']), cen(b['silhouette'])))
face.sort(); silm.sort()
print('p50 move/frame  face %.1fpx   silhouette %.1fpx (target: comparable)'
      % (face[len(face)//2], silm[len(silm)//2]))
EOF
```

Current output:

```
face inside own silhouette bbox: 24.8% (target: ~95%+)
p50 move/frame  face 4.1px   silhouette 947.5px (target: comparable)
```

Both numbers are the acceptance test for a fix.

## Consumer context (why this matters)

`vy-tech-web`'s Synthetic View (`src/viz/syntheticView.js`, exploration x001) replaces
the video frame with per-person silhouettes over a clean background plate, filled with
a colour encoding that person's emotion score — a PII-safe view of a crowd's reaction.
It is the first consumer of `silhouette`. With the current data it renders each body
tinted by an unrelated person's emotion, and the shape bound to each track changes
every frame, so the crowd visibly churns. The feature is blocked on this.
