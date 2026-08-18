import van from "vanjs-core";

// crowdMap — a top-down ballpark map that plots approximate crowd-member
// positions colored by sentiment, inside each camera's field-of-view wedge.
//
// Milestone 1 (standalone viz): driven imperatively via setDetections()/paint()
// so a dev harness can feed it raw expression rows with no eventBus/summarizer/
// firebase coupling. Live playback sync and the chat tool come later.
//
// NOTE ON COPIED CODE: the FOV geometry is copied from src/viz/cameramap.js and
// the sentiment scorer + weight table mirror Score.computeRowScore
// (src/scoring/scoring.js:356) and defaultEmotionWeights (src/data/profiles.js:31).
// They are inlined rather than imported because those modules construct
// firebase-backed singletons at import time, which a standalone canvas must not
// pull in. Unify into a shared module when this viz graduates to production.

// --- Stadium geometry (copied from cameramap.js) ---------------------------
// Each triangle is [x1,y1, x2,y2, x3,y3] in the 500x250 seat-map space.
const TRIANGLES = [
    [390, 84, 499, 7, 499, 125],
    [-20, -40, 107, 80, 0, 103],
    [303, 180, 376, 249, 279, 249],
    [195, 180, 172, 249, 250, 249],
    [479, 145, 407, 233, 360, 180],
];

const LABELS = [
    [408, 87, 1],
    [83, 79, 2],
    [301, 200, 3],
    [192, 202, 4],
    [452, 166, 5],
];

// Per-triangle apex vertex index (0,1,2) — the camera lens, where the FOV
// converges. The two remaining vertices form the far base edge of the wedge.
// Initial guess: the vertex nearest that camera's label (labels sit on the
// camera marker in cameramap). TUNING ITEM — flip these by eye in the harness.
const APEX_INDEX = [0, 1, 0, 0, 0];

const SEAT_MAP_SRC = "/img/raimondi-seat-map.png";

// --- Projection tuning ------------------------------------------------------
// Source frame is 4K; box coords are in this pixel space.
const FRAME_WIDTH = 3840;

// Box height as a depth proxy: a taller box is a closer face (near the apex),
// a shorter box is farther (near the base). H_NEAR maps to t=0 (apex), H_FAR to
// t=1 (base). Defaults bracket the observed box-height range in the sample files
// (~26-154px) so depth spreads across the full wedge. TUNING ITEM.
const H_NEAR = 150;
const H_FAR = 35;

// --- Sentiment scorer (mirrors Score.computeRowScore) -----------------------
const SCORE_ALPHA = 0.003;

const EMOTION_WEIGHTS = {
    Admiration: 1,
    Adoration: 1,
    "Aesthetic Appreciation": 1.25,
    Amusement: 1.5,
    Anger: 0,
    Annoyance: 1,
    Anxiety: 0,
    Awe: 1.5,
    Awkwardness: 0,
    Boredom: -2,
    Calmness: 0,
    Concentration: 0,
    Confusion: 0,
    Contemplation: 0,
    Contempt: 0,
    Contentment: 0,
    Craving: 0,
    Desire: 0,
    Determination: 0,
    Disappointment: 0,
    Disapproval: 0,
    Disgust: 0,
    Distress: 0,
    Doubt: 0,
    Ecstasy: 1.5,
    Embarrassment: 0,
    "Empathic Pain": 0,
    Enthusiasm: 2,
    Entrancement: 2,
    Envy: 0,
    Excitement: 2,
    Fear: 0,
    Gratitude: 1,
    Guilt: 0,
    Horror: 0,
    Interest: 1,
    Joy: 1.5,
    Love: 1.5,
    Nostalgia: 0,
    Pain: 0,
    Pride: 1,
    Realization: 1,
    Relief: 1,
    Romance: 1,
    Sadness: 0,
    Sarcasm: 0,
    Satisfaction: 1.5,
    Shame: 0,
    "Surprise (negative)": 0,
    "Surprise (positive)": 2,
    Sympathy: 0,
    Tiredness: -0.5,
    Triumph: 2,
};

