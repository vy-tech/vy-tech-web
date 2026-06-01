import van from "vanjs-core";
import { activeBoxManager } from "../scoring/activeBoxManager.js";
import { eventBus } from "../eventbus.js";

// Synthetic-view renderer (exploration x001). Replaces the video frame with
// a per-face procedural 2D face glyph positioned over each detected face
// box, with the glyph's expression driven by the face's emotion vector and
// its background color encoding the heatmap score (so both signals are
// visible in one view).
//
// Mirrors the lifecycle pattern in src/viz/heatmap.js: a singleton class
// whose createElement() returns a canvas DOM node, subscribes to
// playback.timeupdate / ui.hierarchyChanged, and paints from
// activeBoxManager.get(). Mousemove/click on the canvas fire the same
// `heatmap.mousemove` / `heatmap.click` eventBus events the heatmap canvas
// fires, so heatmapDetail and the play/pause handler in rsreports.js
// (addHeatmapListeners) work unchanged.

const SRC_W = 3840;
const SRC_H = 2160;

// Visual size of each face glyph: 25% larger than the source box, with a
// 50px floor so very small detections still read as faces. Both values are
// in canvas-display pixels.
const SIZE_INFLATE = 1.25;
const SIZE_MIN_PX = 50;

// Per-emotion preset face parameters. Each row is the "this emotion at
// full strength" look. `tint` was removed in favor of a score-derived
// background — see backgroundForScore() below.
const PRESETS = {
    Anger:     { eyeOpen: 0.70, browTilt: -22, browY: 0.40, mouthCurve: -0.10, mouthOpen: 0.05, mouthW: 0.40 },
    Disgust:   { eyeOpen: 0.70, browTilt: -10, browY: 0.38, mouthCurve: -0.25, mouthOpen: 0.10, mouthW: 0.38 },
    Fear:      { eyeOpen: 1.10, browTilt:  12, browY: 0.32, mouthCurve: -0.10, mouthOpen: 0.15, mouthW: 0.30 },
    Happiness: { eyeOpen: 0.65, browTilt:   2, browY: 0.36, mouthCurve:  0.55, mouthOpen: 0.05, mouthW: 0.50 },
    Sadness:   { eyeOpen: 0.55, browTilt:  20, browY: 0.38, mouthCurve: -0.45, mouthOpen: 0.05, mouthW: 0.38 },
    Surprise:  { eyeOpen: 1.20, browTilt:   5, browY: 0.30, mouthCurve:  0.00, mouthOpen: 0.30, mouthW: 0.28 },
    Neutral:   { eyeOpen: 0.85, browTilt:   0, browY: 0.40, mouthCurve:  0.00, mouthOpen: 0.00, mouthW: 0.42 },
};

const NEUTRAL = PRESETS.Neutral;

function blendParams(cores) {
    if (!cores) return NEUTRAL;
    const ranked = [];
    for (const name in cores) {
        const v = cores[name];
        const score = v && Number.isFinite(v.score) ? v.score : 0;
        if (!score) continue;
        ranked.push([name, Math.abs(score)]);
    }
    if (ranked.length === 0) return NEUTRAL;
    ranked.sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, 3);
    let total = 0;
    for (const [, m] of top) total += m;
    if (total === 0) return NEUTRAL;

    const out = {
        eyeOpen: 0, browTilt: 0, browY: 0,
        mouthCurve: 0, mouthOpen: 0, mouthW: 0,
    };
    for (const [name, mag] of top) {
        const p = PRESETS[name];
        if (!p) continue;
        const w = mag / total;
        out.eyeOpen    += w * p.eyeOpen;
        out.browTilt   += w * p.browTilt;
        out.browY      += w * p.browY;
        out.mouthCurve += w * p.mouthCurve;
        out.mouthOpen  += w * p.mouthOpen;
        out.mouthW     += w * p.mouthW;
    }
    return out;
}

// HSL→RGB. h in [0,360), s/l in [0,1]. Returns 0..255 ints.
function hslToRgb(h, s, l) {
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

// Background + contrast-picked foreground for a given heatmap score.
// Mirrors the hue mapping in src/viz/heatmap.js:91-94 so a face's color in
// synthetic view matches the heatmap glow color it would have replaced.
function backgroundForScore(score) {
    const finite = Number.isFinite(score) ? score : 0;
    let hueOffset = (finite / 1000) * 64;
    if (hueOffset < 0) hueOffset = Math.max(hueOffset, -64);
    else hueOffset = Math.min(hueOffset, 64);
    const hue = 64 + hueOffset; // 0 (red) .. 128 (green)
    const [r, g, b] = hslToRgb(hue, 1.0, 0.5);
    // Perceptual luminance (sRGB coefficients). Threshold tuned so red and
    // deep green get white features, yellow/lime get dark features.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const dark = lum > 0.55;
    return {
        bg: `rgb(${r},${g},${b})`,
        fg: dark ? "#1a1a1a" : "#ffffff",
        outline: dark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.55)",
        mouthFill: dark ? "#3a1a1a" : "#000000",
    };
}

