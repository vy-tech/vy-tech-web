import van from "vanjs-core";
import { activeBoxManager } from "../scoring/activeBoxManager.js";
import { eventBus } from "../eventbus.js";

// Synthetic-view renderer (exploration x001). Replaces the video frame with
// a per-person silhouette polygon drawn from the 32-point outline the
// processing pipeline emits, filled with a color encoding the heatmap score.
// Real posture/shape is preserved, facial features are not — maximum PII
// obscuration with the score still readable.
//
// Mirrors the lifecycle pattern in src/viz/heatmap.js: a singleton class
// whose createElement() returns a canvas DOM node, subscribes to
// playback.timeupdate / ui.hierarchyChanged, and paints from
// activeBoxManager.get(). Mousemove/click on the canvas fire the same
// `heatmap.mousemove` / `heatmap.click` eventBus events the heatmap canvas
// fires, so heatmapDetail and the play/pause handler in rsreports.js
// (addHeatmapListeners) work unchanged.
//
// Boxes without a `silhouette` are skipped — this view requires pipeline
// output carrying the outline.
//
// Background: an optional "clean plate" — a frame from the same camera with
// no people in it — is composited under the silhouettes so they sit in the
// real scene rather than on flat color. It is not in any metadata; the URL is
// derived as a sibling of the expressions JSON (whose resolved storage
// endpoint arrives on `scoring.video`) named for the hierarchy (which arrives
// on `playback.ready`). Absent plate → flat BG_COLOR, which is the case for
// every video except vy:video:coke today.

const SRC_W = 3840;
const SRC_H = 2160;

// Minimum point count for a drawable polygon (3 points = 6 flat values).
const MIN_POINTS_LEN = 6;

// Fallback fill when no background plate is available.
const BG_COLOR = "#0e0e12";

// Outlines are interpolated between the detection behind us and the one ahead,
// across exactly the interval between them (Score.linkSilhouetteChain supplies
// the read-ahead). Not eased toward the latest: easing has to guess a duration,
// and the real gaps are too irregular for any guess — p50 0.33s, p90 ~1.7s — so
// a fixed time constant finishes early and sits, which reads as lerp-pause-lerp.
// Interpolating against the known next timestamp paces every morph exactly, and
// costs no lag, because the future rows are already loaded.

class SyntheticView {
    constructor() {
        this.canvas = null;
        this.active = false;

        // Background plate state. `_bgKey` is the URL we last tried, so the
        // per-chunk `scoring.video` cadence doesn't refetch or re-404.
        this.background = null;
        this._bgKey = null;
        this._exprUrl = null;
        this._hierarchy = null;

        // rAF handle. While the loop is running it owns painting; see _tick().
        this._raf = null;
        this._playing = false;

        // Per-track shape smoothing, keyed by the ActiveBoxManager box object
        // rather than by `person`. ActiveBoxManager reuses the same object for
        // the life of a track — including across a handoff, where the person ID
        // changes but the human doesn't — so the object is the more stable
        // identity, and a WeakMap drops the state when the box is expired
        // without us having to prune.
        this._morph = new WeakMap();

        // Video clock. `playback.timeupdate` fires ~4Hz, which is fine as a
        // sync point but far too coarse to interpolate against at 60fps, so we
        // extrapolate from the last sample with the wall clock and re-sync on
        // every tick. See _videoTime().
        this._clockVideo = null;
        this._clockWall = 0;

        // `playback.timeupdate` is far too slow to *drive* a view that replaces
        // the video rather than overlaying it. It only repaints here when the
        // rAF loop isn't running (paused, seeked), so a still frame refreshes.
        eventBus.addEventListener("playback.timeupdate", (e) => {
            const t = e.detail?.currentTime;
            if (Number.isFinite(t)) {
                this._clockVideo = t;
                this._clockWall = performance.now();
            }
            if (!this._raf) this.paint();
        });

        eventBus.addEventListener("playback.play", () => {
            this._playing = true;
            this._startLoop();
        });
        eventBus.addEventListener("playback.pause", () => {
            this._playing = false;
            this._stopLoop();
            this.paint();
        });

        eventBus.addEventListener("ui.hierarchyChanged", () => this.paint());

        eventBus.addEventListener("playback.ready", (e) => {
            // Dashed hierarchy, e.g. "vy-video-coke".
            this._hierarchy = e.detail?.hierarchy || null;
            this._resolveBackground();
        });

        eventBus.addEventListener("scoring.video", (e) => {
            this._exprUrl = e.detail?.url || null;
            this._resolveBackground();
        });
    }

