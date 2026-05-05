import van from "vanjs-core";

import { summarizer } from "../scoring/summarizer.js";
import { eventBus } from "../eventbus.js";
import { timeUtil } from "../util/time.js";

class SummaryGraph {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isStale = true;
        this.currentTime = 0;
        this.firstBucketTime = 0;
        this.lastBucketTime = 0;

        eventBus.addEventListener("playback.ready", (e) => {
            this.paint();
            this.isStale = false;
        });

        eventBus.addEventListener("playback.timeupdate", (e) => {
            //if (this.isStale) this.paint();
            //this.isStale = false;
            if (!e.detail.currentTime || !e.detail.duration) return;
            this.currentTime = e.detail.currentTime;
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
                if (this.currentTime && this.lastBucketTime > this.firstBucketTime) {
                    const ctx = chart.ctx;
                    const chartArea = chart.chartArea;
                    const fraction =
                        (this.currentTime - this.firstBucketTime) /
                        (this.lastBucketTime - this.firstBucketTime);
                    const clamped = Math.max(0, Math.min(1, fraction));
                    const currentX =
                        chartArea.left +
                        clamped * (chartArea.right - chartArea.left);

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

        const totalDuration = parseInt(summary[summary.length - 1].startTime);
        const useMMSS = totalDuration < 3600;

        let firstBucketTime = 0;
        let lastBucketTime = 0;

        for (let i = 0; i < 100; i++) {
            const startIdx = Math.floor((i * summary.length) / 100);
            const endIdx = Math.max(
                startIdx + 1,
                Math.floor(((i + 1) * summary.length) / 100)
            );
            const count = endIdx - startIdx;

            let people = 0;
            let score = 0;
            let elapsedTime = 0;

            for (let j = startIdx; j < endIdx; j++) {
                people += summary[j].people;
                score += summary[j].score;
                elapsedTime += parseInt(summary[j].startTime);
            }

            peopleData.push(people / count);
            scoreData.push(score / count);

            const avgTime = elapsedTime / count;
            if (i === 0) firstBucketTime = avgTime;
            if (i === 99) lastBucketTime = avgTime;

            if (useMMSS) {
                const mins = Math.floor(avgTime / 60);
                const secs = Math.floor(avgTime % 60);
                labels.push(
                    `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
                );
            } else {
                labels.push(timeUtil.format(avgTime));
            }
        }

        this.firstBucketTime = firstBucketTime;
        this.lastBucketTime = lastBucketTime;

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
