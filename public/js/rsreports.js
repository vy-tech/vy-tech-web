import { v as van } from './chunks/van-t8DywzvC.js';
import { e as eventBus } from './chunks/eventbus-B9JUr222.js';
import { H as Hierarchy, a as activeBoxManager, g as geomUtil, s as scoring, d as demographics, p as profilesData } from './chunks/annotations-BrdKhlja.js';
import { s as summarizer } from './chunks/summarizer-aZzxlkAQ.js';
import { a as annotations, p as profiles } from './chunks/annotations-CluJ4Xjw.js';
import { e as events } from './chunks/events-B-e6WVlY.js';
import { t as timeUtil } from './chunks/events-B3vAjkhd.js';
import './chunks/db-BZQDImdW.js';
import './chunks/van-ui-CuITDDPw.js';
import './chunks/orgContext-npeuc6rs.js';

class Exporter {
    constructor() {
        this.hierarchy = null;
        this.annotations = null;
        this.aidx = null;

        this.summaries = null;
        this.sidx = null;

        eventBus.on("ui.requestExport", () => {
            this.export();
        });

        eventBus.on("annotations.ready", () => {
            this.annotations = annotations.getCurrent();
            this.aidx = 0;
        });

        eventBus.on("summarizer.ready", () => {
            this.summaries = summarizer.getAll();
            this.sidx = 0;
        });

        eventBus.on("playback.ready", (e) => {
            this.hierarchy = new Hierarchy(e.detail.hierarchy);
        });
    }

    getRow() {
        let row = {};
        let hasData = false;
        let time = null;

        for (let i = 0; i < this.summaries.length; i++) {
            let camera = i + 1;
            let summary = this.summaries[i][this.sidx];

            if (summary) {
                hasData = true;
                time = summary.startTime;
                row[`score_${camera}`] = summary.score.toFixed(0);
                row[`people_${camera}`] = summary.people;
            } else {
                row[`score_${camera}`] = null;
                row[`people_${camera}`] = null;
            }
        }

        this.sidx++;

        if (!hasData) return null;

        row["location"] = this.hierarchy.location;
        row["date"] = this.hierarchy.date;
        row["time"] = Math.floor(time);
        row["wallclock_time"] = timeUtil.toLocalTimeStringFromSeconds(time);

        if (this.annotations && this.aidx < this.annotations.length) {
            let annotation = this.annotations[this.aidx];
            if (annotation.time <= Math.floor(time)) {
                row["annotation_type"] = annotation.type;
                row["annotation_importance"] = annotation.importance;
                row["annotation_content"] = annotation.content;
                this.aidx++;
            } else {
                row["annotation_type"] = null;
                row["annotation_importance"] = null;
                row["annotation_content"] = null;
            }
        }

        return row;
    }

    createCsvContent() {
        const columns = [
            "location",
            "date",
            "time",
            "wallclock_time",
            "score_1",
            "score_2",
            "score_3",
            "score_4",
            "score_5",
            "people_1",
            "people_2",
            "people_3",
            "people_4",
            "people_5",
            "annotation_type",
            "annotation_importance",
            "annotation_content",
        ];

        const rows = [columns.join(",")]; // Header row

        // Reset indices for fresh iteration
        this.sidx = 0;
        this.aidx = 0;

        let row;
        while ((row = this.getRow()) !== null) {
            const values = columns.map((column) => {
                const value = row[column];
                if (value === null || value === undefined) return "";

                const stringValue = String(value);
                // Escape CSV special characters
                if (
                    stringValue.includes(",") ||
                    stringValue.includes('"') ||
                    stringValue.includes("\n")
                ) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });

            rows.push(values.join(","));
        }

        return rows.join("\n");
    }