function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

class CrowdMap {
    constructor() {
        this.canvas = null;
        this.img = null;

        // Projected points only — {x, y, s} per plotted person, keyed by camera
        // number (1-5). Detection rows are reduced on the way in and dropped:
        // a row carries a ~50-entry emotions array plus box/silhouette/tracking
        // fields, so holding rows for a multi-frame range across 5 cameras costs
        // orders of magnitude more memory than the map actually needs.
        this.points = {};
        // Per-camera { count, plotted, mean } for the wedge tint and callers.
        this.stats = {};

        // Scrubbable sequence of pre-reduced time windows, and the step showing.
        this.sequence = [];
        this.step = 0;

        // Playback. `playhead` is a float step position, so the fractional part
        // is the tween between step N and N+1.
        this.playhead = 0;
        this.playing = false;
        this.raf = null;
        // Wall-clock time per step. Deliberately not the window's real duration
        // (4s/step would crawl); this is a readable review speed.
        this.stepDurationMs = 700;
        // Called with the whole-step index when it advances during playback.
        this.onStepChange = null;

        // Upper bound on plotted points per camera. A time range can span
        // thousands of detections; beyond this we evenly sample so both memory
        // and per-frame draw cost stay bounded.
        this.maxPointsPerCamera = 1500;

        // Diameter of a plotted dot, in seat-map pixels.
        this.dotRadius = 3;
        // When true, tint each wedge by the mean sentiment of its points.
        this.tintWedges = true;
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        const merged = {
            id: "viz-crowdmap",
            class: "w-full h-full",
            width: 500,
            height: 250,
            ...options,
        };

        this.canvas = canvas(merged);
        this.init();
        return this.canvas;
    }

    init() {
        this.img = new Image();
        this.img.src = SEAT_MAP_SRC;
        this.img.onload = () => this.paint();
        this.img.onerror = () =>
            console.error("crowdMap: failed to load seat map image.");
    }

    // --- Data API (imperative) ---------------------------------------------
    setDetections(camera, rows) {
        const { points, stats } = this.reduceRows(camera, rows);
        this.points[camera] = points;
        this.stats[camera] = stats;
        this.paint();
    }

    // Replace all wedges at once and paint a single frame. Takes an object
    // keyed by camera number (1-5) => rows. Cameras absent from the map are
    // cleared. This is the shape the chat tool supplies per-camera data in.
    setAllDetections(rowsByCamera) {
        this.points = {};
        this.stats = {};
        for (const [key, rows] of Object.entries(rowsByCamera || {})) {
            const camera = parseInt(key, 10);
            if (!camera) continue;
            const { points, stats } = this.reduceRows(camera, rows);
            this.points[camera] = points;
            this.stats[camera] = stats;
        }
        this.paint();
    }

    clear() {
        this.stopPlayback();
        this.points = {};
        this.stats = {};
        this.sequence = [];
        this.step = 0;
        this.playhead = 0;
        this.paint();
    }

    /**
     * Load a scrubbable sequence of time windows. Each step is reduced to
     * points up front and the source rows are dropped, so the whole sequence
     * costs points-only memory regardless of how many detections produced it.
     *
     * @param {Array} steps [{ index, time, byCamera: {cam: rows[]} }]
     */
    setSequence(steps) {
        this.stopPlayback();
        this.sequence = (steps || []).map((step) => {
            const points = {};
            const stats = {};
            for (const [key, rows] of Object.entries(step.byCamera || {})) {
                const camera = parseInt(key, 10);
                if (!camera) continue;
                const reduced = this.reduceRows(camera, rows);
                points[camera] = reduced.points;
                stats[camera] = reduced.stats;
            }
            return { index: step.index, time: step.time, points, stats };
        });

        this.linkSequence();
        this.playhead = 0;
        this.showStep(0);
        return this.sequence.length;
    }

