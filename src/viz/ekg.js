import van from "vanjs-core";
import { scoring } from "../scoring/scoring.js";
import { eventBus } from "../eventbus.js";
import { summarizer } from "../scoring/summarizer.js";

class Ekg {
    constructor() {
        this.showSummary = false;
        this.canvas = null;
        this.container = null;
        this.score = null;
        this.sumScore = null;

        eventBus.addEventListener("playback.timeupdate", (e) => {
            this.score = scoring.currentScore;

            const second = Math.floor(e.detail.currentTime);
            const summary = summarizer.getCurrent();
            if (summary) {
                this.sumScore = summary[second].score || 0;
            }

            this.paint();
        });

        eventBus.addEventListener("playback.pause", () => {
            this.smoothie.stop();
        });

        eventBus.addEventListener("playback.play", () => {
            this.smoothie.start();
        });

        eventBus.addEventListener("playback.timeseek", () => {
            this.timeSeries.clear();
        });
    }

    createElement(options = {}) {
        const { canvas, div } = van.tags;

        let merged = { ...options };

        this.canvas = canvas({
            id: "report-viz-ekg",
            class: "w-full h-full",
            width: 500,
            height: 250,
        });
        this.label = div(
            {
                id: "report-viz-ekg-score",
                class: "absolute top-0 left-0 p-1 text-xl text-black",
            },
            "0"
        );
        this.container = div(merged, this.canvas, this.label);

        this.init();

        return this.container;
    }

    init() {
        this.smoothie = new SmoothieChart({
            responsive: true,
            interpolation: "bezier",
            minValue: -1000,
            maxValue: 1000,
            grid: {
                strokeStyle: "rgb(200, 200, 200)",
                fillStyle: "rgb(255,255,255)",
                lineWidth: 1,
                millisPerLine: 1000,
                verticalSections: 4,
            },
            labels: {
                fillStyle: "rgb(0, 0, 0)",
                strokeStyle: "rgb(255, 255, 0)",
                fontFamily: "Arial",
                fontSize: 16,
                precision: 0,
                showIntermediateLabels: true,
            },
        });

        this.smoothie.streamTo(this.canvas, 1000);
        window.setTimeout(() => this.smoothie.stop(), 10);
        this.timeSeries = new TimeSeries();

        this.smoothie.addTimeSeries(this.timeSeries, {
            strokeStyle: "rgb(0, 0, 255)",
            fillStyle: "rgba(0,0,255, 0.4)",
            lineWidth: 3,
        });
    }

    paint() {
        this.timeSeries.append(Date.now(), this.score);
        this.label.innerText = this.score.toFixed(0);

        if (this.sumScore && this.showSummary) {
            this.label.innerText += ` (${this.sumScore.toFixed(0)})`;
        }
    }
}

const ekg = new Ekg();
export default ekg;
export { ekg, Ekg };
