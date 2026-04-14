import van from "vanjs-core";
import { eventBus } from "../eventbus.js";
import { scoring } from "../scoring/scoring.js";
const { div, table, tr, th, td, span } = van.tags;

class HeatmapDetail {
    constructor() {
        this.container = null;
        this.body = null;

        eventBus.addEventListener("heatmap.mousemove", (e) => {
            const box = scoring.boxAt(e.detail.x, e.detail.y);
            if (box) {
                this.show(box, e.detail.clientX, e.detail.clientY);
            } else {
                this.hide();
            }
        });
    }

    createElement(options = {}) {
        this.body = div();
        const merged = {
            id: "heatmap-detail",
            class:
                "hidden fixed z-[10000] pointer-events-none " +
                "text-xs text-gray-700 bg-white p-2 border " +
                "rounded shadow-lg",
            ...options,
        };
        this.container = div(merged, this.body);
        // Appended to <body> so it escapes any ancestor stacking context and
        // can float above the video.js control bar (z-index: 1000 !important).
        // A high z-index alone isn't enough if a parent forms its own stacking
        // context (transform, opacity, z-index, filter, etc.).
        document.body.appendChild(this.container);
        return this.container;
    }

    show(box, clientX, clientY) {
        const emotionRows = [];
        for (const emotion of box.row.emotions) {
            const score = emotion.score || 0;
            if (!score) continue;
            emotionRows.push(
                tr(
                    td({ class: "w-32" }, emotion.name),
                    td({ class: "w-16 text-right" }, emotion.confidence.toFixed(2)),
                    td({ class: "w-12 text-right" }, score.toFixed(0)),
                ),
            );
        }

        let content;
        if (emotionRows.length === 0) {
            content = div(
                { class: "italic text-gray-500" },
                "No contributing emotions",
            );
        } else {
            content = table(
                { class: "table-fixed" },
                tr(
                    th({ class: "w-32 text-left" }, "Emotion"),
                    th({ class: "w-16 text-right" }, "Conf"),
                    th({ class: "w-12 text-right" }, "Score"),
                ),
                ...emotionRows,
                tr({ },
                    td({ class: "text-right pt-2", colspan: "2" }, "Weighted Avg."),
                    td(
                        {
                            class: "text-right pt-2",
                        },
                        span({ class: "font-bold" }, box.row.score.toFixed(0)),
                    ),
                ),
            );
        }

        this.body.replaceChildren(content);

        const offset = 14;
        const w = this.container.offsetWidth || 240;
        const h = this.container.offsetHeight || 120;
        let left = clientX + offset;
        let top = clientY + offset;
        if (left + w > window.innerWidth) left = clientX - w - offset;
        if (top + h > window.innerHeight) top = clientY - h - offset;
        this.container.style.left = `${left}px`;
        this.container.style.top = `${top}px`;
        this.container.classList.remove("hidden");
    }

    hide() {
        if (this.container) this.container.classList.add("hidden");
    }
}

const heatmapDetail = new HeatmapDetail();
export default heatmapDetail;
export { heatmapDetail, HeatmapDetail };