    /**
     * Resolve each point's counterpart in the following step, by person id, so
     * a frame of animation is a straight lerp with no per-frame matching or
     * allocation. The last step links back to the first, which is what makes
     * the loop seamless rather than snapping at the wrap.
     *
     * Points with no counterpart are marked so they can fade out, and points
     * that appear only in the next step are collected as `entering` to fade in.
     * That matters here because the tracker fragments identities on ~0.33s
     * detection cadence, so a meaningful share of points won't match.
     */
    linkSequence() {
        const n = this.sequence.length;
        if (!n) return;

        for (let i = 0; i < n; i++) {
            const current = this.sequence[i];
            const next = this.sequence[(i + 1) % n];
            current.entering = {};

            for (const key of Object.keys(current.points)) {
                const nextPoints = next.points[key] || [];
                const nextById = new Map();
                for (const point of nextPoints) {
                    if (point.id !== undefined) nextById.set(point.id, point);
                }

                const currentIds = new Set();
                for (const point of current.points[key]) {
                    if (point.id !== undefined) currentIds.add(point.id);
                    const match =
                        point.id !== undefined ? nextById.get(point.id) : null;
                    if (match) {
                        point.nx = match.x;
                        point.ny = match.y;
                        point.ns = match.s;
                        point.hasNext = true;
                    } else {
                        point.hasNext = false;
                    }
                }

                current.entering[key] = nextPoints.filter(
                    (point) =>
                        point.id === undefined || !currentIds.has(point.id)
                );
            }

            // A camera absent from this step but present in the next: every
            // one of its points is entering.
            for (const key of Object.keys(next.points)) {
                if (!current.points[key]) {
                    current.entering[key] = next.points[key];
                }
            }
        }
    }

    // Render one step of the loaded sequence.
    showStep(index) {
        if (!this.sequence || !this.sequence.length) return;
        this.step = Math.max(0, Math.min(index, this.sequence.length - 1));
        this.playhead = this.step;
        const step = this.sequence[this.step];
        this.points = step.points;
        this.stats = step.stats;
        this.paint();
        return step;
    }

    // --- Playback ----------------------------------------------------------
    /**
     * Animate through the sequence, tweening between steps, looping until
     * paused. `onStepChange(index)` fires when the whole-step index advances so
     * a caller can follow along with a slider.
     */
    play() {
        if (this.raf || !this.sequence || this.sequence.length < 2) return;

        this.playing = true;
        // Seeded from the first rAF timestamp rather than performance.now():
        // a rAF callback carries the *frame's* start time, which can predate
        // the moment play() was called if a frame was already in flight. That
        // made the first delta negative, pushing playhead below zero and
        // yielding a step index of -1 — an unrendered frame and a slider that
        // jumped to -1 for one tick.
        let last = null;

        const tick = (now) => {
            if (last === null) last = now;
            const elapsed = Math.max(0, now - last);
            last = now;

            this.playhead += elapsed / this.stepDurationMs;
            // Wrap rather than clamp — the last step is linked back to the
            // first, so the loop is continuous.
            while (this.playhead >= this.sequence.length) {
                this.playhead -= this.sequence.length;
            }
            if (this.playhead < 0) this.playhead = 0;

            const index = Math.floor(this.playhead);
            const fraction = this.playhead - index;

            if (index !== this.step) {
                this.step = index;
                if (this.onStepChange) this.onStepChange(index);
            }

            this.paintTween(index, fraction);
            this.raf = requestAnimationFrame(tick);
        };

        this.raf = requestAnimationFrame(tick);
    }

    // Cancel the loop without touching what's on screen. Used by pause() and
    // by callers that are about to replace or drop the sequence entirely.
    stopPlayback() {
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
        this.playing = false;
    }

