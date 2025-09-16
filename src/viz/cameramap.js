import van from "vanjs-core";

import { geomUtil } from "../util/geom.js";
import { eventBus } from "../eventbus.js";
import { summarizer } from "../scoring/summarizer.js";

class CameraMap {
    constructor() {
        this.canvas = null;
        this.second = null;

        eventBus.addEventListener("viz.paint", (e) => {
            this.second = Math.floor(e.detail.currentTime);
            this.paint();
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        let merged = {
            id: "report-viz-cameramap",
            class: "w-full h-full",
            width: 500,
            height: 250,
            ...options,
        };

        this.canvas = canvas(merged);

        this.init();

        return this.canvas;
    }

    scoreToHue(score) {
        let hueOffset = (score / 1000.0) * 64;
        if (hueOffset < 0) hueOffset = Math.max(hueOffset, -64);
        else hueOffset = Math.min(hueOffset, 64);
        const hue = 64 + hueOffset;
        return hue;
    }

    findTrangleFromMouse(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        // Calculate the mouse position relative to the canvas
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Scale coordinates to match canvas internal dimensions
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const scaledX = Math.floor(x * scaleX);
        const scaledY = Math.floor(y * scaleY);

        // Find the triangle that contains the mouse position
        const point = geomUtil.findTriangleContainingPoint(
            scaledX,
            scaledY,
            this.triangles
        );

        return point;
    }

    init() {
        this.active = 1;
        this.hover = null;

        this.triangles = [
            [390, 84, 499, 7, 499, 125],
            [-20, -40, 107, 80, 0, 103],
            [303, 180, 376, 249, 279, 249],
            [195, 180, 172, 249, 250, 249],
            [479, 145, 407, 233, 360, 180],
        ];

        this.labels = [
            [408, 87, 1],
            [83, 79, 2],
            [301, 200, 3],
            [192, 202, 4],
            [452, 166, 5],
        ];

        this.summaryLabels = [
            [408, 87, 1],
            [83, 79, 2],
            [301, 200, 3],
            [192, 202, 4],
            [452, 166, 5],
        ];

        // Load /img/raimondi-seat-map.png
        this.img = new Image();
        this.img.src = "/img/raimondi-seat-map.png";
        this.img.onload = () => {
            this.paint();
        };
        this.img.onerror = () => {
            console.error("Failed to load the seat map image.");
        };

        this.canvas.addEventListener("mousemove", (event) => {
            const point = this.findTrangleFromMouse(
                event.clientX,
                event.clientY
            );
            this.hover = point;
            this.paint();

            // Set mouse pointer if hovering over a triangle
            this.canvas.style.cursor = point ? "pointer" : "default";
        });

        this.canvas.addEventListener("mouseout", () => {
            this.hover = null;
            this.paint();
        });

        this.canvas.addEventListener("click", (event) => {
            const point = this.findTrangleFromMouse(
                event.clientX,
                event.clientY
            );

            if (point) {
                this.active = point;
                this.paint();
                eventBus.fire("ui.requestCamera", { camera: point });
            }
        });
    }

    paint() {
        let second = this.second;
        let summaries = summarizer.getAll();

        var ctx = this.canvas.getContext("2d");
        ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.lineWidth = 2;
        for (let i = 0; i < this.triangles.length; i++) {
            let score =
                summaries &&
                summaries[i] &&
                summaries[i][second] &&
                summaries[i][second].score;

            if (this.hover === i + 1) {
                ctx.strokeStyle = "#00eeffff";
            } else if (this.active === i + 1) {
                ctx.strokeStyle = "#3fa7d7ff";
            } else {
                ctx.strokeStyle = "#999";
            }

            if (score) {
                const hue = this.scoreToHue(score);
                ctx.fillStyle = `hsl(${hue}, 100%, 50%, 0.5)`;
            } else {
                ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            }
            const triangle = this.triangles[i];
            const [x1, y1, x2, y2, x3, y3] = triangle;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            const label = this.labels[i];
            const [lx, ly, ltext] = label;
            ctx.font = "16px Arial";
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillText(ltext, lx, ly);
        }
    }
}

const cameramap = new CameraMap();
export default cameramap;
export { cameramap, CameraMap };