    downloadBlob(filename, content) {
        const blob = new Blob([content], {
            type: "text/csv;charset=utf-8;",
        });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    getFilename() {
        let h = this.hierarchy;
        return `export-${h.location}-${h.date}.csv`;
    }

    async export() {
        console.log("Exporting data...");

        const filename = this.getFilename();
        const csvContent = this.createCsvContent();
        this.downloadBlob(filename, csvContent);

        console.log("Export complete.");
    }
}

new Exporter();

class Heatmap {
    constructor() {
        this.canvas = null;

        eventBus.addEventListener("playback.timeupdate", (e) => {
            this.paint();
        });

        eventBus.addEventListener("ui.hierarchyChanged", (e) => {
            this.paint();
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
            // and scale it to the original video resolution (3840x2160)
            const x = Math.floor(((e.clientX - rect.left) / rect.width) * 3840);
            const y = Math.floor(((e.clientY - rect.top) / rect.height) * 2160);

            eventBus.fire("heatmap.mousemove", { x: x, y: y });
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
            const x = (ox / 3840) * this.canvas.width;
            const y = (oy / 2160) * this.canvas.height;
            const w = (ow / 3840) * this.canvas.width;
            const h = (oh / 2160) * this.canvas.height;

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

class CameraMap {
    constructor() {
        this.canvas = null;
        this.second = null;

        eventBus.addEventListener("playback.timeupdate", (e) => {
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

        eventBus.addEventListener("ui.hierarchyChanged", (e) => {
            this.score = 0;
            this.sumScore = 0;
            this.timeSeries.clear();
            this.paint();
            this.smoothie.stop();
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
            minValue: -1e3,
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

class Spider {
    constructor() {
        this.canvas = null;

        eventBus.addEventListener("playback.timeupdate", (e) => {
            this.paint();
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        let merged = {
            id: "report-viz-spider",
            class: "w-full h-full",
            width: 500,
            height: 500,
            ...options,
        };

        this.canvas = canvas(merged);

        this.init();

        return this.canvas;
    }

    init() {
        var ctx = this.canvas.getContext("2d");

        var labels = [
            "Anger", //0
            "Disgust", //1
            "Fear", //2
            "Happiness", //3
            "Sadness", //4
            "Surprise", //5
            "Neutral", //6
        ];

        // GROSS TODO FIXME (this is a hack to reorder the labels)
        let d = labels.splice(3, 1);
        labels.splice(6, 0, ...d);
        d = labels.splice(4, 1);
        labels.splice(0, 0, ...d);
        d = labels.splice(4, 1);
        labels.splice(1, 0, ...d);
        d = labels.splice(5, 1);
        labels.splice(4, 0, ...d);

        this.spiderDataMap = {};
        for (var i = 0; i < labels.length; i++) {
            this.spiderDataMap[labels[i]] = i;
        }

        if (this.spiderChart) this.spiderChart.destroy();

        this.spiderChart = new Chart(ctx, {
            type: "radar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "T=0",
                        data: labels.map(() => 0),
                        fill: true,
                        backgroundColor: "rgba(0, 0, 255, 0.2)",
                        borderColor: "rgb(0, 0, 255)",
                        pointBackgroundColor: "rgb(0, 0, 255)",
                        pointBorderColor: "#fff",
                        pointHoverBackgroundColor: "#fff",
                        pointHoverBorderColor: "rgb(0, 0, 255)",
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
                scales: {
                    r: {
                        beginAtZero: true,
                        suggestedMin: 0,
                        suggestedMax: 1000,
                        pointLabels: {
                            font: {
                                size: 16,
                                family: "Arial",
                            },
                        },
                    },
                },
            },
        });
        this.spiderChart.update();
    }

    paint() {
        if (!this.spiderChart) return;
        let cores = scoring.currentCores;
        let data = cores.map((c) => Math.min(1000, Math.abs(c)));

        let d = data.splice(3, 1);
        data.splice(6, 0, ...d);
        d = data.splice(4, 1);
        data.splice(0, 0, ...d);
        d = data.splice(4, 1);
        data.splice(1, 0, ...d);
        d = data.splice(5, 1);
        data.splice(4, 0, ...d);

        // Update the spider chart data
        this.spiderChart.data.datasets[0].data = data;
        this.spiderChart.update();
    }
}

const spider = new Spider();

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

class Demographics {
    constructor(title, labels, data) {
        this.canvas = null;
        this.title = title;
        this.labels = labels;
        this.data = data;

        eventBus.on("playback.timeupdate", (e) => {
            const v1 = demographics.current[this.labels[0]];
            const v2 = demographics.current[this.labels[1]];
            const tot = v1 + v2;

            if (tot === 0) return;
            this.data[0] = Math.floor((v1 / tot) * 100);
            this.data[1] = Math.floor((v2 / tot) * 100);

            this.update();
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;
        let merged = {
            id: "report-viz-demo",
            width: 448,
            height: 126,
            ...options,
        };

        this.canvas = canvas(merged);

        this.init();

        return this.canvas;
    }

    update() {
        this.chart.data.datasets[0].data = [this.data[0]];
        this.chart.data.datasets[1].data = [this.data[1]];
        this.chart.update();
    }

    init() {
        const ctx = this.canvas.getContext("2d");

        this.chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [this.title],
                datasets: [
                    {
                        label: this.labels[0],
                        data: [this.data[0]],
                        fill: true,
                        borderWidth: 1,
                        borderColor: ["#d94d507f"],
                        backgroundColor: ["#d94d50"],
                    },

                    {
                        label: this.labels[1],
                        data: [this.data[1]],
                        fill: true,
                        borderWidth: 1,
                        borderColor: ["#3fa7d77f"],
                        backgroundColor: ["#3fa7d7"],
                    },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scale: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true,
                    },
                },
            },
        });
        this.chart.update();
    }
}

const genderDemo = new Demographics("Gender", ["male", "female"], [0, 0]);
const ageDemo = new Demographics("Age Group", ["adult", "child"], [0, 0]);

class LinkedPlayer {
    constructor() {
        this.container = null;

        eventBus.addEventListener("playback.play", () => {
            if (this.embedPlayer) {
                this.embedPlayer.playVideo();
            }
        });

        eventBus.addEventListener("playback.pause", () => {
            if (this.embedPlayer) {
                this.embedPlayer.pauseVideo();
            }
        });

        eventBus.addEventListener("playback.timeupdate", (e) => {
            this.sync(e.detail.currentTime);
        });

        eventBus.addEventListener("ui.hierarchyChanged", (e) => {
            console.log("Hierarchy changed, reinitializing linked player...");
            this.container.innerHTML = "";
            this.init();
        });
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = { ...options };

        this.container = div(merged);

        return this.container;
    }

    init() {
        const event = events.get();
        const embedVideo = event?.embed;

        if (!embedVideo) {
            this.container.innerHTML = "";
            console.error("No embed available");
            return;
        }

        this.embedVideoId = embedVideo.id;
        this.embedOffset = embedVideo.offset;

        const videoId = this.embedVideoId;
        const origin = window.location.origin;
        this.container.innerHTML =
            '<iframe id="report-embed-player" width="500" height="281" ' +
            'class="w-full h-auto aspect-video" ' +
            `src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${origin}"` +
            ' title="YouTube video player" frameborder="0" allow="web-share"' +
            ' referrerpolicy="strict-origin-when-cross-origin" ' +
            "allowfullscreen></iframe>";
        this.embedPlayer = new YT.Player("report-embed-player");
    }

    sync(currentTime) {
        if (this.embedPlayer) {
            let embedTime = this.embedPlayer.getCurrentTime();
            let embedState = this.embedPlayer.getPlayerState();
            let duration = this.embedPlayer.getDuration();
            let targetTime = currentTime + this.embedOffset;

            if (targetTime < 0 || targetTime > duration) {
                if (embedState == 1) {
                    console.log(
                        `Target time is ${targetTime}, pausing embed..`
                    );
                    this.embedPlayer.pauseVideo();
                    this.embedPlayer.mute();
                }
            } else {
                if (Math.abs(targetTime - embedTime) > 1) {
                    console.log(`Seeking embed to ${targetTime}..`);
                    this.embedPlayer.seekTo(targetTime, true);
                }
                if (embedState != 1) {
                    console.log(`Playing embedded video..`);
                    this.embedPlayer.playVideo();
                }
                if (this.embedPlayer.isMuted()) {
                    this.embedPlayer.unMute();
                }
            }
        }
    }
}

const linkedPlayer = new LinkedPlayer();

class AnnotationLog {
    /**
     * The annotation log displays a chat-like view of annotations associated with an event.
     * Annotations scroll automatically as the video time progresses.
     * It listens for "playback.ready" to load annotations for the current hierarchy
     * and "playback.timeupdate" to refresh the display.
     *
     * Annotations are marked with an importance of "low", "medium", "high" or "critical".
     *   * When importance="low" show a grey background
     *   * When importance="medium" show a blue background
     *   * When importance="high" show a yellow background
     *   * When importance="critical" show a red background and stick to the top or bottom of the log
     *
     * Annotations are marked with a type of "note", "transcript", "action" or "event".
     *   * When type="note" show a pencil emoji ✏️
     *   * When type="transcript" show a speech balloon emoji 💬
     *   * When type="action" show a baseball emoji ⚾
     *   * When type="event" show a party popper emoji 🎉
     *
     * Annotations have a format like: "✏️ This is a note annotation (hh:mm:ss)"
     * Annotations use the timeUtil.format function to format the time as hh:mm:ss
     **/
    constructor() {
        this.container = null;
        this.currentTime = 0;
        this.visibleElements = new Set(); // Track currently visible annotation IDs
        this.userScrollPaused = false; // Track if auto-scrolling is paused
        this.scrollPauseTimer = null; // Timer for auto-scroll pause
        this.isProgrammaticScroll = false; // Flag to distinguish programmatic vs user scrolling

        eventBus.on("playback.ready", async (e) => {
            this.hierarchy = e.detail.hierarchy;
            this.annotations = await annotations.getByHierarchy(this.hierarchy);
            this.createAnnotationElements();
        });

        eventBus.on("playback.timeupdate", (e) => {
            this.currentTime = e.detail.currentTime;
            this.paint();
        });

        eventBus.on("annotations.updated", async (e) => {
            console.log(
                "Annotations updated for current hierarchy, reinitializing..."
            );
            // Reload annotations and recreate elements
            this.annotations = await annotations.getByHierarchy(this.hierarchy);
            this.reinitializeContainers();
        });

        eventBus.on("ui.hierarchyChanged", async (e) => {
            this.hierarchy = e.detail.hierarchy;
            this.annotations = await annotations.getByHierarchy(this.hierarchy);
            this.reinitializeContainers();
        });
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = {
            id: "report-annotation-log",
            class: "w-full h-[95vh] flex flex-col",
            ...options,
        };

        this.container = div(merged);

        // Create the three main containers with proper flex constraints
        this.topStickyContainer = div({
            class: "flex-none max-h-[20vh] overflow-auto",
        });

        this.middleContainer = div({
            class: "flex-1 min-h-0 overflow-auto",
        });

        this.bottomStickyContainer = div({
            class: "flex-none max-h-[20vh] overflow-auto",
        });

        // Add all containers to main container
        van.add(
            this.container,
            this.topStickyContainer,
            this.middleContainer,
            this.bottomStickyContainer
        );

        this.setupVisibilityObserver();
        this.setupScrollListener();

        return this.container;
    }

    setStickyElementVisibility(container, dataId, isVisible) {
        if (!container) return;

        const element = container.querySelector(`[data-id="${dataId}"]`);
        if (element) {
            if (isVisible) {
                element.classList.remove("hidden");
            } else {
                element.classList.add("hidden");
            }
        }
    }

    // Add this method to your AnnotationLog class
    setupVisibilityObserver() {
        if (
            !this.middleContainer ||
            !this.topStickyContainer ||
            !this.bottomStickyContainer
        )
            return;

        // Track currently visible elements
        this.visibleElements = new Set();

        // Disconnect existing observer if it exists
        if (this.visibilityObserver) {
            this.visibilityObserver.disconnect();
        }

        this.visibilityObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const element = entry.target;
                    const annotationId = element.dataset.id;

                    if (entry.isIntersecting) {
                        this.visibleElements.add(annotationId);
                    } else {
                        this.visibleElements.delete(annotationId);
                    }

                    // Only handle critical annotations
                    if (element.dataset.importance === "critical") {
                        this.updateCriticalAnnotationVisibility();
                    }
                });
            },
            {
                root: this.middleContainer,
                rootMargin: "0px",
                threshold: 0.1,
            }
        );
    }

    setupScrollListener() {
        if (!this.middleContainer) return;

        // Use scrollend event to detect when programmatic scrolling completes
        this.middleContainer.addEventListener("scrollend", () => {
            this.isProgrammaticScroll = false;
        });

        this.middleContainer.addEventListener("scroll", (event) => {
            // Ignore programmatic scrolling
            if (this.isProgrammaticScroll) {
                return;
            }

            // User initiated scroll detected
            this.userScrollPaused = true;

            // Clear any existing timer
            if (this.scrollPauseTimer) {
                clearTimeout(this.scrollPauseTimer);
            }

            // Set timer to resume auto-scrolling after 5 seconds
            this.scrollPauseTimer = setTimeout(() => {
                this.userScrollPaused = false;
                console.log("Auto-scrolling resumed after user scroll pause");
            }, 5000); // 5 seconds

            console.log(
                "User scroll detected - pausing auto-scroll for 5 seconds"
            );
        });
    }

    updateCriticalAnnotationVisibility() {
        // Get all critical annotations
        const criticalAnnotations = this.annotations.filter(
            (a) => a.importance === "critical"
        );

        // Get the times of all currently visible annotations
        const visibleTimes = this.getVisibleAnnotationTimes();

        criticalAnnotations.forEach((annotation) => {
            const isVisible = this.visibleElements.has(annotation.id);

            if (isVisible) {
                // Hide from both sticky containers
                this.setStickyElementVisibility(
                    this.topStickyContainer,
                    annotation.id,
                    false
                );
                this.setStickyElementVisibility(
                    this.bottomStickyContainer,
                    annotation.id,
                    false
                );
            } else {
                // Determine if this annotation should go in top or bottom container
                // If the critical annotation's time is less than any visible annotation's time,
                // it should go in the top container, otherwise in the bottom container
                const shouldGoInTop = this.shouldCriticalAnnotationGoInTop(
                    annotation,
                    visibleTimes
                );

                if (shouldGoInTop) {
                    // Show in top sticky, hide from bottom
                    this.setStickyElementVisibility(
                        this.topStickyContainer,
                        annotation.id,
                        true
                    );
                    this.setStickyElementVisibility(
                        this.bottomStickyContainer,
                        annotation.id,
                        false
                    );
                    // Scroll top sticky to the bottom to show latest annotations
                    this.topStickyContainer.scrollTo({
                        top: this.topStickyContainer.scrollHeight,
                        behavior: "smooth",
                    });
                } else {
                    // Show in bottom sticky, hide from top
                    this.setStickyElementVisibility(
                        this.topStickyContainer,
                        annotation.id,
                        false
                    );
                    this.setStickyElementVisibility(
                        this.bottomStickyContainer,
                        annotation.id,
                        true
                    );
                }
            }
        });
    }

    getVisibleAnnotationTimes() {
        const visibleTimes = [];

        // Get times from all visible annotations
        this.visibleElements.forEach((annotationId) => {
            const annotation = this.annotations.find(
                (a) => a.id === annotationId
            );
            if (annotation) {
                visibleTimes.push(annotation.time);
            }
        });

        return visibleTimes;
    }

    shouldCriticalAnnotationGoInTop(criticalAnnotation, visibleTimes) {
        // If no annotations are visible, we can't determine position reliably
        // Default to bottom container
        if (visibleTimes.length === 0) {
            return false;
        }

        // If the critical annotation's time is less than ANY of the visible times,
        // it should go in the top container (it's "before" the visible content)
        return visibleTimes.some(
            (visibleTime) => criticalAnnotation.time < visibleTime
        );
    }

    getTypeEmoji(type) {
        switch (type) {
            case "note":
                return "✏️";
            case "transcript":
                return "💬";
            case "action":
                return "⚾";
            case "event":
                return "🎉";
            default:
                return "✏️";
        }
    }

    getImportanceClass(importance) {
        switch (importance) {
            case "low":
                return "bg-gray-200 text-gray-800";
            case "medium":
                return "bg-blue-200 text-blue-800";
            case "high":
                return "bg-yellow-200 text-yellow-800";
            case "critical":
                return "bg-red-200 text-red-800";
            default:
                return "bg-gray-200 text-gray-800";
        }
    }

    createAnnotationElement(annotation, addClass = "") {
        const { div, span, button } = van.tags;
        const timeStr = timeUtil.format(annotation.time, true);
        const emoji = this.getTypeEmoji(annotation.type);
        const bgClass = this.getImportanceClass(annotation.importance);

        const result = div(
            {
                class: `relative group p-2 m-1 rounded text-sm ${bgClass} border-l-4 ${
                    annotation.importance === "critical"
                        ? "border-red-500"
                        : "border-gray-300"
                } ${addClass}`,
            },
            div(
                {
                    class: "cursor-pointer",
                    onclick: () => {
                        eventBus.fire("ui.requestTimeSeek", {
                            seconds: annotation.time,
                        });
                        this.userScrollPaused = false; // Resume auto-scrolling on click
                    },
                },
                span(`${emoji} ${annotation.content}`),
                span({ class: "text-gray-500 text-xs ml-1" }, `(${timeStr})`)
            ),
            // Three dots menu button - hidden by default, shown on group hover
            button(
                {
                    class: "absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-6 h-6 rounded-full bg-gray-600 bg-opacity-75 hover:bg-opacity-90 text-white text-xs flex items-center justify-center",
                    onclick: (e) => {
                        e.stopPropagation(); // Prevent the seek action
                        eventBus.fire("ui.editAnnotation", {
                            annotation: annotation,
                        });
                    },
                    title: "Edit annotation",
                },
                "⋯" // Three dots character
            )
        );

        result.dataset.id = annotation.id;
        result.dataset.importance = annotation.importance;
        result.dataset.time = annotation.time;

        return result;
    }

    createAnnotationElements() {
        if (!this.middleContainer || !this.annotations) return;

        const { div } = van.tags;

        // Create and add annotation elements
        if (this.annotations.length > 0) {
            const elements = this.annotations.map((annotation) =>
                this.createAnnotationElement(annotation)
            );

            // Add elements to DOM first
            van.add(this.middleContainer, ...elements);

            // Then observe them (after they're in the DOM)
            if (this.visibilityObserver) {
                elements.forEach((element) => {
                    this.visibilityObserver.observe(element);
                });
            }

            let criticalElements = this.annotations.filter(
                (a) => a.importance === "critical"
            );

            van.add(
                this.topStickyContainer,
                ...criticalElements.map((annotation) =>
                    this.createAnnotationElement(annotation, "hidden")
                )
            );

            van.add(
                this.bottomStickyContainer,
                ...criticalElements.map((annotation) =>
                    this.createAnnotationElement(annotation)
                )
            );
        } else {
            // No annotations available
            van.add(
                this.middleContainer,
                div(
                    { class: "p-4 text-center text-gray-500 text-sm" },
                    "No annotations for this event"
                )
            );
        }
    }

    reinitializeContainers() {
        if (
            !this.middleContainer ||
            !this.topStickyContainer ||
            !this.bottomStickyContainer
        ) {
            return;
        }

        // Clear all containers
        this.middleContainer.innerHTML = "";
        this.topStickyContainer.innerHTML = "";
        this.bottomStickyContainer.innerHTML = "";

        // Reset the visibility observer
        if (this.visibilityObserver) {
            this.visibilityObserver.disconnect();
        }
        this.visibleElements.clear();

        // Recreate all annotation elements
        this.createAnnotationElements();

        console.log("Annotation containers reinitialized");
    }

    // async editAnnotation(annotation) {
    //     try {
    //         // Show the annotation form pre-populated with existing data
    //         const updatedAnnotation = await annotations.showAnnotationForm(
    //             annotation.time,
    //             null, // No wallclock time for editing existing annotations
    //             annotation // Pass existing annotation for pre-population
    //         );

    //         if (updatedAnnotation) {
    //             console.log("Annotation updated:", updatedAnnotation);
    //             // The form will handle the update/delete, no need to do anything here
    //         }
    //     } catch (error) {
    //         console.error("Error editing annotation:", error);
    //         alert("Failed to edit annotation. Please try again.");
    //     }
    // }

    paint() {
        if (
            !this.middleContainer ||
            !this.annotations ||
            this.annotations.length === 0
        )
            return;

        // Find the annotation with the greatest time that is less than current time
        const lastPassedAnnotation = this.annotations
            .filter((annotation) => annotation.time <= this.currentTime)
            .pop(); // Since array is sorted, pop() gets the last (greatest time) element

        if (lastPassedAnnotation) {
            // Find the DOM element for this annotation and scroll it to the bottom
            const annotationElements = this.middleContainer.children;
            const annotationIndex =
                this.annotations.indexOf(lastPassedAnnotation);

            if (
                annotationIndex >= 0 &&
                annotationIndex < annotationElements.length
            ) {
                const targetElement = annotationElements[annotationIndex];

                // Use getBoundingClientRect for accurate positioning
                const containerRect =
                    this.middleContainer.getBoundingClientRect();
                const elementRect = targetElement.getBoundingClientRect();

                // Calculate how much we need to scroll to get the element at the bottom
                const containerBottom = containerRect.bottom;
                const elementBottom = elementRect.bottom;

                // If element is below the visible area, scroll down to show it at bottom
                if (elementBottom > containerBottom) {
                    // Check if user scroll is paused
                    if (!this.userScrollPaused) {
                        const scrollAmount = elementBottom - containerBottom;
                        const currentScrollTop = this.middleContainer.scrollTop;

                        // Set flag to indicate this is programmatic scrolling
                        this.isProgrammaticScroll = true;

                        this.middleContainer.scrollTo({
                            top: currentScrollTop + scrollAmount,
                            behavior: "smooth",
                        });
                    }
                }
                // If element is above the visible area, scroll up to show it at bottom
                else if (elementRect.top < containerRect.top) {
                    // Check if user scroll is paused
                    if (!this.userScrollPaused) {
                        const elementTop = elementRect.top;
                        const containerTop = containerRect.top;
                        const containerHeight = containerRect.height;
                        const elementHeight = elementRect.height;

                        const scrollAmount =
                            elementTop -
                            containerTop +
                            elementHeight -
                            containerHeight;
                        const currentScrollTop = this.middleContainer.scrollTop;

                        // Set flag to indicate this is programmatic scrolling
                        this.isProgrammaticScroll = true;

                        this.middleContainer.scrollTo({
                            top: Math.max(0, currentScrollTop + scrollAmount),
                            behavior: "smooth",
                        });
                    }
                }
            }
        }
    }
}

const annotationLog = new AnnotationLog();

//import { summaryEditor } from "./viz/summaryeditor.js";

class Reports {
    constructor() {
        this.hierarchy = this.getHierarchyFromPath() || null;
        this.currentCamera = 1;
        this.startTimeOffset = this.getTimeOffsetFromHash() || 0;
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.playlistUrl = this.hierarchy
            ? `/playlist/${this.hierarchy}-720p.m3u8`
            : null;

        this.score = scoring;

        this.transcript = [];
        this.tsIndex = 0;

        this.event = null;
        this.wallclockStartTimeUTC = null;
    }

    async changeHierarchy(hierarchy) {
        console.log("Changing hierarchy to:", hierarchy);

        this.player.pause();

        // TODO FIXME This is super brittle please refactor
        if (!hierarchy) {
            this.hierarchy = null;
            this.playlistUrl = null;
            this.hls.loadSource("");
            activeBoxManager.reset();
            this.score.resetWindow();
            events.current = null;
        } else {
            let h = new Hierarchy(hierarchy);
            this.hierarchy = h.toString("-");
            this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;
            this.startTimeOffset = 0;

            h.camera = 1;
            await events.getByHierarchy(h.toString(":"));
            await summarizer.ensure(this.hierarchy);
            this.changeCamera(1);
        }

        eventBus.fire("ui.hierarchyChanged", {
            hierarchy: this.hierarchy,
        });
    }

    // async loadTranscript() {
    //     const [token, date] = this.hierarchy.split("-");

    //     const url = `https://storage.roarscore.ai/production/play/${token}/${date}/transcript-${token}-${date}.txt`;

    //     try {
    //         let response = await fetch(url);

    //         if (response.ok) {
    //             let lines = await response.text();
    //             lines = lines.split(/\s*[\r\n]+\s*/);

    //             let offset = 0;
    //             let result = [];
    //             if (/^[\+\-]/.test(lines[0])) {
    //                 let line = lines.shift();
    //                 offset = timeUtil.toSeconds(line.substr(1), true);
    //                 if (line[0] == "-") offset = -offset;
    //             }

    //             while (lines.length) {
    //                 let t = lines.shift();
    //                 let msg = lines.shift();
    //                 t = timeUtil.toSeconds(t, true) + offset;
    //                 result.push({ time: t, msg: msg });
    //             }

    //             return result;
    //         }
    //     } catch (e) {
    //         console.log(`While fetching transcript: ${e}`);
    //     }

    //     return [];
    // }

    async init() {
        this.initListeners();

        await profiles.getById(this.profileId);
        // This is kind of hacky, todo fixme
        profilesData.profile = profiles.profile;

        this.event = await events.getByHierarchy(
            this.hierarchy?.replaceAll("-", ":")
        );

        this.addElements();

        await summarizer.ensure(this.hierarchy);

        //momentlist.update();

        //this.transcript = await this.loadTranscript();

        eventBus.fire("playback.ready", {
            hierarchy: this.hierarchy,
        });
    }

    changeCamera(camera) {
        console.log("Camera change requested:", camera);

        this.currentCamera = camera;
        let newHierarchy = this.hierarchy.split("-").slice(0, 2).join("-");
        newHierarchy += `-${camera.toString().padStart(2, "0")}`;
        this.hierarchy = newHierarchy;
        this.startTimeOffset = this.player.currentTime();
        console.log("Time offset set to:", this.startTimeOffset);
        this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;
        activeBoxManager.reset();
        this.score.resetWindow();
        this.hls.loadSource(this.playlistUrl);
        this.player.play();

        eventBus.fire("playback.cameraChanged", {
            camera: camera,
            hierarchy: this.hierarchy,
        });
    }

    initListeners() {
        eventBus.addEventListener("ui.requestTimeSeek", (e) => {
            let seconds = e.detail.seconds;

            if (!seconds) {
                const requestedTime = e.detail.time;
                seconds = timeUtil.toSeconds(requestedTime);
            }

            this.player.currentTime(seconds);
        });

        eventBus.addEventListener("ui.requestEvent", (e) => {
            const hierarchy = e.detail;
            console.log("Event selected:", hierarchy);

            this.changeHierarchy(hierarchy);
            //const pathname = `/reports/${hierarchy.replaceAll(":", "/")}`;
            //window.location.pathname = pathname;
        });

        eventBus.on("ui.requestEditMode", (e) => {
            const editContainer = document.getElementById("report-mode-edit");
            const viewContainer = document.getElementById("report-mode-view");
            editContainer.classList.remove("hidden");
            viewContainer.classList.add("hidden");
        });
        eventBus.on("ui.requestViewMode", (e) => {
            const editContainer = document.getElementById("report-mode-edit");
            const viewContainer = document.getElementById("report-mode-view");

            editContainer.classList.add("hidden");
            viewContainer.classList.remove("hidden");
        });
    }

    getHierarchyFromPath() {
        /**
         * Get the hierarchy from the URL path, if present.
         */
        const path = window.location.pathname;
        const parts = path.split("/");
        return parts.length > 4 ? parts.slice(2, 5).join("-") : null; // returns the hierarchy if present, otherwise null
    }

    getTimeOffsetFromHash() {
        if (window.location.hash) {
            const hash = window.location.hash.substring(1); // Remove the '#'
            const parts = hash.split(":");
            let result = 0;
            let multiplier = 1;

            for (let i = parts.length - 1; i >= 0; i--) {
                const value = parseInt(parts[i], 10);
                if (!isNaN(value)) {
                    result += value * multiplier;
                    multiplier *= 60;

                    if (multiplier > 3600) {
                        break; // Limit to 1 hour
                    }
                }
            }
            return result;
        }

        return 0;
    }

    addElements(parentElement) {
        const { div, main, video, canvas, button } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                div(
                    {
                        id: "report-container",
                        class: "flex flex-col md:flex-row gap-4 items-start",
                    },

                    // Left column
                    div(
                        {
                            id: "report-left",
                            class: "w-full md:w-auto md:flex-grow min-w-[150px] max-w-[250px]",
                        },

                        annotationLog.createElement()
                        //momentlist.createElement()
                    ),

                    // Video plus bottom metadata
                    div(
                        {
                            id: "report-center",
                            class: "w-full max-w-4xl flex flex-col",
                        },

                        // Event selector
                        events.createSelectorElement(
                            this.hierarchy?.replaceAll("-", ":")
                        ),

                        // Video section
                        div(
                            { class: "relative w-full pt-[62.8125%] mt-4" },
                            video({
                                id: "report-video",
                                class: "absolute top-0 left-0 w-full h-auto aspect-video video-js video-js-default-skin",

                                controls: true,
                                muted: true,
                            }),

                            // HEATMAP
                            heatmap.createElement({
                                class: "absolute top-0 left-0 w-full h-auto aspect-video z-10",
                            }),

                            div({
                                id: "video-controls",
                                class: "absolute bottom-0 left-0 w-full h-[30px]",
                            })
                        ),
                        // div(
                        //     {
                        //         id: "report-mode-edit",
                        //         class: "hidden",
                        //     },

                        //     summaryEditor.createElement()
                        // ),
                        div(
                            {
                                id: "report-mode-view",
                                class: "text-sm text-gray-700",
                            },

                            div({
                                id: "report-box-debug",
                                class: "hidden text-sm text-gray-700 bg-white p-2 border",
                            }),

                            div({ class: "" }, summaryGraph.createElement()),

                            div(
                                {
                                    class: "w-full h-auto aspect-[calc(16/2.5)] mt-2",
                                },
                                div(
                                    {
                                        class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                                    },

                                    genderDemo.createElement({
                                        id: "report-viz-demo-gender ",
                                    })
                                ),

                                div(
                                    {
                                        class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                                    },

                                    ageDemo.createElement({
                                        id: "report-viz-demo-age",
                                    })
                                )
                            )
                        ),

                        div(
                            {
                                class: "text-sm text-gray-700",
                            },
                            button(
                                {
                                    type: "button",
                                    class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600",
                                    onclick: () => {
                                        eventBus.fire(
                                            "ui.requestSummaryRebuild",
                                            {
                                                hierarchy: this.hierarchy,
                                            }
                                        );
                                    },
                                },
                                "Rebuild Summary"
                            ),

                            button(
                                {
                                    type: "button",
                                    class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 ml-4",
                                    onclick: () => {
                                        console.log("Add annotation");
                                        eventBus.fire("ui.addAnnotation", {
                                            hierarchy: this.hierarchy,
                                        });
                                    },
                                },
                                "Add Annotation"
                            ),

                            button(
                                {
                                    type: "button",
                                    class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 ml-4",
                                    onclick: () => {
                                        console.log("Import Transcript");
                                        eventBus.fire("ui.importTranscript", {
                                            hierarchy: this.hierarchy,
                                            event: this.event,
                                        });
                                    },
                                },
                                "Import Transcript"
                            ),

                            button(
                                {
                                    type: "button",
                                    class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 ml-4",
                                    onclick: () => {
                                        eventBus.fire("ui.requestExport");
                                    },
                                },
                                "Export as CSV"
                            )

                            // button(
                            //     {
                            //         type: "button",
                            //         class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 ml-4",
                            //         onclick: () => {
                            //             eventBus.fire("ui.requestEditMode");
                            //         },
                            //     },
                            //     "Edit Summary"
                            // )
                        )
                    ),

                    // Right column
                    div(
                        {
                            id: "report-right",
                            class: "w-full md:w-auto md:flex-grow min-w-[250px] max-w-[350px]",
                        },

                        // Camera map section
                        div(
                            {
                                class: "w-full h-auto aspect-[2] relative bg-white",
                            },

                            // CAMERA MAP
                            cameramap.createElement()
                        ),
                        // EKG section
                        div(
                            {
                                class: "w-full h-auto aspect-[2] mt-4 relative",
                            },

                            ekg.createElement()
                        ),

                        // Spider chart section
                        div(
                            {
                                class: "w-full h-auto aspect-square mt-4 relative bg-white",
                            },

                            spider.createElement()
                        ),

                        // Linked player
                        div(
                            {
                                id: "report-embed",
                                class: "w-full h-auto aspect-video mt-4 relative",
                            },
                            linkedPlayer.createElement()
                        )
                    )
                )
            )
        );

        document.getElementById("report-event-select").value = this.hierarchy;
        this.addPlayer();
        this.addHeatmapListeners();
        this.addCameraMapListeners();

        // TODO Move to event (DOM needs to be added before initializing YT)
        linkedPlayer.init();
    }

    addPlayer() {
        this.player = videojs("report-video");
        this.player.ready(() => {
            this.video = this.player.tech_.el_;

            this.hls = new Hls();
            this.hls.attachMedia(this.player.tech_.el_);

            if (this.playlistUrl) this.hls.loadSource(this.playlistUrl);

            this.hls.on(Hls.Events.LEVEL_LOADED, async (event, data) => {
                const fragments = data.details.fragments;
                this.fragments = fragments;

                this.wallclockStartTimeUTC = fragments[0].programDateTime;

                await this.score.initLoadSchedule(fragments);

                eventBus.fire("playback.loaded", {
                    duration: data.details.totalduration,
                    fragments: fragments,
                    wallclockStartTimeUTC: this.wallclockStartTimeUTC,
                });
            });

            // Correct Video.js event for when video starts playing
            this.player.on("play", () => {
                console.log("Video started playing");
                eventBus.fire("playback.play");

                if (this.startTimeOffset > 0) {
                    window.setTimeout(() => {
                        this.player.currentTime(this.startTimeOffset);
                        this.startTimeOffset = 0; // Reset after applying
                    }, 10);
                }
            });

            // Optional: Hide overlay when video is paused
            this.player.on("pause", () => {
                console.log("Video paused");
                eventBus.fire("playback.pause");
            });

            // Video.js time events
            this.player.on("timeupdate", async () => {
                if (this.isSeeking) return;

                const detail = {
                    currentTime: this.player.currentTime(),
                    duration: this.player.duration(),
                };

                eventBus.fire("playback.timeupdate", detail);

                await this.score.handleTimeUpdate(detail.currentTime);

                this.player.userActive(true); // Ensure active state
                this.player.controlBar.show(); // Force control bar to show
            });

            // Alternative: seeked event (when user seeks to a new position)
            this.player.on("seeked", async () => {
                this.isSeeking = false;
                const currentTime = this.player.currentTime();
                console.log("Seeked to time:", currentTime);
                await this.score.handleTimeSeek(currentTime);
                eventBus.fire("playback.timeseek", {
                    currentTime: currentTime,
                });
            });

            // Alternative: seeking event (while user is seeking)
            this.player.on("seeking", () => {
                this.isSeeking = true;
                const currentTime = this.player.currentTime();
                console.log("Seeking to time:", currentTime);
            });

            this.player.userActive(true); // Ensure active state
            this.player.controlBar.show(); // Force control bar to show
        });
    }

    // updateTranscript() {
    //     const currentTime = this.player.currentTime();
    //     if (!this.transcript || !this.transcript.length) return;

    //     if (
    //         this.transcript &&
    //         this.transcript[this.tsIndex].time > currentTime
    //     ) {
    //         this.tsIndex = 0;
    //     }

    //     while (
    //         this.transcript &&
    //         this.tsIndex < this.transcript.length - 1 &&
    //         this.transcript[this.tsIndex].time <= currentTime
    //     ) {
    //         this.tsIndex += 1;
    //     }

    //     if (
    //         this.transcript &&
    //         this.transcript[this.tsIndex] &&
    //         this.tsIndex > 0
    //     ) {
    //         const ts = this.transcript[this.tsIndex - 1];
    //         document.getElementById("report-current-play").innerText =
    //             "⚾️ " + timeUtil.format(ts.time, true) + " - " + ts.msg;
    //     }
    // }

    addHeatmapListeners() {
        eventBus.addEventListener("heatmap.click", (e) => {
            if (this.player.paused()) {
                this.player.play();
            } else {
                this.player.pause();
            }
        });

        eventBus.addEventListener("heatmap.mousemove", (e) => {
            const box = this.score.boxAt(e.detail.x, e.detail.y);

            if (box) {
                // Highlight the box or perform any action
                this.showBoxDebug(box);
            } else {
                this.hideBoxDebug();
            }
        });
    }

    addCameraMapListeners() {
        eventBus.addEventListener("ui.requestCamera", (e) => {
            this.changeCamera(e.detail.camera);
        });
    }

    showBoxDebug(box) {
        const debugDiv = document.getElementById("report-box-debug");
        debugDiv.classList.remove("hidden");

        const profile = profiles.profile.emotions;

        let html =
            '<table class="w-full"><tr><th>Emotion</th><th>Core</th><th>Confidence</th><th>Profile</th><th>Score</th></tr>';

        for (const emotion of box.row.emotions) {
            const score = emotion.score || 0;

            if (!emotion.coreName) continue;

            html +=
                `<tr><td>${emotion.name}</td>` +
                `<td>${emotion.coreName}</td>` +
                `<td>${emotion.confidence.toFixed(4)}</td>` +
                `<td>${profile[emotion.name]}</td>` +
                `<td>${score.toFixed(0)}</td></tr>`;
        }
        html +=
            `<tr><td colspan="4">t=${box.row.time.toFixed(4)}s</td>` +
            `<td><b>${box.row.score.toFixed(0)}</b></td></tr>`;
        html += "</table>";

        html += `<table class="w-full mt-2"><tr><th>Core</th><th>Score</th></tr>`;
        for (let coreName in box.row.cores) {
            const coreScore = box.row.cores[coreName].score.toFixed(0);
            html += `<tr><td>${coreName}</td><td>${coreScore}</td></tr>`;
        }
        html += "</table>";

        debugDiv.innerHTML = html;
    }

    hideBoxDebug() {
        const debugDiv = document.getElementById("report-box-debug");
        debugDiv.classList.add("hidden");
    }
}

const reports = new Reports();

if (typeof window !== "undefined") {
    window._vy_reports = reports;
}

export { Reports, reports };
//# sourceMappingURL=rsreports.js.map