    pause() {
        this.stopPlayback();
        // Settle on a whole step so the static view matches the slider.
        if (this.sequence && this.sequence.length) {
            this.showStep(Math.round(this.playhead) % this.sequence.length);
        }
    }

    togglePlay() {
        if (this.playing) this.pause();
        else this.play();
        return this.playing;
    }

    stepCount() {
        return this.sequence ? this.sequence.length : 0;
    }

    currentStep() {
        return this.sequence && this.sequence.length
            ? this.sequence[this.step]
            : null;
    }

    /**
     * Project detection rows into compact {x, y, s} points, evenly sampling
     * down to maxPointsPerCamera. The rows themselves are not retained — the
     * caller is free to drop them as soon as this returns.
     */
    reduceRows(camera, rows) {
        rows = rows || [];
        const camIndex = camera - 1;
        const points = [];
        let sum = 0;

        if (camIndex < 0 || camIndex >= TRIANGLES.length) {
            return { points, stats: { count: 0, plotted: 0, mean: 0 } };
        }

        const total = rows.length;
        // Iterate a fixed count rather than accumulating a float step —
        // accumulation drifts and can overrun the cap by one on some lengths.
        const keep = Math.min(total, this.maxPointsPerCamera);
        const step = keep ? total / keep : 1;

        for (let k = 0; k < keep; k++) {
            const row = rows[Math.min(total - 1, Math.floor(k * step))];
            if (!row || !row.box) continue;
            const p = this.boxToMapPoint(camIndex, row.box);
            const s = this.rowScore(row);
            // `id` is the person track when the loader supplied one — kept so a
            // future pass can tween a person between steps instead of popping.
            points.push({ x: p.x, y: p.y, s, id: row.id });
            sum += s;
        }

        return {
            points,
            stats: {
                count: total,
                plotted: points.length,
                mean: points.length ? sum / points.length : 0,
            },
        };
    }

    // --- Sentiment: softmax-weighted mean of signed emotion reactions ------
    // Returns a score in roughly [-2000, 2000].
    //
    // Rows that came through Score.loadExpressions() already carry a computed
    // `score`, and computeRowScore MUTATES emotion.score in place (to the
    // weighted value r = score * weight * 1000). Recomputing from such rows
    // would apply the profile weights a second time, so always prefer the
    // pipeline's score and only compute for raw rows (the harness path).
    rowScore(row) {
        if (typeof row.score === "number") return row.score;

        let acc = 0;
        let wsum = 0;
        let count = 0;

        for (const emotion of row.emotions || []) {
            const weight = EMOTION_WEIGHTS[emotion.name];
            if (typeof weight !== "number") continue;

            const r = emotion.score * weight * 1000;
            const w = Math.exp(SCORE_ALPHA * Math.abs(r));
            acc += w * r;
            wsum += w;
            count += 1;
        }

        return count ? acc / wsum : 0;
    }

    // Map a signed score to a hue: red (negative) -> yellow -> green (positive).
    // Copied from cameramap.scoreToHue.
    scoreToHue(score) {
        let hueOffset = (score / 1000.0) * 64;
        hueOffset = clamp(hueOffset, -64, 64);
        return 64 + hueOffset;
    }

    // --- Projection: box (4K pixel space) -> map point ---------------------
    // depth t from box height (bigger = closer = near apex); lateral u from the
    // box center x; then bilinear placement inside the wedge.
    boxToMapPoint(camIndex, box) {
        const tri = TRIANGLES[camIndex];
        const pts = [
            [tri[0], tri[1]],
            [tri[2], tri[3]],
            [tri[4], tri[5]],
        ];
        const ai = APEX_INDEX[camIndex];
        const apex = pts[ai];
        const base = pts.filter((_, i) => i !== ai);

        const t = clamp((H_NEAR - box.h) / (H_NEAR - H_FAR), 0, 1);
        const u = clamp((box.x + box.w / 2) / FRAME_WIDTH, 0, 1);

        const edgeL = [
            lerp(apex[0], base[0][0], t),
            lerp(apex[1], base[0][1], t),
        ];
        const edgeR = [
            lerp(apex[0], base[1][0], t),
            lerp(apex[1], base[1][1], t),
        ];

        return {
            x: lerp(edgeL[0], edgeR[0], u),
            y: lerp(edgeL[1], edgeR[1], u),
        };
    }

