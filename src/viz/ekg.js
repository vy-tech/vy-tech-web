import van from "vanjs-core";
import { scoring } from "../scoring/scoring.js";
import { eventBus } from "../eventbus.js";

class Ekg {
    constructor() {
        this.canvas = null;
        this.container = null;
        this.score = null;

        eventBus.addEventListener("viz.paint", (e) => {
            this.paint();
        });

        eventBus.addEventListener("viz.pause", () => {
            this.smoothie.stop();
        });

        eventBus.addEventListener("viz.play", () => {
            this.smoothie.start();
        });

        eventBus.addEventListener("viz.timeSeek", () => {
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
        let score = scoring.currentScore;
        this.timeSeries.append(Date.now(), score);
        this.label.innerText = score.toFixed(0);
    }
}

const ekg = new Ekg();
export default ekg;
export { ekg, Ekg };
