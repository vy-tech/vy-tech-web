import van from "vanjs-core";

import { summarizer } from "../scoring/summarizer.js";
import { eventBus } from "../eventbus.js";
import { timeUtil } from "../util/time.js";

class SummaryGraph {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isStale = true;
        this.timeComplete = 0;

        eventBus.addEventListener("playback.ready", (e) => {
            this.paint();
            this.isStale = false;
        });

        eventBus.addEventListener("playback.timeupdate", (e) => {
            //if (this.isStale) this.paint();
            //this.isStale = false;
            if (!e.detail.currentTime || !e.detail.duration) return;
            this.timeComplete = e.detail.currentTime / e.detail.duration;
            this.paint();
        });

        eventBus.addEventListener("playback.cameraChanged", (e) => {
            this.isStale = true;
        });

        eventBus.addEventListener("ui.hierarchyChanged", (e) => {
            this.resetData();
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

    resetData() {
        const labels = [];
        const peopleData = [];
        const scoreData = [];

        for (let i = 0; i < 100; i++) {
            labels.push(`${i + 1}%`);
            peopleData.push(0);
            scoreData.push(0);
        }

        // Update the chart data
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = peopleData;
        this.chart.data.datasets[1].data = scoreData;
        this.chart.update();
    }

    init() {
        this.ctx = this.canvas.getContext("2d");

        const labels = [];
        const peopleColors = [];
        const scoreColors = [];

        for (let i = 0; i < 100; i++) {
            labels.push(`${i + 1}%`);
            peopleColors.push("#3fa7d7");
            scoreColors.push("#fdb080");
        }

        if (this.chart) this.chart.destroy();

        // Plugin to draw the time indicator line
        const timeLinePlugin = {
            id: "timeLine",
            afterDraw: (chart) => {
                if (this.timeComplete) {
                    const ctx = chart.ctx;
                    const chartArea = chart.chartArea;
                    const currentX =
                        chartArea.left +
                        this.timeComplete * (chartArea.right - chartArea.left);

                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(currentX, chartArea.top);
                    ctx.lineTo(currentX, chartArea.bottom);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "red";
                    ctx.stroke();
                    ctx.restore();
                }
            },
        };

        this.chart = new Chart(this.ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "People",
                        data: labels.map(() => 0),
                        fill: false,
                        borderColor: peopleColors,
                        borderWidth: 1,
                    },
                    {
                        label: "Score",
                        data: labels.map(() => 0),
                        fill: false,
                        borderColor: scoreColors,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                    },
                },
            },
            plugins: [timeLinePlugin],
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
        if (!summary) return;
        if (!this.chart) return;

        // // Only paint it when the summary changes..
        // if (this.lastSummary === summary) return;
        // this.lastSummary = summary;

        let peopleData = [];
        let scoreData = [];
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
            let score = 0;
            let elapsedTime = 0;

            for (let j = 0; j < step; j++) {
                people += summary[idx + j].people;
                score += summary[idx + j].score;
                elapsedTime += parseInt(summary[idx + j].startTime);
            }

            peopleData.push(people / step);
            scoreData.push(score / step);
            labels.push(timeUtil.format(elapsedTime / step));
        }

        // Update the chart data
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = peopleData;
        this.chart.data.datasets[1].data = scoreData;
        this.chart.update();
    }
}

const summaryGraph = new SummaryGraph();
export default summaryGraph;
export { summaryGraph, SummaryGraph };