    // Sibling of the expressions JSON, named for the hierarchy — mirrors the
    // `summary-${hierarchy}.json` convention in src/functions/v1/routes/video.js.
    _backgroundUrl() {
        if (!this._exprUrl || !this._hierarchy) return null;
        const slash = this._exprUrl.lastIndexOf("/");
        if (slash < 0) return null;
        const dir = this._exprUrl.slice(0, slash);
        return `${dir}/background-${this._hierarchy}.jpg`;
    }

    // Load the plate at most once per URL. A missing plate is expected, not an
    // error — most videos have none — so a failed load just leaves
    // `background` null and paint() falls back to the flat fill.
    _resolveBackground() {
        const url = this._backgroundUrl();
        if (!url || url === this._bgKey) return;

        this._bgKey = url;
        this.background = null;

        const img = new Image();
        img.onload = () => {
            // Ignore a late load for a plate we've since navigated away from.
            if (this._bgKey !== url) return;
            this.background = this._prescale(img);
            this.paint();
        };
        img.onerror = () => {
            if (this._bgKey !== url) return;
            this.background = null;
        };
        img.src = url;
    }

    // Downscale the plate once, into a canvas matching ours, and blit that 1:1
    // per frame. The plate is a 4K jpg against a 1280x720 canvas: rescaling it
    // was free at the old ~4Hz repaint rate, but the rAF loop would redo it 60
    // times a second for an image that never changes.
    _prescale(img) {
        const w = this.canvas?.width || 1280;
        const h = this.canvas?.height || 720;
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const octx = off.getContext("2d");
        if (!octx) return img; // fall back to per-frame scaling
        octx.drawImage(img, 0, 0, w, h);
        return off;
    }

    createElement(options = {}) {
        const { canvas } = van.tags;
        const merged = {
            id: "report-viz-synthetic",
            width: 1280,
            height: 720,
            style: "display: none;",
            ...options,
        };
        this.canvas = canvas(merged);

        // Hover/click → reuse the heatmap event channel so heatmapDetail
        // (src/viz/heatmapDetail.js) and the play/pause handler in
        // rsreports.js (addHeatmapListeners) work without modification.
        this.canvas.addEventListener("mousemove", (e) => this._onMouseMove(e));
        this.canvas.addEventListener("mouseleave", () => {
            // Send out-of-bounds coords so the tooltip hides.
            eventBus.fire("heatmap.mousemove", {
                x: -1, y: -1, clientX: -1, clientY: -1,
            });
        });
        this.canvas.addEventListener("click", () => {
            eventBus.fire("heatmap.click", {});
        });

        return this.canvas;
    }

    setActive(on) {
        this.active = !!on;
        if (this.canvas) {
            this.canvas.style.display = this.active ? "" : "none";
        }
        if (this.active) {
            this.paint();
            this._startLoop();
        } else {
            // Toggled back to video — stop burning frames on a hidden canvas.
            this._stopLoop();
        }
        return Promise.resolve();
    }

    // Render loop. Runs only while the view is both visible and playing:
    // paused, nothing changes between frames, and while hidden there's nothing
    // to draw. Both those cases fall back to on-demand paints.
    _startLoop() {
        if (this._raf !== null) return;
        if (!this.active || !this._playing) return;
        const tick = () => {
            if (!this.active || !this._playing) {
                this._raf = null;
                return;
            }
            this._raf = requestAnimationFrame(tick);
            this.paint();
        };
        this._raf = requestAnimationFrame(tick);
    }

    _stopLoop() {
        if (this._raf !== null) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
    }

    _hasSilhouette(box) {
        return !!box.silhouette && box.silhouette.length >= MIN_POINTS_LEN;
    }