    // Seat map + a wash so the wedges read clearly on top.
    paintBackground(ctx) {
        const { width, height } = this.canvas;
        if (this.img && this.img.complete && this.img.naturalWidth) {
            ctx.drawImage(this.img, 0, 0, width, height);
        } else {
            ctx.clearRect(0, 0, width, height);
        }
        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.fillRect(0, 0, width, height);
    }

    paint() {
        if (!this.canvas) return;
        const ctx = this.canvas.getContext("2d");

        this.paintBackground(ctx);
        this.paintWedges(ctx);
        this.paintDots(ctx);
        this.paintLabels(ctx);
    }

    paintWedges(ctx) {
        ctx.lineWidth = 2;
        for (let i = 0; i < TRIANGLES.length; i++) {
            const stats = this.stats[i + 1];

            if (this.tintWedges && stats && stats.plotted) {
                const hue = this.scoreToHue(stats.mean);
                ctx.fillStyle = `hsl(${hue}, 100%, 50%, 0.28)`;
            } else {
                ctx.fillStyle = "rgba(255,255,255,0.35)";
            }
            ctx.strokeStyle = "#999";

            const [x1, y1, x2, y2, x3, y3] = TRIANGLES[i];
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    paintDots(ctx) {
        for (let i = 0; i < TRIANGLES.length; i++) {
            const points = this.points[i + 1] || [];
            for (const point of points) {
                this.drawDot(ctx, point.x, point.y, point.s, 1);
            }
        }
    }

    drawDot(ctx, x, y, score, alpha) {
        if (alpha <= 0.01) return;
        const hue = this.scoreToHue(score);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, this.dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue}, 90%, 45%)`;
        ctx.fill();
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    /**
     * Paint step `index` interpolated `fraction` of the way toward the next.
     * Draws straight from the precomputed links — no matching, no allocation
     * per frame, so this is safe to run at 60fps.
     */
    paintTween(index, fraction) {
        if (!this.canvas || !this.sequence || !this.sequence.length) return;
        const step = this.sequence[index];
        if (!step) return;

        const ctx = this.canvas.getContext("2d");
        this.paintBackground(ctx);

        // Wedge tint follows the step it's in; fine at these durations, and
        // avoids a second lerp per camera per frame.
        this.stats = step.stats;
        this.paintWedges(ctx);

        for (let i = 0; i < TRIANGLES.length; i++) {
            const camera = i + 1;
            for (const point of step.points[camera] || []) {
                if (point.hasNext) {
                    this.drawDot(
                        ctx,
                        lerp(point.x, point.nx, fraction),
                        lerp(point.y, point.ny, fraction),
                        lerp(point.s, point.ns, fraction),
                        1
                    );
                } else {
                    // No counterpart ahead — fade out over the interval.
                    this.drawDot(ctx, point.x, point.y, point.s, 1 - fraction);
                }
            }
            for (const point of (step.entering && step.entering[camera]) ||
                []) {
                this.drawDot(ctx, point.x, point.y, point.s, fraction);
            }
        }

        this.paintLabels(ctx);
    }

    paintLabels(ctx) {
        ctx.font = "16px Arial";
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        for (const [lx, ly, ltext] of LABELS) {
            ctx.fillText(ltext, lx, ly);
        }
    }
}

const crowdMap = new CrowdMap();
export default crowdMap;
export { crowdMap, CrowdMap };
