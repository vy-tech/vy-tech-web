import van from "vanjs-core";
import { activeBoxManager } from "../scoring/activeBoxManager.js";
import { eventBus } from "../eventbus.js";

class Heatmap {
    constructor() {
        this.canvas = null;
        this.originalWidth = 3840;
        this.originalHeight = 2160;

        eventBus.addEventListener("playback.timeupdate", (e) => {
            this.paint();
        });

        eventBus.addEventListener("ui.hierarchyChanged", (e) => {
            this.paint();
        });

        eventBus.addEventListener("scoring.video", (e) => {
            const video = e.detail;
            if (video.width && video.height) {
                this.originalWidth = video.width;
                this.originalHeight = video.height;
            }
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        let merged = {
            id: "report-viz-heatmap",
            width: 1280,
            height: 720,
            ...options,
        };

        this.canvas = canvas(merged);

        this.canvas.addEventListener("click", (e) => {
            eventBus.fire("heatmap.click", {});
        });
        this.canvas.addEventListener("mousemove", (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Calculate the mouse position relative to the canvas
            // and scale it to the original video resolution
            const x = Math.floor(
                ((e.clientX - rect.left) / rect.width) * this.originalWidth
            );
            const y = Math.floor(
                ((e.clientY - rect.top) / rect.height) * this.originalHeight
            );

            eventBus.fire("heatmap.mousemove", {
                x: x,
                y: y,
                clientX: e.clientX,
                clientY: e.clientY,
            });
        });

        return this.canvas;
    }

    paint() {
        if (!this.canvas) {
            console.error("Canvas element not found");
            return;
        }
        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            console.error("Failed to get canvas context");
            return;
        }

        // Clear the canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const activeBoxes = activeBoxManager.get();
        for (const box of activeBoxes) {
            const ox = box.x;
            const oy = box.y;
            const ow = box.w;
            const oh = box.h;
            const score = Math.floor(box.score);
            const expires = box.expires;

            // Scale the box coordinates to the canvas size
            const x = (ox / this.originalWidth) * this.canvas.width;
            const y = (oy / this.originalHeight) * this.canvas.height;
            const w = (ow / this.originalWidth) * this.canvas.width;
            const h = (oh / this.originalHeight) * this.canvas.height;

            // Calculate center and radiuses for the radial gradient
            const cx = x + w / 2;
            const cy = y + h / 2;
            const rw = w * 5.0;
            const rh = h * 5.0;
            const rx = cx - rw / 2;
            const ry = cy - rh / 2;
            const innerR = 1;
            const outerR = rh * 0.25;

            // Create the hue based on the score
            var hueOffset = (score / 1000.0) * 64;
            if (hueOffset < 0) hueOffset = Math.max(hueOffset, -64);
            else hueOffset = Math.min(hueOffset, 64);
            const hue = 64 + hueOffset;
            const gradient = ctx.createRadialGradient(
                cx,
                cy,
                innerR,
                cx,
                cy,
                outerR
            );
            const alpha = Math.floor((expires / 3000.0) * 80);
            gradient.addColorStop(0, `hsl(${hue}, 100%, 50%, ${alpha}%)`);
            gradient.addColorStop(1, `hsl(${hue}, 100%, 50%, 0%)`);
            ctx.fillStyle = gradient;

            ctx.fillRect(rx, ry, rw, rh);
        }
    }
}

const heatmap = new Heatmap();
export default heatmap;
export { heatmap, Heatmap };