    // Rotate `sil` so its vertices line up with `smoothed`, and return the
    // rotated copy.
    //
    // The outlines are a contour walk with consistent winding, but the walk's
    // starting point drifts between frames: vertex i of one detection is best
    // matched by vertex i of the next only ~35% of the time (±2 covers ~77%).
    // Lerping without correcting that would drag every vertex around the
    // contour — a shape that visibly rotates while morphing. So pick the offset
    // that minimises total squared displacement first.
    //
    // O(n^2) at n=32 is ~1k distance terms per new detection per track; at ~48
    // silhouettes and 3 detections/sec that's negligible, and the early-out
    // below cuts most of it.
    _alignRotation(sil, smoothed) {
        const n = sil.length / 2;
        let bestK = 0;
        let bestCost = Infinity;

        for (let k = 0; k < n; k++) {
            let cost = 0;
            for (let i = 0; i < n; i++) {
                const j = (i + k) % n;
                const dx = smoothed[i * 2] - sil[j * 2];
                const dy = smoothed[i * 2 + 1] - sil[j * 2 + 1];
                cost += dx * dx + dy * dy;
                if (cost >= bestCost) break; // can't win; stop early
            }
            if (cost < bestCost) {
                bestCost = cost;
                bestK = k;
            }
        }

        const out = new Float64Array(sil.length);
        for (let i = 0; i < n; i++) {
            const j = ((i + bestK) % n) * 2;
            out[i * 2] = sil[j];
            out[i * 2 + 1] = sil[j + 1];
        }
        return out;
    }

    // Video clock, extrapolated between the ~4Hz timeupdate samples so
    // interpolation has something continuous to run against. Returns null
    // before the first sample.
    _videoTime() {
        if (!Number.isFinite(this._clockVideo)) return null;
        if (!this._playing) return this._clockVideo;
        return this._clockVideo + (performance.now() - this._clockWall) / 1000;
    }

    // The shape to draw: this box's outline interpolated toward the next one
    // due, positioned by the video clock. Returns a flat [x0,y0,...] array in
    // source-pixel space.
    _shapeFor(box) {
        const now = this._videoTime();
        let fromRow = box.silhouetteRow;
        if (!fromRow || now === null) return box.silhouette;

        // Walk to the detection pair bracketing `now`. The box only refreshes
        // on the ~4Hz timeupdate tick, so by the time we draw, one or more
        // detections it hasn't seen may already be due — walking here keeps
        // the shape on the video clock instead of on ActiveBoxManager's.
        while (
            fromRow.nextSilhouetteRow &&
            fromRow.nextSilhouetteRow.time <= now
        ) {
            fromRow = fromRow.nextSilhouetteRow;
        }
        const toRow = fromRow.nextSilhouetteRow;
        const from = fromRow.silhouette || box.silhouette;

        // Nothing ahead to interpolate toward — end of a track or of a chunk,
        // or older pipeline output. Hold what we have.
        if (
            !toRow ||
            !toRow.silhouette ||
            toRow.silhouette.length !== from.length ||
            !(toRow.time > fromRow.time)
        ) {
            return from;
        }

        let u = (now - fromRow.time) / (toRow.time - fromRow.time);
        if (u <= 0) return from;
        if (u > 1) u = 1;

        // Align once per (from, to) pair, not per frame — the rotation is a
        // property of the pair, and it's the expensive part.
        let st = this._morph.get(box);
        if (!st || st.fromRow !== fromRow || st.toRow !== toRow) {
            st = {
                fromRow,
                toRow,
                aligned: this._alignRotation(toRow.silhouette, from),
                out: new Float64Array(from.length),
            };
            this._morph.set(box, st);
        }

        const out = st.out;
        const aligned = st.aligned;
        for (let i = 0; i < out.length; i++) {
            out[i] = from[i] + (aligned[i] - from[i]) * u;
        }
        return out;
    }

