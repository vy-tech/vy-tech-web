import van from "vanjs-core";

import { summarizer } from "../scoring/summarizer.js";
import { eventBus } from "../eventbus.js";
import { timeUtil } from "../util/time.js";

class People {
    constructor() {
        this.canvas = null;
        this.isStale = true;

        eventBus.addEventListener("viz.paint", (e) => {
            if (this.isStale) this.paint();
            this.isStale = false;
        });

        eventBus.addEventListener("viz.cameraChanged", (e) => {
            this.isStale = true;
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        let merged = {
            id: "report-viz-ppl",
            class: "w-full h-auto aspect-[calc(16/4.5)] mt-2",
            width: 1280,
            height: 360,
            ...options,
        };

        this.canvas = canvas(merged);

        this.init();

        return this.canvas;
    }

    init() {
        const ctx = this.canvas.getContext("2d");

        const labels = [];
        const borderColors = [];

        for (let i = 0; i < 100; i++) {
            labels.push(`${i + 1}%`);
            borderColors.push("#3fa7d7");
        }

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "People",
                        data: labels.map(() => 0),
                        fill: false,
                        borderColor: borderColors,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
            },
        });
        this.chart.update();

        this.canvas.addEventListener("click", (evt) => {
            const points = this.chart.getElementsAtEventForMode(
                evt,
                "nearest",
                { intersect: true },
                true
            );

            if (points.length) {
                const firstPoint = points[0];
                const label = this.chart.data.labels[firstPoint.index];
                // const value =
                //     this.pplChart.data.datasets[firstPoint.datasetIndex].data[
                //         firstPoint.index
                //     ];
                eventBus.fire("ui.requestTimeSeek", { time: label });
            }
        });
    }

    paint() {
        let summary = summarizer.getCurrent();
        if (!this.chart) return;

        // // Only paint it when the summary changes..
        // if (this.lastSummary === summary) return;
        // this.lastSummary = summary;

        let data = [];
        let labels = [];

        // for (let i = 0; i < 100; i++) {
        //     let idx = Math.floor(i * (summary.length / 100));
        //     labels.push(this.formatTime(summary[idx].startTime));
        //     data.push(summary[idx].people);
        // }

        let step = Math.floor(summary.length / 100);

        for (let i = 0; i < 100; i++) {
            let idx = i * step;
            let people = 0;
            let elapsedTime = 0;

            for (let j = 0; j < step; j++) {
                people += summary[idx + j].people;
                elapsedTime += parseInt(summary[idx + j].startTime);
            }

            data.push(people / step);
            labels.push(timeUtil.format(elapsedTime / step));
        }

        // Update the spider chart data
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update();
    }
}

const people = new People();
export default people;
export { people, People };