// Draw a closed silhouette polygon from a flat [x0,y0,x1,y1,...] array of
// source-pixel coordinates. Used in place of the procedural face glyph when
// the pipeline has emitted a 32-point outline for this detection — the goal
// is maximum PII obscuration (real posture/shape, no facial features) with
// the heatmap score still encoded in the fill color.
function drawSilhouette(ctx, points, sx, sy, colors) {
    if (!points || points.length < 6) return;
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

// Ray-casting point-in-polygon for the silhouette hit test. `points` is the
// flat source-pixel array; `x`, `y` are also in source-pixel space.
function pointInSilhouette(points, x, y) {
    if (!points || points.length < 6) return false;
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

function drawFace(ctx, cx, cy, size, p, colors) {
    const r = size / 2;

    // Face circle — fill = score color, outline = contrast color.
    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.strokeStyle = colors.outline;
    ctx.stroke();

    // Eyes
    const eyeY = cy - r * 0.10;
    const eyeOff = r * 0.36;
    const eyeRX = r * 0.13;
    const eyeRY = Math.max(0.5, r * 0.13 * (p.eyeOpen ?? 0.85));
    ctx.fillStyle = colors.fg;
    ctx.beginPath();
    ctx.ellipse(cx - eyeOff, eyeY, eyeRX, eyeRY, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeOff, eyeY, eyeRX, eyeRY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows — bilateral, inner end raises with positive browTilt.
    const browYAbs = cy - r * (p.browY ?? 0.40);
    const browLen = r * 0.40;
    const tiltRad = ((p.browTilt ?? 0) * Math.PI) / 180;
    ctx.lineWidth = Math.max(1.5, r * 0.10);
    ctx.lineCap = "round";
    ctx.strokeStyle = colors.fg;
    {
        const bx = cx - eyeOff;
        const dx = (browLen / 2) * Math.cos(tiltRad);
        const dy = (browLen / 2) * Math.sin(tiltRad);
        ctx.beginPath();
        ctx.moveTo(bx - dx, browYAbs + dy);
        ctx.lineTo(bx + dx, browYAbs - dy);
        ctx.stroke();
    }
    {
        const bx = cx + eyeOff;
        const dx = (browLen / 2) * Math.cos(tiltRad);
        const dy = (browLen / 2) * Math.sin(tiltRad);
        ctx.beginPath();
        ctx.moveTo(bx + dx, browYAbs + dy);
        ctx.lineTo(bx - dx, browYAbs - dy);
        ctx.stroke();
    }

    // Mouth
    const mouthCY = cy + r * 0.40;
    const mouthHalfW = r * (p.mouthW ?? 0.42);
    const curve = p.mouthCurve ?? 0;
    const open = p.mouthOpen ?? 0;
    const ctrlOffset = r * curve * 0.6;
    if (open > 0.05) {
        ctx.fillStyle = colors.mouthFill;
        ctx.beginPath();
        ctx.ellipse(cx, mouthCY, mouthHalfW * 0.85, r * open, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.strokeStyle = colors.fg;
    ctx.lineCap = "round";
    // Canvas Y increases downward, so a SMILE (positive curve) needs the
    // control point BELOW midline (larger Y) — the curve bows down,
    // putting the corners higher than the middle. Frown is the inverse.
    ctx.beginPath();
    ctx.moveTo(cx - mouthHalfW, mouthCY);
    ctx.quadraticCurveTo(cx, mouthCY + ctrlOffset, cx + mouthHalfW, mouthCY);
    ctx.stroke();
}

class SyntheticView {
    constructor() {
        this.canvas = null;
        this.active = false;

        eventBus.addEventListener("playback.timeupdate", () => this.paint());
        eventBus.addEventListener("ui.hierarchyChanged", () => this.paint());
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
        if (this.active) this.paint();
        return Promise.resolve();
    }

    // Hit-test in canvas pixel space using the inflated visual size, so
    // hovering anywhere over the rendered face glyph (not just the original
    // tight detection box) triggers the tooltip. Returns the active box
    // closest to the pointer whose glyph radius covers it, or null.
    _hitTest(canvasX, canvasY) {
        if (!this.canvas) return null;
        const sx = this.canvas.width / SRC_W;
        const sy = this.canvas.height / SRC_H;
        // Convert to source-pixel space once for silhouette polygon tests.
        const srcX = canvasX / sx;
        const srcY = canvasY / sy;
        let best = null;
        let bestDist = Infinity;
        for (const box of activeBoxManager.get()) {
            const cx = (box.x + box.w / 2) * sx;
            const cy = (box.y + box.h / 2) * sy;
            if (box.silhouette && box.silhouette.length >= 6) {
                if (pointInSilhouette(box.silhouette, srcX, srcY)) {
                    const d = Math.hypot(canvasX - cx, canvasY - cy);
                    if (d < bestDist) {
                        bestDist = d;
                        best = box;
                    }
                }
                continue;
            }
            const drawSize = Math.max(box.h * sy * SIZE_INFLATE, SIZE_MIN_PX);
            const r = drawSize / 2;
            const d = Math.hypot(canvasX - cx, canvasY - cy);
            if (d <= r && d < bestDist) {
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

        // Solid neutral background — synthetic view is a *replacement* for
        // the video frame, not an overlay.
        ctx.fillStyle = "#0e0e12";
        ctx.fillRect(0, 0, W, H);

        const sx = W / SRC_W;
        const sy = H / SRC_H;

        const boxes = activeBoxManager.get();
        for (const box of boxes) {
            const colors = backgroundForScore(box.score);
            if (box.silhouette && box.silhouette.length >= 6) {
                drawSilhouette(ctx, box.silhouette, sx, sy, colors);
                continue;
            }
            const cx = (box.x + box.w / 2) * sx;
            const cy = (box.y + box.h / 2) * sy;
            const drawSize = Math.max(box.h * sy * SIZE_INFLATE, SIZE_MIN_PX);
            const params = blendParams(box.cores);
            drawFace(ctx, cx, cy, drawSize, params, colors);
        }
    }
}

const syntheticView = new SyntheticView();
export default syntheticView;
export { syntheticView, SyntheticView };