    // HSL→RGB. h in [0,360), s/l in [0,1]. Returns 0..255 ints.
    _hslToRgb(h, s, l) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255),
        ];
    }

    // Fill + contrast-picked outline for a given heatmap score. Mirrors the
    // hue mapping in src/viz/heatmap.js:91-94 so a person's color in
    // synthetic view matches the heatmap glow color it would have replaced.
    _colorsForScore(score) {
        const finite = Number.isFinite(score) ? score : 0;
        let hueOffset = (finite / 1000) * 64;
        if (hueOffset < 0) hueOffset = Math.max(hueOffset, -64);
        else hueOffset = Math.min(hueOffset, 64);
        const hue = 64 + hueOffset; // 0 (red) .. 128 (green)
        const [r, g, b] = this._hslToRgb(hue, 1.0, 0.5);
        // Perceptual luminance (sRGB coefficients). Threshold tuned so red
        // and deep green get a light outline, yellow/lime get a dark one.
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const dark = lum > 0.55;
        return {
            bg: `rgb(${r},${g},${b})`,
            outline: dark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)",
        };
    }

    // Draw a closed silhouette polygon from a flat [x0,y0,x1,y1,...] array
    // of source-pixel coordinates.
    _drawSilhouette(ctx, points, sx, sy, colors) {
        ctx.fillStyle = colors.bg;
        ctx.strokeStyle = colors.outline;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(points[0] * sx, points[1] * sy);
        for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(points[i] * sx, points[i + 1] * sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // Ray-casting point-in-polygon for the silhouette hit test. `points` is
    // the flat source-pixel array; `x`, `y` are also in source-pixel space.
    _pointInSilhouette(points, x, y) {
        let inside = false;
        const n = points.length;
        for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
            const xi = points[i], yi = points[i + 1];
            const xj = points[j], yj = points[j + 1];
            const intersect =
                (yi > y) !== (yj > y) &&
                x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Hit-test against the rendered silhouette polygons. Returns the active
    // box whose polygon contains the pointer and whose center is closest to
    // it, or null.
    _hitTest(canvasX, canvasY) {
        if (!this.canvas) return null;
        const sx = this.canvas.width / SRC_W;
        const sy = this.canvas.height / SRC_H;
        // Convert to source-pixel space for the polygon tests.
        const srcX = canvasX / sx;
        const srcY = canvasY / sy;
        let best = null;
        let bestDist = Infinity;
        for (const box of activeBoxManager.get()) {
            if (!this._hasSilhouette(box)) continue;
            // Hit-test the interpolated outline, not the raw detection —
            // mid-morph they differ, and the pointer should hit what's drawn.
            if (!this._pointInSilhouette(this._shapeFor(box), srcX, srcY)) {
                continue;
            }
            const cx = (box.x + box.w / 2) * sx;
            const cy = (box.y + box.h / 2) * sy;
            const d = Math.hypot(canvasX - cx, canvasY - cy);
            if (d < bestDist) {
                bestDist = d;
                best = box;
            }
        }
        return best;
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
        const canvasY = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
        const hit = this._hitTest(canvasX, canvasY);
        if (hit) {
            // Fire with the box center in source-pixel coords so
            // scoring.boxAt() (which delegates to activeBoxManager.getAt()
            // point-in-rect) finds the same box.
            eventBus.fire("heatmap.mousemove", {
                x: hit.x + hit.w / 2,
                y: hit.y + hit.h / 2,
                clientX: e.clientX,
                clientY: e.clientY,
            });
        } else {
            eventBus.fire("heatmap.mousemove", {
                x: -1, y: -1,
                clientX: e.clientX, clientY: e.clientY,
            });
        }
    }

    paint() {
        if (!this.active || !this.canvas) return;
        const ctx = this.canvas.getContext("2d");
        if (!ctx) return;

        const W = this.canvas.width;
        const H = this.canvas.height;

        // Synthetic view is a *replacement* for the video frame, not an
        // overlay: paint the clean plate if we have one, else flat color.
        // The plate is 16:9 in the same source space as the boxes, so it
        // stretches to the canvas without letterboxing.
        if (this.background) {
            ctx.drawImage(this.background, 0, 0, W, H);
        } else {
            ctx.fillStyle = BG_COLOR;
            ctx.fillRect(0, 0, W, H);
        }

        const sx = W / SRC_W;
        const sy = H / SRC_H;

        // A shape is held while its track is alive and drops when
        // ActiveBoxManager expires the box. There's no staleness fade: it keyed
        // on time-since-detection, so a chunk load stall — clock advancing, no
        // rows yet — dimmed the entire crowd in unison. Departures are rare
        // enough (the `person` track is stable) not to need one.
        for (const box of activeBoxManager.get()) {
            if (!this._hasSilhouette(box)) continue;
            this._drawSilhouette(
                ctx,
                this._shapeFor(box),
                sx,
                sy,
                this._colorsForScore(box.score),
            );
        }
    }
}

const syntheticView = new SyntheticView();
export default syntheticView;
export { syntheticView, SyntheticView };
