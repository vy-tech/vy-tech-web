import { v as van } from './chunks/van-t8DywzvC.js';
import { e as eventBus } from './chunks/eventbus-B9JUr222.js';
import { H as Hierarchy, a as activeBoxManager, g as geomUtil, s as scoring, d as demographics, p as profilesData } from './chunks/annotations-BA4X7erX.js';
import { s as summarizer } from './chunks/summarizer-4X4p5ndI.js';
import { a as annotations, p as profiles } from './chunks/annotations-Dg2xcxh1.js';
import { e as events } from './chunks/events-sdRw1Bkl.js';
import { t as timeUtil } from './chunks/events-0MH9oHuf.js';
import './chunks/db-BBYvHzlP.js';
import './chunks/firebase-omMfH1CX.js';

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
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = { ...options };

        this.container = div(merged);

        return this.container;
    }

    init() {
        const event = events.get();
        const embedVideo = event.embed;

        if (!embedVideo) {
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

function ascending$1(a, b) {
  return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function descending(a, b) {
  return a == null || b == null ? NaN
    : b < a ? -1
    : b > a ? 1
    : b >= a ? 0
    : NaN;
}

function bisector(f) {
  let compare1, compare2, delta;

  // If an accessor is specified, promote it to a comparator. In this case we
  // can test whether the search value is (self-) comparable. We can’t do this
  // for a comparator (except for specific, known comparators) because we can’t
  // tell if the comparator is symmetric, and an asymmetric comparator can’t be
  // used to test whether a single value is comparable.
  if (f.length !== 2) {
    compare1 = ascending$1;
    compare2 = (d, x) => ascending$1(f(d), x);
    delta = (d, x) => f(d) - x;
  } else {
    compare1 = f === ascending$1 || f === descending ? f : zero$1;
    compare2 = f;
    delta = f;
  }

  function left(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function right(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) <= 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function center(a, x, lo = 0, hi = a.length) {
    const i = left(a, x, lo, hi - 1);
    return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
  }

  return {left, center, right};
}

function zero$1() {
  return 0;
}

function number$2(x) {
  return x === null ? NaN : +x;
}

const ascendingBisect = bisector(ascending$1);
const bisectRight = ascendingBisect.right;
bisector(number$2).center;

function variance(values, valueof) {
  let count = 0;
  let delta;
  let mean = 0;
  let sum = 0;
  {
    for (let value of values) {
      if (value != null && (value = +value) >= value) {
        delta = value - mean;
        mean += delta / ++count;
        sum += delta * (value - mean);
      }
    }
  }
  if (count > 1) return sum / (count - 1);
}

function deviation(values, valueof) {
  const v = variance(values);
  return v ? Math.sqrt(v) : v;
}

const e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

function tickSpec(start, stop, count) {
  const step = (stop - start) / Math.max(0, count),
      power = Math.floor(Math.log10(step)),
      error = step / Math.pow(10, power),
      factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
  let i1, i2, inc;
  if (power < 0) {
    inc = Math.pow(10, -power) / factor;
    i1 = Math.round(start * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = Math.pow(10, power) * factor;
    i1 = Math.round(start / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2);
  return [i1, i2, inc];
}

function ticks(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start, [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  if (!(i2 >= i1)) return [];
  const n = i2 - i1 + 1, ticks = new Array(n);
  if (reverse) {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) / -inc;
    else for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) * inc;
  } else {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) / -inc;
    else for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) * inc;
  }
  return ticks;
}

function tickIncrement(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  return tickSpec(start, stop, count)[2];
}

function tickStep(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  const reverse = stop < start, inc = reverse ? tickIncrement(stop, start, count) : tickIncrement(start, stop, count);
  return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}

function mean(values, valueof) {
  let count = 0;
  let sum = 0;
  if (valueof === undefined) {
    for (let value of values) {
      if (value != null && (value = +value) >= value) {
        ++count, sum += value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null && (value = +value) >= value) {
        ++count, sum += value;
      }
    }
  }
  if (count) return sum / count;
}

function identity$3(x) {
  return x;
}

var top = 1,
    right = 2,
    bottom = 3,
    left = 4,
    epsilon$1 = 1e-6;

function translateX(x) {
  return "translate(" + x + ",0)";
}

function translateY(y) {
  return "translate(0," + y + ")";
}

function number$1(scale) {
  return d => +scale(d);
}

function center(scale, offset) {
  offset = Math.max(0, scale.bandwidth() - offset * 2) / 2;
  if (scale.round()) offset = Math.round(offset);
  return d => +scale(d) + offset;
}

function entering() {
  return !this.__axis;
}

function axis(orient, scale) {
  var tickArguments = [],
      tickValues = null,
      tickFormat = null,
      tickSizeInner = 6,
      tickSizeOuter = 6,
      tickPadding = 3,
      offset = typeof window !== "undefined" && window.devicePixelRatio > 1 ? 0 : 0.5,
      k = orient === top || orient === left ? -1 : 1,
      x = orient === left || orient === right ? "x" : "y",
      transform = orient === top || orient === bottom ? translateX : translateY;

  function axis(context) {
    var values = tickValues == null ? (scale.ticks ? scale.ticks.apply(scale, tickArguments) : scale.domain()) : tickValues,
        format = tickFormat == null ? (scale.tickFormat ? scale.tickFormat.apply(scale, tickArguments) : identity$3) : tickFormat,
        spacing = Math.max(tickSizeInner, 0) + tickPadding,
        range = scale.range(),
        range0 = +range[0] + offset,
        range1 = +range[range.length - 1] + offset,
        position = (scale.bandwidth ? center : number$1)(scale.copy(), offset),
        selection = context.selection ? context.selection() : context,
        path = selection.selectAll(".domain").data([null]),
        tick = selection.selectAll(".tick").data(values, scale).order(),
        tickExit = tick.exit(),
        tickEnter = tick.enter().append("g").attr("class", "tick"),
        line = tick.select("line"),
        text = tick.select("text");

    path = path.merge(path.enter().insert("path", ".tick")
        .attr("class", "domain")
        .attr("stroke", "currentColor"));

    tick = tick.merge(tickEnter);

    line = line.merge(tickEnter.append("line")
        .attr("stroke", "currentColor")
        .attr(x + "2", k * tickSizeInner));

    text = text.merge(tickEnter.append("text")
        .attr("fill", "currentColor")
        .attr(x, k * spacing)
        .attr("dy", orient === top ? "0em" : orient === bottom ? "0.71em" : "0.32em"));

    if (context !== selection) {
      path = path.transition(context);
      tick = tick.transition(context);
      line = line.transition(context);
      text = text.transition(context);

      tickExit = tickExit.transition(context)
          .attr("opacity", epsilon$1)
          .attr("transform", function(d) { return isFinite(d = position(d)) ? transform(d + offset) : this.getAttribute("transform"); });

      tickEnter
          .attr("opacity", epsilon$1)
          .attr("transform", function(d) { var p = this.parentNode.__axis; return transform((p && isFinite(p = p(d)) ? p : position(d)) + offset); });
    }

    tickExit.remove();

    path
        .attr("d", orient === left || orient === right
            ? (tickSizeOuter ? "M" + k * tickSizeOuter + "," + range0 + "H" + offset + "V" + range1 + "H" + k * tickSizeOuter : "M" + offset + "," + range0 + "V" + range1)
            : (tickSizeOuter ? "M" + range0 + "," + k * tickSizeOuter + "V" + offset + "H" + range1 + "V" + k * tickSizeOuter : "M" + range0 + "," + offset + "H" + range1));

    tick
        .attr("opacity", 1)
        .attr("transform", function(d) { return transform(position(d) + offset); });

    line
        .attr(x + "2", k * tickSizeInner);

    text
        .attr(x, k * spacing)
        .text(format);

    selection.filter(entering)
        .attr("fill", "none")
        .attr("font-size", 10)
        .attr("font-family", "sans-serif")
        .attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");

    selection
        .each(function() { this.__axis = position; });
  }

  axis.scale = function(_) {
    return arguments.length ? (scale = _, axis) : scale;
  };

  axis.ticks = function() {
    return tickArguments = Array.from(arguments), axis;
  };

  axis.tickArguments = function(_) {
    return arguments.length ? (tickArguments = _ == null ? [] : Array.from(_), axis) : tickArguments.slice();
  };

  axis.tickValues = function(_) {
    return arguments.length ? (tickValues = _ == null ? null : Array.from(_), axis) : tickValues && tickValues.slice();
  };

  axis.tickFormat = function(_) {
    return arguments.length ? (tickFormat = _, axis) : tickFormat;
  };

  axis.tickSize = function(_) {
    return arguments.length ? (tickSizeInner = tickSizeOuter = +_, axis) : tickSizeInner;
  };

  axis.tickSizeInner = function(_) {
    return arguments.length ? (tickSizeInner = +_, axis) : tickSizeInner;
  };

  axis.tickSizeOuter = function(_) {
    return arguments.length ? (tickSizeOuter = +_, axis) : tickSizeOuter;
  };

  axis.tickPadding = function(_) {
    return arguments.length ? (tickPadding = +_, axis) : tickPadding;
  };

  axis.offset = function(_) {
    return arguments.length ? (offset = +_, axis) : offset;
  };

  return axis;
}

function axisBottom(scale) {
  return axis(bottom, scale);
}

function axisLeft(scale) {
  return axis(left, scale);
}

var noop = {value: () => {}};

function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || (t in _) || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}

function Dispatch(_) {
  this._ = _;
}

function parseTypenames$1(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return {type: t, name: name};
  });
}

Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._,
        T = parseTypenames$1(typename + "", _),
        t,
        i = -1,
        n = T.length;

    // If no callback was specified, return the callback of the given type and name.
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get$1(_[t], typename.name))) return t;
      return;
    }

    // If a type was specified, set the callback for the given type and name.
    // Otherwise, if a null callback was specified, remove callbacks of the given name.
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
    }

    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};

function get$1(type, name) {
  for (var i = 0, n = type.length, c; i < n; ++i) {
    if ((c = type[i]).name === name) {
      return c.value;
    }
  }
}

function set$1(type, name, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name) {
      type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({name: name, value: callback});
  return type;
}

var xhtml = "http://www.w3.org/1999/xhtml";

var namespaces = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

function namespace(name) {
  var prefix = name += "", i = prefix.indexOf(":");
  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
  return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name; // eslint-disable-line no-prototype-builtins
}

function creatorInherit(name) {
  return function() {
    var document = this.ownerDocument,
        uri = this.namespaceURI;
    return uri === xhtml && document.documentElement.namespaceURI === xhtml
        ? document.createElement(name)
        : document.createElementNS(uri, name);
  };
}

function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}

function creator(name) {
  var fullname = namespace(name);
  return (fullname.local
      ? creatorFixed
      : creatorInherit)(fullname);
}

function none() {}

function selector(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

function selection_select(select) {
  if (typeof select !== "function") select = selector(select);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
      }
    }
  }

  return new Selection$1(subgroups, this._parents);
}

// Given something array like (or null), returns something that is strictly an
// array. This is used to ensure that array-like objects passed to d3.selectAll
// or selection.selectAll are converted into proper arrays when creating a
// selection; we don’t ever want to create a selection backed by a live
// HTMLCollection or NodeList. However, note that selection.selectAll will use a
// static NodeList as a group, since it safely derived from querySelectorAll.
function array$1(x) {
  return x == null ? [] : Array.isArray(x) ? x : Array.from(x);
}

function empty$1() {
  return [];
}

function selectorAll(selector) {
  return selector == null ? empty$1 : function() {
    return this.querySelectorAll(selector);
  };
}

function arrayAll(select) {
  return function() {
    return array$1(select.apply(this, arguments));
  };
}

function selection_selectAll(select) {
  if (typeof select === "function") select = arrayAll(select);
  else select = selectorAll(select);

  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        subgroups.push(select.call(node, node.__data__, i, group));
        parents.push(node);
      }
    }
  }

  return new Selection$1(subgroups, parents);
}

function matcher(selector) {
  return function() {
    return this.matches(selector);
  };
}

function childMatcher(selector) {
  return function(node) {
    return node.matches(selector);
  };
}

var find = Array.prototype.find;

function childFind(match) {
  return function() {
    return find.call(this.children, match);
  };
}

function childFirst() {
  return this.firstElementChild;
}

function selection_selectChild(match) {
  return this.select(match == null ? childFirst
      : childFind(typeof match === "function" ? match : childMatcher(match)));
}

var filter = Array.prototype.filter;

function children() {
  return Array.from(this.children);
}

function childrenFilter(match) {
  return function() {
    return filter.call(this.children, match);
  };
}

function selection_selectChildren(match) {
  return this.selectAll(match == null ? children
      : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}

function selection_filter(match) {
  if (typeof match !== "function") match = matcher(match);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }

  return new Selection$1(subgroups, this._parents);
}

function sparse(update) {
  return new Array(update.length);
}

function selection_enter() {
  return new Selection$1(this._enter || this._groups.map(sparse), this._parents);
}

function EnterNode(parent, datum) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum;
}

EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
  insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
  querySelector: function(selector) { return this._parent.querySelector(selector); },
  querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
};

function constant$3(x) {
  return function() {
    return x;
  };
}

function bindIndex(parent, group, enter, update, exit, data) {
  var i = 0,
      node,
      groupLength = group.length,
      dataLength = data.length;

  // Put any non-null nodes that fit into update.
  // Put any null nodes into enter.
  // Put any remaining data into enter.
  for (; i < dataLength; ++i) {
    if (node = group[i]) {
      node.__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }

  // Put any non-null nodes that don’t fit into exit.
  for (; i < groupLength; ++i) {
    if (node = group[i]) {
      exit[i] = node;
    }
  }
}

function bindKey(parent, group, enter, update, exit, data, key) {
  var i,
      node,
      nodeByKeyValue = new Map,
      groupLength = group.length,
      dataLength = data.length,
      keyValues = new Array(groupLength),
      keyValue;

  // Compute the key for each node.
  // If multiple nodes have the same key, the duplicates are added to exit.
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }

  // Compute the key for each datum.
  // If there a node associated with this key, join and add it to update.
  // If there is not (or the key is a duplicate), add it to enter.
  for (i = 0; i < dataLength; ++i) {
    keyValue = key.call(parent, data[i], i, data) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i] = node;
      node.__data__ = data[i];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }

  // Add any remaining nodes that were not bound to data to exit.
  for (i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && (nodeByKeyValue.get(keyValues[i]) === node)) {
      exit[i] = node;
    }
  }
}

function datum(node) {
  return node.__data__;
}

function selection_data(value, key) {
  if (!arguments.length) return Array.from(this, datum);

  var bind = key ? bindKey : bindIndex,
      parents = this._parents,
      groups = this._groups;

  if (typeof value !== "function") value = constant$3(value);

  for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
    var parent = parents[j],
        group = groups[j],
        groupLength = group.length,
        data = arraylike(value.call(parent, parent && parent.__data__, j, parents)),
        dataLength = data.length,
        enterGroup = enter[j] = new Array(dataLength),
        updateGroup = update[j] = new Array(dataLength),
        exitGroup = exit[j] = new Array(groupLength);

    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

    // Now connect the enter nodes to their following update node, such that
    // appendChild can insert the materialized enter node before this node,
    // rather than at the end of the parent node.
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength);
        previous._next = next || null;
      }
    }
  }

  update = new Selection$1(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}

// Given some data, this returns an array-like view of it: an object that
// exposes a length property and allows numeric indexing. Note that unlike
// selectAll, this isn’t worried about “live” collections because the resulting
// array will only be used briefly while data is being bound. (It is possible to
// cause the data to change while iterating by using a key function, but please
// don’t; we’d rather avoid a gratuitous copy.)
function arraylike(data) {
  return typeof data === "object" && "length" in data
    ? data // Array, TypedArray, NodeList, array-like
    : Array.from(data); // Map, Set, iterable, string, or anything else
}

function selection_exit() {
  return new Selection$1(this._exit || this._groups.map(sparse), this._parents);
}

function selection_join(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  if (typeof onenter === "function") {
    enter = onenter(enter);
    if (enter) enter = enter.selection();
  } else {
    enter = enter.append(onenter + "");
  }
  if (onupdate != null) {
    update = onupdate(update);
    if (update) update = update.selection();
  }
  if (onexit == null) exit.remove(); else onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}

function selection_merge(context) {
  var selection = context.selection ? context.selection() : context;

  for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }

  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }

  return new Selection$1(merges, this._parents);
}

function selection_order() {

  for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
    for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
      if (node = group[i]) {
        if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }

  return this;
}

function selection_sort(compare) {
  if (!compare) compare = ascending;

  function compareNode(a, b) {
    return a && b ? compare(a.__data__, b.__data__) : !a - !b;
  }

  for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        sortgroup[i] = node;
      }
    }
    sortgroup.sort(compareNode);
  }

  return new Selection$1(sortgroups, this._parents).order();
}

function ascending(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function selection_call() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

function selection_nodes() {
  return Array.from(this);
}

function selection_node() {

  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
      var node = group[i];
      if (node) return node;
    }
  }

  return null;
}

function selection_size() {
  let size = 0;
  for (const node of this) ++size; // eslint-disable-line no-unused-vars
  return size;
}

function selection_empty() {
  return !this.node();
}

function selection_each(callback) {

  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) callback.call(node, node.__data__, i, group);
    }
  }

  return this;
}

function attrRemove$1(name) {
  return function() {
    this.removeAttribute(name);
  };
}

function attrRemoveNS$1(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}

function attrConstant$1(name, value) {
  return function() {
    this.setAttribute(name, value);
  };
}

function attrConstantNS$1(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}

function attrFunction$1(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttribute(name);
    else this.setAttribute(name, v);
  };
}

function attrFunctionNS$1(fullname, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v);
  };
}

function selection_attr(name, value) {
  var fullname = namespace(name);

  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local
        ? node.getAttributeNS(fullname.space, fullname.local)
        : node.getAttribute(fullname);
  }

  return this.each((value == null
      ? (fullname.local ? attrRemoveNS$1 : attrRemove$1) : (typeof value === "function"
      ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)
      : (fullname.local ? attrConstantNS$1 : attrConstant$1)))(fullname, value));
}

function defaultView(node) {
  return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
      || (node.document && node) // node is a Window
      || node.defaultView; // node is a Document
}

function styleRemove$1(name) {
  return function() {
    this.style.removeProperty(name);
  };
}

function styleConstant$1(name, value, priority) {
  return function() {
    this.style.setProperty(name, value, priority);
  };
}

function styleFunction$1(name, value, priority) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.style.removeProperty(name);
    else this.style.setProperty(name, v, priority);
  };
}

function selection_style(name, value, priority) {
  return arguments.length > 1
      ? this.each((value == null
            ? styleRemove$1 : typeof value === "function"
            ? styleFunction$1
            : styleConstant$1)(name, value, priority == null ? "" : priority))
      : styleValue(this.node(), name);
}

function styleValue(node, name) {
  return node.style.getPropertyValue(name)
      || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
}

function propertyRemove(name) {
  return function() {
    delete this[name];
  };
}

function propertyConstant(name, value) {
  return function() {
    this[name] = value;
  };
}

function propertyFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) delete this[name];
    else this[name] = v;
  };
}

function selection_property(name, value) {
  return arguments.length > 1
      ? this.each((value == null
          ? propertyRemove : typeof value === "function"
          ? propertyFunction
          : propertyConstant)(name, value))
      : this.node()[name];
}

function classArray(string) {
  return string.trim().split(/^|\s+/);
}

function classList(node) {
  return node.classList || new ClassList(node);
}

function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}

ClassList.prototype = {
  add: function(name) {
    var i = this._names.indexOf(name);
    if (i < 0) {
      this._names.push(name);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name) {
    var i = this._names.indexOf(name);
    if (i >= 0) {
      this._names.splice(i, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name) {
    return this._names.indexOf(name) >= 0;
  }
};

function classedAdd(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.add(names[i]);
}

function classedRemove(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.remove(names[i]);
}

function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}

function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}

function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}

function selection_classed(name, value) {
  var names = classArray(name + "");

  if (arguments.length < 2) {
    var list = classList(this.node()), i = -1, n = names.length;
    while (++i < n) if (!list.contains(names[i])) return false;
    return true;
  }

  return this.each((typeof value === "function"
      ? classedFunction : value
      ? classedTrue
      : classedFalse)(names, value));
}

function textRemove() {
  this.textContent = "";
}

function textConstant$1(value) {
  return function() {
    this.textContent = value;
  };
}

function textFunction$1(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.textContent = v == null ? "" : v;
  };
}

function selection_text(value) {
  return arguments.length
      ? this.each(value == null
          ? textRemove : (typeof value === "function"
          ? textFunction$1
          : textConstant$1)(value))
      : this.node().textContent;
}

function htmlRemove() {
  this.innerHTML = "";
}

function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}

function htmlFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.innerHTML = v == null ? "" : v;
  };
}

function selection_html(value) {
  return arguments.length
      ? this.each(value == null
          ? htmlRemove : (typeof value === "function"
          ? htmlFunction
          : htmlConstant)(value))
      : this.node().innerHTML;
}

function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}

function selection_raise() {
  return this.each(raise);
}

function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}

function selection_lower() {
  return this.each(lower);
}

function selection_append(name) {
  var create = typeof name === "function" ? name : creator(name);
  return this.select(function() {
    return this.appendChild(create.apply(this, arguments));
  });
}

function constantNull() {
  return null;
}

function selection_insert(name, before) {
  var create = typeof name === "function" ? name : creator(name),
      select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
  return this.select(function() {
    return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}

function selection_remove() {
  return this.each(remove);
}

function selection_cloneShallow() {
  var clone = this.cloneNode(false), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}

function selection_cloneDeep() {
  var clone = this.cloneNode(true), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}

function selection_clone(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

function selection_datum(value) {
  return arguments.length
      ? this.property("__data__", value)
      : this.node().__data__;
}

function contextListener(listener) {
  return function(event) {
    listener.call(this, event, this.__data__);
  };
}

function parseTypenames(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    return {type: t, name: name};
  });
}

function onRemove(typename) {
  return function() {
    var on = this.__on;
    if (!on) return;
    for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
      } else {
        on[++i] = o;
      }
    }
    if (++i) on.length = i;
    else delete this.__on;
  };
}

function onAdd(typename, value, options) {
  return function() {
    var on = this.__on, o, listener = contextListener(value);
    if (on) for (var j = 0, m = on.length; j < m; ++j) {
      if ((o = on[j]).type === typename.type && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
        this.addEventListener(o.type, o.listener = listener, o.options = options);
        o.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, options);
    o = {type: typename.type, name: typename.name, value: value, listener: listener, options: options};
    if (!on) this.__on = [o];
    else on.push(o);
  };
}

function selection_on(typename, value, options) {
  var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;

  if (arguments.length < 2) {
    var on = this.node().__on;
    if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
      for (i = 0, o = on[j]; i < n; ++i) {
        if ((t = typenames[i]).type === o.type && t.name === o.name) {
          return o.value;
        }
      }
    }
    return;
  }

  on = value ? onAdd : onRemove;
  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
  return this;
}

function dispatchEvent(node, type, params) {
  var window = defaultView(node),
      event = window.CustomEvent;

  if (typeof event === "function") {
    event = new event(type, params);
  } else {
    event = window.document.createEvent("Event");
    if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type, false, false);
  }

  node.dispatchEvent(event);
}

function dispatchConstant(type, params) {
  return function() {
    return dispatchEvent(this, type, params);
  };
}

function dispatchFunction(type, params) {
  return function() {
    return dispatchEvent(this, type, params.apply(this, arguments));
  };
}

function selection_dispatch(type, params) {
  return this.each((typeof params === "function"
      ? dispatchFunction
      : dispatchConstant)(type, params));
}

function* selection_iterator() {
  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) yield node;
    }
  }
}

var root = [null];

function Selection$1(groups, parents) {
  this._groups = groups;
  this._parents = parents;
}

function selection() {
  return new Selection$1([[document.documentElement]], root);
}

function selection_selection() {
  return this;
}

Selection$1.prototype = selection.prototype = {
  constructor: Selection$1,
  select: selection_select,
  selectAll: selection_selectAll,
  selectChild: selection_selectChild,
  selectChildren: selection_selectChildren,
  filter: selection_filter,
  data: selection_data,
  enter: selection_enter,
  exit: selection_exit,
  join: selection_join,
  merge: selection_merge,
  selection: selection_selection,
  order: selection_order,
  sort: selection_sort,
  call: selection_call,
  nodes: selection_nodes,
  node: selection_node,
  size: selection_size,
  empty: selection_empty,
  each: selection_each,
  attr: selection_attr,
  style: selection_style,
  property: selection_property,
  classed: selection_classed,
  text: selection_text,
  html: selection_html,
  raise: selection_raise,
  lower: selection_lower,
  append: selection_append,
  insert: selection_insert,
  remove: selection_remove,
  clone: selection_clone,
  datum: selection_datum,
  on: selection_on,
  dispatch: selection_dispatch,
  [Symbol.iterator]: selection_iterator
};

function select(selector) {
  return typeof selector === "string"
      ? new Selection$1([[document.querySelector(selector)]], [document.documentElement])
      : new Selection$1([[selector]], root);
}

function sourceEvent(event) {
  let sourceEvent;
  while (sourceEvent = event.sourceEvent) event = sourceEvent;
  return event;
}

function pointer(event, node) {
  event = sourceEvent(event);
  if (node === undefined) node = event.currentTarget;
  if (node) {
    var svg = node.ownerSVGElement || node;
    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = event.clientX, point.y = event.clientY;
      point = point.matrixTransform(node.getScreenCTM().inverse());
      return [point.x, point.y];
    }
    if (node.getBoundingClientRect) {
      var rect = node.getBoundingClientRect();
      return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
    }
  }
  return [event.pageX, event.pageY];
}

// These are typically used in conjunction with noevent to ensure that we can
// preventDefault on the event.
const nonpassivecapture = {capture: true, passive: false};

function noevent$1(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function dragDisable(view) {
  var root = view.document.documentElement,
      selection = select(view).on("dragstart.drag", noevent$1, nonpassivecapture);
  if ("onselectstart" in root) {
    selection.on("selectstart.drag", noevent$1, nonpassivecapture);
  } else {
    root.__noselect = root.style.MozUserSelect;
    root.style.MozUserSelect = "none";
  }
}

function yesdrag(view, noclick) {
  var root = view.document.documentElement,
      selection = select(view).on("dragstart.drag", null);
  if (noclick) {
    selection.on("click.drag", noevent$1, nonpassivecapture);
    setTimeout(function() { selection.on("click.drag", null); }, 0);
  }
  if ("onselectstart" in root) {
    selection.on("selectstart.drag", null);
  } else {
    root.style.MozUserSelect = root.__noselect;
    delete root.__noselect;
  }
}

function define(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}

function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

function Color() {}

var darker = 0.7;
var brighter = 1 / darker;

var reI = "\\s*([+-]?\\d+)\\s*",
    reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*",
    reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
    reHex = /^#([0-9a-f]{3,8})$/,
    reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`),
    reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`),
    reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`),
    reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`),
    reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`),
    reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);

var named = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
};

define(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor, this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex, // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});

function color_formatHex() {
  return this.rgb().formatHex();
}

function color_formatHex8() {
  return this.rgb().formatHex8();
}

function color_formatHsl() {
  return hslConvert(this).formatHsl();
}

function color_formatRgb() {
  return this.rgb().formatRgb();
}

function color(format) {
  var m, l;
  format = (format + "").trim().toLowerCase();
  return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
      : l === 3 ? new Rgb((m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1) // #f00
      : l === 8 ? rgba(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
      : l === 4 ? rgba((m >> 12 & 0xf) | (m >> 8 & 0xf0), (m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), (((m & 0xf) << 4) | (m & 0xf)) / 0xff) // #f000
      : null) // invalid hex
      : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
      : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
      : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
      : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
      : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
      : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
      : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
      : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
      : null;
}

function rgbn(n) {
  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
}

function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}

function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb;
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}

function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

define(Rgb, rgb, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return (-0.5 <= this.r && this.r < 255.5)
        && (-0.5 <= this.g && this.g < 255.5)
        && (-0.5 <= this.b && this.b < 255.5)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex, // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));

function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}

function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}

function rgb_formatRgb() {
  const a = clampa(this.opacity);
  return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}

function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}

function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}

function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}

function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}

function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl;
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      h = NaN,
      s = max - min,
      l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}

function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}

function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < 0.5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
        && (0 <= this.l && this.l <= 1)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
  }
}));

function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}

function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}

/* From FvD 13.37, CSS Color Module Level 3 */
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60
      : h < 180 ? m2
      : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
      : m1) * 255;
}

var constant$2 = x => () => x;

function linear$1(a, d) {
  return function(t) {
    return a + t * d;
  };
}

function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
    return Math.pow(a + t * b, y);
  };
}

function gamma(y) {
  return (y = +y) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y) : constant$2(isNaN(a) ? b : a);
  };
}

function nogamma(a, b) {
  var d = b - a;
  return d ? linear$1(a, d) : constant$2(isNaN(a) ? b : a);
}

var interpolateRgb = (function rgbGamma(y) {
  var color = gamma(y);

  function rgb$1(start, end) {
    var r = color((start = rgb(start)).r, (end = rgb(end)).r),
        g = color(start.g, end.g),
        b = color(start.b, end.b),
        opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.r = r(t);
      start.g = g(t);
      start.b = b(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }

  rgb$1.gamma = rgbGamma;

  return rgb$1;
})(1);

function numberArray(a, b) {
  if (!b) b = [];
  var n = a ? Math.min(b.length, a.length) : 0,
      c = b.slice(),
      i;
  return function(t) {
    for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
    return c;
  };
}

function isNumberArray(x) {
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}

function genericArray(a, b) {
  var nb = b ? b.length : 0,
      na = a ? Math.min(nb, a.length) : 0,
      x = new Array(na),
      c = new Array(nb),
      i;

  for (i = 0; i < na; ++i) x[i] = interpolate$1(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];

  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x[i](t);
    return c;
  };
}

function date(a, b) {
  var d = new Date;
  return a = +a, b = +b, function(t) {
    return d.setTime(a * (1 - t) + b * t), d;
  };
}

function interpolateNumber(a, b) {
  return a = +a, b = +b, function(t) {
    return a * (1 - t) + b * t;
  };
}

function object(a, b) {
  var i = {},
      c = {},
      k;

  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};

  for (k in b) {
    if (k in a) {
      i[k] = interpolate$1(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }

  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
    reB = new RegExp(reA.source, "g");

function zero(b) {
  return function() {
    return b;
  };
}

function one(b) {
  return function(t) {
    return b(t) + "";
  };
}

function interpolateString(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
      am, // current match in a
      bm, // current match in b
      bs, // string preceding current number in b, if any
      i = -1, // index in s
      s = [], // string constants and placeholders
      q = []; // number interpolators

  // Coerce inputs to strings.
  a = a + "", b = b + "";

  // Interpolate pairs of numbers in a & b.
  while ((am = reA.exec(a))
      && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) { // a string precedes the next number in b
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
      if (s[i]) s[i] += bm; // coalesce with previous string
      else s[++i] = bm;
    } else { // interpolate non-matching numbers
      s[++i] = null;
      q.push({i: i, x: interpolateNumber(am, bm)});
    }
    bi = reB.lastIndex;
  }

  // Add remains of b.
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs; // coalesce with previous string
    else s[++i] = bs;
  }

  // Special optimization for only a single match.
  // Otherwise, interpolate each of the numbers and rejoin the string.
  return s.length < 2 ? (q[0]
      ? one(q[0].x)
      : zero(b))
      : (b = q.length, function(t) {
          for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
          return s.join("");
        });
}

function interpolate$1(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant$2(b)
      : (t === "number" ? interpolateNumber
      : t === "string" ? ((c = color(b)) ? (b = c, interpolateRgb) : interpolateString)
      : b instanceof color ? interpolateRgb
      : b instanceof Date ? date
      : isNumberArray(b) ? numberArray
      : Array.isArray(b) ? genericArray
      : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
      : interpolateNumber)(a, b);
}

function interpolateRound(a, b) {
  return a = +a, b = +b, function(t) {
    return Math.round(a * (1 - t) + b * t);
  };
}

var degrees = 180 / Math.PI;

var identity$2 = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};

function decompose(a, b, c, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX: scaleX,
    scaleY: scaleY
  };
}

var svgNode;

/* eslint-disable no-undef */
function parseCss(value) {
  const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
  return m.isIdentity ? identity$2 : decompose(m.a, m.b, m.c, m.d, m.e, m.f);
}

function parseSvg(value) {
  if (value == null) return identity$2;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity$2;
  value = value.matrix;
  return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
}

function interpolateTransform(parse, pxComma, pxParen, degParen) {

  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }

  function translate(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }

  function rotate(a, b, s, q) {
    if (a !== b) {
      if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
      q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: interpolateNumber(a, b)});
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }

  function skewX(a, b, s, q) {
    if (a !== b) {
      q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: interpolateNumber(a, b)});
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }

  function scale(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }

  return function(a, b) {
    var s = [], // string constants and placeholders
        q = []; // number interpolators
    a = parse(a), b = parse(b);
    translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
    rotate(a.rotate, b.rotate, s, q);
    skewX(a.skewX, b.skewX, s, q);
    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
    a = b = null; // gc
    return function(t) {
      var i = -1, n = q.length, o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
}

var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

var frame = 0, // is an animation frame pending?
    timeout$1 = 0, // is a timeout pending?
    interval = 0, // are any timers active?
    pokeDelay = 1000, // how frequently we check for clock skew
    taskHead,
    taskTail,
    clockLast = 0,
    clockNow = 0,
    clockSkew = 0,
    clock = typeof performance === "object" && performance.now ? performance : Date,
    setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}

function clearNow() {
  clockNow = 0;
}

function Timer() {
  this._call =
  this._time =
  this._next = null;
}

Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};

function timer(callback, delay, time) {
  var t = new Timer;
  t.restart(callback, delay, time);
  return t;
}

function timerFlush() {
  now(); // Get the current time, if not already set.
  ++frame; // Pretend we’ve set an alarm, if we haven’t already.
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(undefined, e);
    t = t._next;
  }
  --frame;
}

function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout$1 = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}

function poke() {
  var now = clock.now(), delay = now - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
}

function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}

function sleep(time) {
  if (frame) return; // Soonest alarm already set, or will be.
  if (timeout$1) timeout$1 = clearTimeout(timeout$1);
  var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
  if (delay > 24) {
    if (time < Infinity) timeout$1 = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

function timeout(callback, delay, time) {
  var t = new Timer;
  delay = delay == null ? 0 : +delay;
  t.restart(elapsed => {
    t.stop();
    callback(elapsed + delay);
  }, delay, time);
  return t;
}

var emptyOn = dispatch("start", "end", "cancel", "interrupt");
var emptyTween = [];

var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;

function schedule(node, name, id, index, group, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id in schedules) return;
  create(node, id, {
    name: name,
    index: index, // For context during callback.
    group: group, // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}

function init(node, id) {
  var schedule = get(node, id);
  if (schedule.state > CREATED) throw new Error("too late; already scheduled");
  return schedule;
}

function set(node, id) {
  var schedule = get(node, id);
  if (schedule.state > STARTED) throw new Error("too late; already running");
  return schedule;
}

function get(node, id) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
  return schedule;
}

function create(node, id, self) {
  var schedules = node.__transition,
      tween;

  // Initialize the self timer when the transition is created.
  // Note the actual delay is not known until the first callback!
  schedules[id] = self;
  self.timer = timer(schedule, 0, self.time);

  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start, self.delay, self.time);

    // If the elapsed delay is less than our first sleep, start immediately.
    if (self.delay <= elapsed) start(elapsed - self.delay);
  }

  function start(elapsed) {
    var i, j, n, o;

    // If the state is not SCHEDULED, then we previously errored on start.
    if (self.state !== SCHEDULED) return stop();

    for (i in schedules) {
      o = schedules[i];
      if (o.name !== self.name) continue;

      // While this element already has a starting transition during this frame,
      // defer starting an interrupting transition until that transition has a
      // chance to tick (and possibly end); see d3/d3-transition#54!
      if (o.state === STARTED) return timeout(start);

      // Interrupt the active transition, if any.
      if (o.state === RUNNING) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("interrupt", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }

      // Cancel any pre-empted transitions.
      else if (+i < id) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("cancel", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }
    }

    // Defer the first tick to end of the current frame; see d3/d3#1576.
    // Note the transition may be canceled after start and before the first tick!
    // Note this must be scheduled before the start event; see d3/d3-transition#16!
    // Assuming this is successful, subsequent callbacks go straight to tick.
    timeout(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });

    // Dispatch the start event.
    // Note this must be done before the tween are initialized.
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return; // interrupted
    self.state = STARTED;

    // Initialize the tween, deleting null tween.
    tween = new Array(n = self.tween.length);
    for (i = 0, j = -1; i < n; ++i) {
      if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j] = o;
      }
    }
    tween.length = j + 1;
  }

  function tick(elapsed) {
    var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
        i = -1,
        n = tween.length;

    while (++i < n) {
      tween[i].call(node, t);
    }

    // Dispatch the end event.
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }

  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id];
    for (var i in schedules) return; // eslint-disable-line no-unused-vars
    delete node.__transition;
  }
}

function interrupt(node, name) {
  var schedules = node.__transition,
      schedule,
      active,
      empty = true,
      i;

  if (!schedules) return;

  name = name == null ? null : name + "";

  for (i in schedules) {
    if ((schedule = schedules[i]).name !== name) { empty = false; continue; }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i];
  }

  if (empty) delete node.__transition;
}

function selection_interrupt(name) {
  return this.each(function() {
    interrupt(this, name);
  });
}

function tweenRemove(id, name) {
  var tween0, tween1;
  return function() {
    var schedule = set(this, id),
        tween = schedule.tween;

    // If this node shared tween with the previous node,
    // just assign the updated shared tween and we’re done!
    // Otherwise, copy-on-write.
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1 = tween1.slice();
          tween1.splice(i, 1);
          break;
        }
      }
    }

    schedule.tween = tween1;
  };
}

function tweenFunction(id, name, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error;
  return function() {
    var schedule = set(this, id),
        tween = schedule.tween;

    // If this node shared tween with the previous node,
    // just assign the updated shared tween and we’re done!
    // Otherwise, copy-on-write.
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1[i] = t;
          break;
        }
      }
      if (i === n) tween1.push(t);
    }

    schedule.tween = tween1;
  };
}

function transition_tween(name, value) {
  var id = this._id;

  name += "";

  if (arguments.length < 2) {
    var tween = get(this.node(), id).tween;
    for (var i = 0, n = tween.length, t; i < n; ++i) {
      if ((t = tween[i]).name === name) {
        return t.value;
      }
    }
    return null;
  }

  return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
}

function tweenValue(transition, name, value) {
  var id = transition._id;

  transition.each(function() {
    var schedule = set(this, id);
    (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
  });

  return function(node) {
    return get(node, id).value[name];
  };
}

function interpolate(a, b) {
  var c;
  return (typeof b === "number" ? interpolateNumber
      : b instanceof color ? interpolateRgb
      : (c = color(b)) ? (b = c, interpolateRgb)
      : interpolateString)(a, b);
}

function attrRemove(name) {
  return function() {
    this.removeAttribute(name);
  };
}

function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}

function attrConstant(name, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = this.getAttribute(name);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function attrConstantNS(fullname, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function attrFunction(name, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttribute(name);
    string0 = this.getAttribute(name);
    string1 = value1 + "";
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function attrFunctionNS(fullname, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function transition_attr(name, value) {
  var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
  return this.attrTween(name, typeof value === "function"
      ? (fullname.local ? attrFunctionNS : attrFunction)(fullname, i, tweenValue(this, "attr." + name, value))
      : value == null ? (fullname.local ? attrRemoveNS : attrRemove)(fullname)
      : (fullname.local ? attrConstantNS : attrConstant)(fullname, i, value));
}

function attrInterpolate(name, i) {
  return function(t) {
    this.setAttribute(name, i.call(this, t));
  };
}

function attrInterpolateNS(fullname, i) {
  return function(t) {
    this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
  };
}

function attrTweenNS(fullname, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
    return t0;
  }
  tween._value = value;
  return tween;
}

function attrTween(name, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
    return t0;
  }
  tween._value = value;
  return tween;
}

function transition_attrTween(name, value) {
  var key = "attr." + name;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  var fullname = namespace(name);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

function delayFunction(id, value) {
  return function() {
    init(this, id).delay = +value.apply(this, arguments);
  };
}

function delayConstant(id, value) {
  return value = +value, function() {
    init(this, id).delay = value;
  };
}

function transition_delay(value) {
  var id = this._id;

  return arguments.length
      ? this.each((typeof value === "function"
          ? delayFunction
          : delayConstant)(id, value))
      : get(this.node(), id).delay;
}

function durationFunction(id, value) {
  return function() {
    set(this, id).duration = +value.apply(this, arguments);
  };
}

function durationConstant(id, value) {
  return value = +value, function() {
    set(this, id).duration = value;
  };
}

function transition_duration(value) {
  var id = this._id;

  return arguments.length
      ? this.each((typeof value === "function"
          ? durationFunction
          : durationConstant)(id, value))
      : get(this.node(), id).duration;
}

function easeConstant(id, value) {
  if (typeof value !== "function") throw new Error;
  return function() {
    set(this, id).ease = value;
  };
}

function transition_ease(value) {
  var id = this._id;

  return arguments.length
      ? this.each(easeConstant(id, value))
      : get(this.node(), id).ease;
}

function easeVarying(id, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (typeof v !== "function") throw new Error;
    set(this, id).ease = v;
  };
}

function transition_easeVarying(value) {
  if (typeof value !== "function") throw new Error;
  return this.each(easeVarying(this._id, value));
}

function transition_filter(match) {
  if (typeof match !== "function") match = matcher(match);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }

  return new Transition(subgroups, this._parents, this._name, this._id);
}

function transition_merge(transition) {
  if (transition._id !== this._id) throw new Error;

  for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }

  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }

  return new Transition(merges, this._parents, this._name, this._id);
}

function start(name) {
  return (name + "").trim().split(/^|\s+/).every(function(t) {
    var i = t.indexOf(".");
    if (i >= 0) t = t.slice(0, i);
    return !t || t === "start";
  });
}

function onFunction(id, name, listener) {
  var on0, on1, sit = start(name) ? init : set;
  return function() {
    var schedule = sit(this, id),
        on = schedule.on;

    // If this node shared a dispatch with the previous node,
    // just assign the updated shared dispatch and we’re done!
    // Otherwise, copy-on-write.
    if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

    schedule.on = on1;
  };
}

function transition_on(name, listener) {
  var id = this._id;

  return arguments.length < 2
      ? get(this.node(), id).on.on(name)
      : this.each(onFunction(id, name, listener));
}

function removeFunction(id) {
  return function() {
    var parent = this.parentNode;
    for (var i in this.__transition) if (+i !== id) return;
    if (parent) parent.removeChild(this);
  };
}

function transition_remove() {
  return this.on("end.remove", removeFunction(this._id));
}

function transition_select(select) {
  var name = this._name,
      id = this._id;

  if (typeof select !== "function") select = selector(select);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
        schedule(subgroup[i], name, id, i, subgroup, get(node, id));
      }
    }
  }

  return new Transition(subgroups, this._parents, name, id);
}

function transition_selectAll(select) {
  var name = this._name,
      id = this._id;

  if (typeof select !== "function") select = selectorAll(select);

  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        for (var children = select.call(node, node.__data__, i, group), child, inherit = get(node, id), k = 0, l = children.length; k < l; ++k) {
          if (child = children[k]) {
            schedule(child, name, id, k, children, inherit);
          }
        }
        subgroups.push(children);
        parents.push(node);
      }
    }
  }

  return new Transition(subgroups, parents, name, id);
}

var Selection = selection.prototype.constructor;

function transition_selection() {
  return new Selection(this._groups, this._parents);
}

function styleNull(name, interpolate) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0 = styleValue(this, name),
        string1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, string10 = string1);
  };
}

function styleRemove(name) {
  return function() {
    this.style.removeProperty(name);
  };
}

function styleConstant(name, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = styleValue(this, name);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function styleFunction(name, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0 = styleValue(this, name),
        value1 = value(this),
        string1 = value1 + "";
    if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function styleMaybeRemove(id, name) {
  var on0, on1, listener0, key = "style." + name, event = "end." + key, remove;
  return function() {
    var schedule = set(this, id),
        on = schedule.on,
        listener = schedule.value[key] == null ? remove || (remove = styleRemove(name)) : undefined;

    // If this node shared a dispatch with the previous node,
    // just assign the updated shared dispatch and we’re done!
    // Otherwise, copy-on-write.
    if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);

    schedule.on = on1;
  };
}

function transition_style(name, value, priority) {
  var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
  return value == null ? this
      .styleTween(name, styleNull(name, i))
      .on("end.style." + name, styleRemove(name))
    : typeof value === "function" ? this
      .styleTween(name, styleFunction(name, i, tweenValue(this, "style." + name, value)))
      .each(styleMaybeRemove(this._id, name))
    : this
      .styleTween(name, styleConstant(name, i, value), priority)
      .on("end.style." + name, null);
}

function styleInterpolate(name, i, priority) {
  return function(t) {
    this.style.setProperty(name, i.call(this, t), priority);
  };
}

function styleTween(name, value, priority) {
  var t, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
    return t;
  }
  tween._value = value;
  return tween;
}

function transition_styleTween(name, value, priority) {
  var key = "style." + (name += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}

function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}

function textFunction(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}

function transition_text(value) {
  return this.tween("text", typeof value === "function"
      ? textFunction(tweenValue(this, "text", value))
      : textConstant(value == null ? "" : value + ""));
}

function textInterpolate(i) {
  return function(t) {
    this.textContent = i.call(this, t);
  };
}

function textTween(value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && textInterpolate(i);
    return t0;
  }
  tween._value = value;
  return tween;
}

function transition_textTween(value) {
  var key = "text";
  if (arguments.length < 1) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  return this.tween(key, textTween(value));
}

function transition_transition() {
  var name = this._name,
      id0 = this._id,
      id1 = newId();

  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        var inherit = get(node, id0);
        schedule(node, name, id1, i, group, {
          time: inherit.time + inherit.delay + inherit.duration,
          delay: 0,
          duration: inherit.duration,
          ease: inherit.ease
        });
      }
    }
  }

  return new Transition(groups, this._parents, name, id1);
}

function transition_end() {
  var on0, on1, that = this, id = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = {value: reject},
        end = {value: function() { if (--size === 0) resolve(); }};

    that.each(function() {
      var schedule = set(this, id),
          on = schedule.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) {
        on1 = (on0 = on).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }

      schedule.on = on1;
    });

    // The selection was empty, resolve end immediately
    if (size === 0) resolve();
  });
}

var id = 0;

function Transition(groups, parents, name, id) {
  this._groups = groups;
  this._parents = parents;
  this._name = name;
  this._id = id;
}

function newId() {
  return ++id;
}

var selection_prototype = selection.prototype;

Transition.prototype = {
  constructor: Transition,
  select: transition_select,
  selectAll: transition_selectAll,
  selectChild: selection_prototype.selectChild,
  selectChildren: selection_prototype.selectChildren,
  filter: transition_filter,
  merge: transition_merge,
  selection: transition_selection,
  transition: transition_transition,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: transition_on,
  attr: transition_attr,
  attrTween: transition_attrTween,
  style: transition_style,
  styleTween: transition_styleTween,
  text: transition_text,
  textTween: transition_textTween,
  remove: transition_remove,
  tween: transition_tween,
  delay: transition_delay,
  duration: transition_duration,
  ease: transition_ease,
  easeVarying: transition_easeVarying,
  end: transition_end,
  [Symbol.iterator]: selection_prototype[Symbol.iterator]
};

function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

var defaultTiming = {
  time: null, // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};

function inherit(node, id) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id])) {
    if (!(node = node.parentNode)) {
      throw new Error(`transition ${id} not found`);
    }
  }
  return timing;
}

function selection_transition(name) {
  var id,
      timing;

  if (name instanceof Transition) {
    id = name._id, name = name._name;
  } else {
    id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
  }

  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        schedule(node, name, id, i, group, timing || inherit(node, id));
      }
    }
  }

  return new Transition(groups, this._parents, name, id);
}

selection.prototype.interrupt = selection_interrupt;
selection.prototype.transition = selection_transition;

var constant$1 = x => () => x;

function BrushEvent(type, {
  sourceEvent,
  target,
  selection,
  mode,
  dispatch
}) {
  Object.defineProperties(this, {
    type: {value: type, enumerable: true, configurable: true},
    sourceEvent: {value: sourceEvent, enumerable: true, configurable: true},
    target: {value: target, enumerable: true, configurable: true},
    selection: {value: selection, enumerable: true, configurable: true},
    mode: {value: mode, enumerable: true, configurable: true},
    _: {value: dispatch}
  });
}

function nopropagation(event) {
  event.stopImmediatePropagation();
}

function noevent(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

var MODE_DRAG = {name: "drag"},
    MODE_SPACE = {name: "space"},
    MODE_HANDLE = {name: "handle"},
    MODE_CENTER = {name: "center"};

const {abs, max, min} = Math;

function number1(e) {
  return [+e[0], +e[1]];
}

function number2(e) {
  return [number1(e[0]), number1(e[1])];
}

var X = {
  name: "x",
  handles: ["w", "e"].map(type),
  input: function(x, e) { return x == null ? null : [[+x[0], e[0][1]], [+x[1], e[1][1]]]; },
  output: function(xy) { return xy && [xy[0][0], xy[1][0]]; }
};

var Y = {
  };

var cursors = {
  overlay: "crosshair",
  selection: "move",
  n: "ns-resize",
  e: "ew-resize",
  s: "ns-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  ne: "nesw-resize",
  se: "nwse-resize",
  sw: "nesw-resize"
};

var flipX = {
  e: "w",
  w: "e",
  nw: "ne",
  ne: "nw",
  se: "sw",
  sw: "se"
};

var flipY = {
  n: "s",
  s: "n",
  nw: "sw",
  ne: "se",
  se: "ne",
  sw: "nw"
};

var signsX = {
  overlay: 1,
  selection: 1,
  n: null,
  e: 1,
  s: null,
  w: -1,
  nw: -1,
  ne: 1,
  se: 1,
  sw: -1
};

var signsY = {
  overlay: 1,
  selection: 1,
  n: -1,
  e: null,
  s: 1,
  w: null,
  nw: -1,
  ne: -1,
  se: 1,
  sw: 1
};

function type(t) {
  return {type: t};
}

// Ignore right-click, since that should open the context menu.
function defaultFilter(event) {
  return !event.ctrlKey && !event.button;
}

function defaultExtent() {
  var svg = this.ownerSVGElement || this;
  if (svg.hasAttribute("viewBox")) {
    svg = svg.viewBox.baseVal;
    return [[svg.x, svg.y], [svg.x + svg.width, svg.y + svg.height]];
  }
  return [[0, 0], [svg.width.baseVal.value, svg.height.baseVal.value]];
}

function defaultTouchable() {
  return navigator.maxTouchPoints || ("ontouchstart" in this);
}

// Like d3.local, but with the name “__brush” rather than auto-generated.
function local(node) {
  while (!node.__brush) if (!(node = node.parentNode)) return;
  return node.__brush;
}

function empty(extent) {
  return extent[0][0] === extent[1][0]
      || extent[0][1] === extent[1][1];
}

function brushX() {
  return brush(X);
}

function brush(dim) {
  var extent = defaultExtent,
      filter = defaultFilter,
      touchable = defaultTouchable,
      keys = true,
      listeners = dispatch("start", "brush", "end"),
      handleSize = 6,
      touchending;

  function brush(group) {
    var overlay = group
        .property("__brush", initialize)
      .selectAll(".overlay")
      .data([type("overlay")]);

    overlay.enter().append("rect")
        .attr("class", "overlay")
        .attr("pointer-events", "all")
        .attr("cursor", cursors.overlay)
      .merge(overlay)
        .each(function() {
          var extent = local(this).extent;
          select(this)
              .attr("x", extent[0][0])
              .attr("y", extent[0][1])
              .attr("width", extent[1][0] - extent[0][0])
              .attr("height", extent[1][1] - extent[0][1]);
        });

    group.selectAll(".selection")
      .data([type("selection")])
      .enter().append("rect")
        .attr("class", "selection")
        .attr("cursor", cursors.selection)
        .attr("fill", "#777")
        .attr("fill-opacity", 0.3)
        .attr("stroke", "#fff")
        .attr("shape-rendering", "crispEdges");

    var handle = group.selectAll(".handle")
      .data(dim.handles, function(d) { return d.type; });

    handle.exit().remove();

    handle.enter().append("rect")
        .attr("class", function(d) { return "handle handle--" + d.type; })
        .attr("cursor", function(d) { return cursors[d.type]; });

    group
        .each(redraw)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mousedown.brush", started)
      .filter(touchable)
        .on("touchstart.brush", started)
        .on("touchmove.brush", touchmoved)
        .on("touchend.brush touchcancel.brush", touchended)
        .style("touch-action", "none")
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }

  brush.move = function(group, selection, event) {
    if (group.tween) {
      group
          .on("start.brush", function(event) { emitter(this, arguments).beforestart().start(event); })
          .on("interrupt.brush end.brush", function(event) { emitter(this, arguments).end(event); })
          .tween("brush", function() {
            var that = this,
                state = that.__brush,
                emit = emitter(that, arguments),
                selection0 = state.selection,
                selection1 = dim.input(typeof selection === "function" ? selection.apply(this, arguments) : selection, state.extent),
                i = interpolate$1(selection0, selection1);

            function tween(t) {
              state.selection = t === 1 && selection1 === null ? null : i(t);
              redraw.call(that);
              emit.brush();
            }

            return selection0 !== null && selection1 !== null ? tween : tween(1);
          });
    } else {
      group
          .each(function() {
            var that = this,
                args = arguments,
                state = that.__brush,
                selection1 = dim.input(typeof selection === "function" ? selection.apply(that, args) : selection, state.extent),
                emit = emitter(that, args).beforestart();

            interrupt(that);
            state.selection = selection1 === null ? null : selection1;
            redraw.call(that);
            emit.start(event).brush(event).end(event);
          });
    }
  };

  brush.clear = function(group, event) {
    brush.move(group, null, event);
  };

  function redraw() {
    var group = select(this),
        selection = local(this).selection;

    if (selection) {
      group.selectAll(".selection")
          .style("display", null)
          .attr("x", selection[0][0])
          .attr("y", selection[0][1])
          .attr("width", selection[1][0] - selection[0][0])
          .attr("height", selection[1][1] - selection[0][1]);

      group.selectAll(".handle")
          .style("display", null)
          .attr("x", function(d) { return d.type[d.type.length - 1] === "e" ? selection[1][0] - handleSize / 2 : selection[0][0] - handleSize / 2; })
          .attr("y", function(d) { return d.type[0] === "s" ? selection[1][1] - handleSize / 2 : selection[0][1] - handleSize / 2; })
          .attr("width", function(d) { return d.type === "n" || d.type === "s" ? selection[1][0] - selection[0][0] + handleSize : handleSize; })
          .attr("height", function(d) { return d.type === "e" || d.type === "w" ? selection[1][1] - selection[0][1] + handleSize : handleSize; });
    }

    else {
      group.selectAll(".selection,.handle")
          .style("display", "none")
          .attr("x", null)
          .attr("y", null)
          .attr("width", null)
          .attr("height", null);
    }
  }

  function emitter(that, args, clean) {
    var emit = that.__brush.emitter;
    return emit && (!clean || !emit.clean) ? emit : new Emitter(that, args, clean);
  }

  function Emitter(that, args, clean) {
    this.that = that;
    this.args = args;
    this.state = that.__brush;
    this.active = 0;
    this.clean = clean;
  }

  Emitter.prototype = {
    beforestart: function() {
      if (++this.active === 1) this.state.emitter = this, this.starting = true;
      return this;
    },
    start: function(event, mode) {
      if (this.starting) this.starting = false, this.emit("start", event, mode);
      else this.emit("brush", event);
      return this;
    },
    brush: function(event, mode) {
      this.emit("brush", event, mode);
      return this;
    },
    end: function(event, mode) {
      if (--this.active === 0) delete this.state.emitter, this.emit("end", event, mode);
      return this;
    },
    emit: function(type, event, mode) {
      var d = select(this.that).datum();
      listeners.call(
        type,
        this.that,
        new BrushEvent(type, {
          sourceEvent: event,
          target: brush,
          selection: dim.output(this.state.selection),
          mode,
          dispatch: listeners
        }),
        d
      );
    }
  };

  function started(event) {
    if (touchending && !event.touches) return;
    if (!filter.apply(this, arguments)) return;

    var that = this,
        type = event.target.__data__.type,
        mode = (keys && event.metaKey ? type = "overlay" : type) === "selection" ? MODE_DRAG : (keys && event.altKey ? MODE_CENTER : MODE_HANDLE),
        signX = dim === Y ? null : signsX[type],
        signY = dim === X ? null : signsY[type],
        state = local(that),
        extent = state.extent,
        selection = state.selection,
        W = extent[0][0], w0, w1,
        N = extent[0][1], n0, n1,
        E = extent[1][0], e0, e1,
        S = extent[1][1], s0, s1,
        dx = 0,
        dy = 0,
        moving,
        shifting = signX && signY && keys && event.shiftKey,
        lockX,
        lockY,
        points = Array.from(event.touches || [event], t => {
          const i = t.identifier;
          t = pointer(t, that);
          t.point0 = t.slice();
          t.identifier = i;
          return t;
        });

    interrupt(that);
    var emit = emitter(that, arguments, true).beforestart();

    if (type === "overlay") {
      if (selection) moving = true;
      const pts = [points[0], points[1] || points[0]];
      state.selection = selection = [[
          w0 = dim === Y ? W : min(pts[0][0], pts[1][0]),
          n0 = dim === X ? N : min(pts[0][1], pts[1][1])
        ], [
          e0 = dim === Y ? E : max(pts[0][0], pts[1][0]),
          s0 = dim === X ? S : max(pts[0][1], pts[1][1])
        ]];
      if (points.length > 1) move(event);
    } else {
      w0 = selection[0][0];
      n0 = selection[0][1];
      e0 = selection[1][0];
      s0 = selection[1][1];
    }

    w1 = w0;
    n1 = n0;
    e1 = e0;
    s1 = s0;

    var group = select(that)
        .attr("pointer-events", "none");

    var overlay = group.selectAll(".overlay")
        .attr("cursor", cursors[type]);

    if (event.touches) {
      emit.moved = moved;
      emit.ended = ended;
    } else {
      var view = select(event.view)
          .on("mousemove.brush", moved, true)
          .on("mouseup.brush", ended, true);
      if (keys) view
          .on("keydown.brush", keydowned, true)
          .on("keyup.brush", keyupped, true);

      dragDisable(event.view);
    }

    redraw.call(that);
    emit.start(event, mode.name);

    function moved(event) {
      for (const p of event.changedTouches || [event]) {
        for (const d of points)
          if (d.identifier === p.identifier) d.cur = pointer(p, that);
      }
      if (shifting && !lockX && !lockY && points.length === 1) {
        const point = points[0];
        if (abs(point.cur[0] - point[0]) > abs(point.cur[1] - point[1]))
          lockY = true;
        else
          lockX = true;
      }
      for (const point of points)
        if (point.cur) point[0] = point.cur[0], point[1] = point.cur[1];
      moving = true;
      noevent(event);
      move(event);
    }

    function move(event) {
      const point = points[0], point0 = point.point0;
      var t;

      dx = point[0] - point0[0];
      dy = point[1] - point0[1];

      switch (mode) {
        case MODE_SPACE:
        case MODE_DRAG: {
          if (signX) dx = max(W - w0, min(E - e0, dx)), w1 = w0 + dx, e1 = e0 + dx;
          if (signY) dy = max(N - n0, min(S - s0, dy)), n1 = n0 + dy, s1 = s0 + dy;
          break;
        }
        case MODE_HANDLE: {
          if (points[1]) {
            if (signX) w1 = max(W, min(E, points[0][0])), e1 = max(W, min(E, points[1][0])), signX = 1;
            if (signY) n1 = max(N, min(S, points[0][1])), s1 = max(N, min(S, points[1][1])), signY = 1;
          } else {
            if (signX < 0) dx = max(W - w0, min(E - w0, dx)), w1 = w0 + dx, e1 = e0;
            else if (signX > 0) dx = max(W - e0, min(E - e0, dx)), w1 = w0, e1 = e0 + dx;
            if (signY < 0) dy = max(N - n0, min(S - n0, dy)), n1 = n0 + dy, s1 = s0;
            else if (signY > 0) dy = max(N - s0, min(S - s0, dy)), n1 = n0, s1 = s0 + dy;
          }
          break;
        }
        case MODE_CENTER: {
          if (signX) w1 = max(W, min(E, w0 - dx * signX)), e1 = max(W, min(E, e0 + dx * signX));
          if (signY) n1 = max(N, min(S, n0 - dy * signY)), s1 = max(N, min(S, s0 + dy * signY));
          break;
        }
      }

      if (e1 < w1) {
        signX *= -1;
        t = w0, w0 = e0, e0 = t;
        t = w1, w1 = e1, e1 = t;
        if (type in flipX) overlay.attr("cursor", cursors[type = flipX[type]]);
      }

      if (s1 < n1) {
        signY *= -1;
        t = n0, n0 = s0, s0 = t;
        t = n1, n1 = s1, s1 = t;
        if (type in flipY) overlay.attr("cursor", cursors[type = flipY[type]]);
      }

      if (state.selection) selection = state.selection; // May be set by brush.move!
      if (lockX) w1 = selection[0][0], e1 = selection[1][0];
      if (lockY) n1 = selection[0][1], s1 = selection[1][1];

      if (selection[0][0] !== w1
          || selection[0][1] !== n1
          || selection[1][0] !== e1
          || selection[1][1] !== s1) {
        state.selection = [[w1, n1], [e1, s1]];
        redraw.call(that);
        emit.brush(event, mode.name);
      }
    }

    function ended(event) {
      nopropagation(event);
      if (event.touches) {
        if (event.touches.length) return;
        if (touchending) clearTimeout(touchending);
        touchending = setTimeout(function() { touchending = null; }, 500); // Ghost clicks are delayed!
      } else {
        yesdrag(event.view, moving);
        view.on("keydown.brush keyup.brush mousemove.brush mouseup.brush", null);
      }
      group.attr("pointer-events", "all");
      overlay.attr("cursor", cursors.overlay);
      if (state.selection) selection = state.selection; // May be set by brush.move (on start)!
      if (empty(selection)) state.selection = null, redraw.call(that);
      emit.end(event, mode.name);
    }

    function keydowned(event) {
      switch (event.keyCode) {
        case 16: { // SHIFT
          shifting = signX && signY;
          break;
        }
        case 18: { // ALT
          if (mode === MODE_HANDLE) {
            if (signX) e0 = e1 - dx * signX, w0 = w1 + dx * signX;
            if (signY) s0 = s1 - dy * signY, n0 = n1 + dy * signY;
            mode = MODE_CENTER;
            move(event);
          }
          break;
        }
        case 32: { // SPACE; takes priority over ALT
          if (mode === MODE_HANDLE || mode === MODE_CENTER) {
            if (signX < 0) e0 = e1 - dx; else if (signX > 0) w0 = w1 - dx;
            if (signY < 0) s0 = s1 - dy; else if (signY > 0) n0 = n1 - dy;
            mode = MODE_SPACE;
            overlay.attr("cursor", cursors.selection);
            move(event);
          }
          break;
        }
        default: return;
      }
      noevent(event);
    }

    function keyupped(event) {
      switch (event.keyCode) {
        case 16: { // SHIFT
          if (shifting) {
            lockX = lockY = shifting = false;
            move(event);
          }
          break;
        }
        case 18: { // ALT
          if (mode === MODE_CENTER) {
            if (signX < 0) e0 = e1; else if (signX > 0) w0 = w1;
            if (signY < 0) s0 = s1; else if (signY > 0) n0 = n1;
            mode = MODE_HANDLE;
            move(event);
          }
          break;
        }
        case 32: { // SPACE
          if (mode === MODE_SPACE) {
            if (event.altKey) {
              if (signX) e0 = e1 - dx * signX, w0 = w1 + dx * signX;
              if (signY) s0 = s1 - dy * signY, n0 = n1 + dy * signY;
              mode = MODE_CENTER;
            } else {
              if (signX < 0) e0 = e1; else if (signX > 0) w0 = w1;
              if (signY < 0) s0 = s1; else if (signY > 0) n0 = n1;
              mode = MODE_HANDLE;
            }
            overlay.attr("cursor", cursors[type]);
            move(event);
          }
          break;
        }
        default: return;
      }
      noevent(event);
    }
  }

  function touchmoved(event) {
    emitter(this, arguments).moved(event);
  }

  function touchended(event) {
    emitter(this, arguments).ended(event);
  }

  function initialize() {
    var state = this.__brush || {selection: null};
    state.extent = number2(extent.apply(this, arguments));
    state.dim = dim;
    return state;
  }

  brush.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant$1(number2(_)), brush) : extent;
  };

  brush.filter = function(_) {
    return arguments.length ? (filter = typeof _ === "function" ? _ : constant$1(!!_), brush) : filter;
  };

  brush.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant$1(!!_), brush) : touchable;
  };

  brush.handleSize = function(_) {
    return arguments.length ? (handleSize = +_, brush) : handleSize;
  };

  brush.keyModifiers = function(_) {
    return arguments.length ? (keys = !!_, brush) : keys;
  };

  brush.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? brush : value;
  };

  return brush;
}

const pi = Math.PI,
    tau = 2 * pi,
    epsilon = 1e-6,
    tauEpsilon = tau - epsilon;

function append(strings) {
  this._ += strings[0];
  for (let i = 1, n = strings.length; i < n; ++i) {
    this._ += arguments[i] + strings[i];
  }
}

function appendRound(digits) {
  let d = Math.floor(digits);
  if (!(d >= 0)) throw new Error(`invalid digits: ${digits}`);
  if (d > 15) return append;
  const k = 10 ** d;
  return function(strings) {
    this._ += strings[0];
    for (let i = 1, n = strings.length; i < n; ++i) {
      this._ += Math.round(arguments[i] * k) / k + strings[i];
    }
  };
}

class Path {
  constructor(digits) {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null; // end of current subpath
    this._ = "";
    this._append = digits == null ? append : appendRound(digits);
  }
  moveTo(x, y) {
    this._append`M${this._x0 = this._x1 = +x},${this._y0 = this._y1 = +y}`;
  }
  closePath() {
    if (this._x1 !== null) {
      this._x1 = this._x0, this._y1 = this._y0;
      this._append`Z`;
    }
  }
  lineTo(x, y) {
    this._append`L${this._x1 = +x},${this._y1 = +y}`;
  }
  quadraticCurveTo(x1, y1, x, y) {
    this._append`Q${+x1},${+y1},${this._x1 = +x},${this._y1 = +y}`;
  }
  bezierCurveTo(x1, y1, x2, y2, x, y) {
    this._append`C${+x1},${+y1},${+x2},${+y2},${this._x1 = +x},${this._y1 = +y}`;
  }
  arcTo(x1, y1, x2, y2, r) {
    x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;

    // Is the radius negative? Error.
    if (r < 0) throw new Error(`negative radius: ${r}`);

    let x0 = this._x1,
        y0 = this._y1,
        x21 = x2 - x1,
        y21 = y2 - y1,
        x01 = x0 - x1,
        y01 = y0 - y1,
        l01_2 = x01 * x01 + y01 * y01;

    // Is this path empty? Move to (x1,y1).
    if (this._x1 === null) {
      this._append`M${this._x1 = x1},${this._y1 = y1}`;
    }

    // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
    else if (!(l01_2 > epsilon));

    // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
    // Equivalently, is (x1,y1) coincident with (x2,y2)?
    // Or, is the radius zero? Line to (x1,y1).
    else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon) || !r) {
      this._append`L${this._x1 = x1},${this._y1 = y1}`;
    }

    // Otherwise, draw an arc!
    else {
      let x20 = x2 - x0,
          y20 = y2 - y0,
          l21_2 = x21 * x21 + y21 * y21,
          l20_2 = x20 * x20 + y20 * y20,
          l21 = Math.sqrt(l21_2),
          l01 = Math.sqrt(l01_2),
          l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
          t01 = l / l01,
          t21 = l / l21;

      // If the start tangent is not coincident with (x0,y0), line to.
      if (Math.abs(t01 - 1) > epsilon) {
        this._append`L${x1 + t01 * x01},${y1 + t01 * y01}`;
      }

      this._append`A${r},${r},0,0,${+(y01 * x20 > x01 * y20)},${this._x1 = x1 + t21 * x21},${this._y1 = y1 + t21 * y21}`;
    }
  }
  arc(x, y, r, a0, a1, ccw) {
    x = +x, y = +y, r = +r, ccw = !!ccw;

    // Is the radius negative? Error.
    if (r < 0) throw new Error(`negative radius: ${r}`);

    let dx = r * Math.cos(a0),
        dy = r * Math.sin(a0),
        x0 = x + dx,
        y0 = y + dy,
        cw = 1 ^ ccw,
        da = ccw ? a0 - a1 : a1 - a0;

    // Is this path empty? Move to (x0,y0).
    if (this._x1 === null) {
      this._append`M${x0},${y0}`;
    }

    // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
    else if (Math.abs(this._x1 - x0) > epsilon || Math.abs(this._y1 - y0) > epsilon) {
      this._append`L${x0},${y0}`;
    }

    // Is this arc empty? We’re done.
    if (!r) return;

    // Does the angle go the wrong way? Flip the direction.
    if (da < 0) da = da % tau + tau;

    // Is this a complete circle? Draw two arcs to complete the circle.
    if (da > tauEpsilon) {
      this._append`A${r},${r},0,1,${cw},${x - dx},${y - dy}A${r},${r},0,1,${cw},${this._x1 = x0},${this._y1 = y0}`;
    }

    // Is this arc non-empty? Draw an arc!
    else if (da > epsilon) {
      this._append`A${r},${r},0,${+(da >= pi)},${cw},${this._x1 = x + r * Math.cos(a1)},${this._y1 = y + r * Math.sin(a1)}`;
    }
  }
  rect(x, y, w, h) {
    this._append`M${this._x0 = this._x1 = +x},${this._y0 = this._y1 = +y}h${w = +w}v${+h}h${-w}Z`;
  }
  toString() {
    return this._;
  }
}

function formatDecimal(x) {
  return Math.abs(x = Math.round(x)) >= 1e21
      ? x.toLocaleString("en").replace(/,/g, "")
      : x.toString(10);
}

// Computes the decimal coefficient and exponent of the specified number x with
// significant digits p, where x is positive and p is in [1, 21] or undefined.
// For example, formatDecimalParts(1.23) returns ["123", 0].
function formatDecimalParts(x, p) {
  if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
  var i, coefficient = x.slice(0, i);

  // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
  // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x.slice(i + 1)
  ];
}

function exponent(x) {
  return x = formatDecimalParts(Math.abs(x)), x ? x[1] : NaN;
}

function formatGroup(grouping, thousands) {
  return function(value, width) {
    var i = value.length,
        t = [],
        j = 0,
        g = grouping[0],
        length = 0;

    while (i > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t.push(value.substring(i -= g, i + g));
      if ((length += g + 1) > width) break;
      g = grouping[j = (j + 1) % grouping.length];
    }

    return t.reverse().join(thousands);
  };
}

function formatNumerals(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i) {
      return numerals[+i];
    });
  };
}

// [[fill]align][sign][symbol][0][width][,][.precision][~][type]
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}

formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

function FormatSpecifier(specifier) {
  this.fill = specifier.fill === undefined ? " " : specifier.fill + "";
  this.align = specifier.align === undefined ? ">" : specifier.align + "";
  this.sign = specifier.sign === undefined ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === undefined ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === undefined ? undefined : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === undefined ? undefined : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === undefined ? "" : specifier.type + "";
}

FormatSpecifier.prototype.toString = function() {
  return this.fill
      + this.align
      + this.sign
      + this.symbol
      + (this.zero ? "0" : "")
      + (this.width === undefined ? "" : Math.max(1, this.width | 0))
      + (this.comma ? "," : "")
      + (this.precision === undefined ? "" : "." + Math.max(0, this.precision | 0))
      + (this.trim ? "~" : "")
      + this.type;
};

// Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
function formatTrim(s) {
  out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
    switch (s[i]) {
      case ".": i0 = i1 = i; break;
      case "0": if (i0 === 0) i0 = i; i1 = i; break;
      default: if (!+s[i]) break out; if (i0 > 0) i0 = 0; break;
    }
  }
  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

var prefixExponent;

function formatPrefixAuto(x, p) {
  var d = formatDecimalParts(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1],
      i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
      n = coefficient.length;
  return i === n ? coefficient
      : i > n ? coefficient + new Array(i - n + 1).join("0")
      : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
      : "0." + new Array(1 - i).join("0") + formatDecimalParts(x, Math.max(0, p + i - 1))[0]; // less than 1y!
}

function formatRounded(x, p) {
  var d = formatDecimalParts(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
      : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
      : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

var formatTypes = {
  "%": (x, p) => (x * 100).toFixed(p),
  "b": (x) => Math.round(x).toString(2),
  "c": (x) => x + "",
  "d": formatDecimal,
  "e": (x, p) => x.toExponential(p),
  "f": (x, p) => x.toFixed(p),
  "g": (x, p) => x.toPrecision(p),
  "o": (x) => Math.round(x).toString(8),
  "p": (x, p) => formatRounded(x * 100, p),
  "r": formatRounded,
  "s": formatPrefixAuto,
  "X": (x) => Math.round(x).toString(16).toUpperCase(),
  "x": (x) => Math.round(x).toString(16)
};

function identity$1(x) {
  return x;
}

var map = Array.prototype.map,
    prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

function formatLocale(locale) {
  var group = locale.grouping === undefined || locale.thousands === undefined ? identity$1 : formatGroup(map.call(locale.grouping, Number), locale.thousands + ""),
      currencyPrefix = locale.currency === undefined ? "" : locale.currency[0] + "",
      currencySuffix = locale.currency === undefined ? "" : locale.currency[1] + "",
      decimal = locale.decimal === undefined ? "." : locale.decimal + "",
      numerals = locale.numerals === undefined ? identity$1 : formatNumerals(map.call(locale.numerals, String)),
      percent = locale.percent === undefined ? "%" : locale.percent + "",
      minus = locale.minus === undefined ? "−" : locale.minus + "",
      nan = locale.nan === undefined ? "NaN" : locale.nan + "";

  function newFormat(specifier) {
    specifier = formatSpecifier(specifier);

    var fill = specifier.fill,
        align = specifier.align,
        sign = specifier.sign,
        symbol = specifier.symbol,
        zero = specifier.zero,
        width = specifier.width,
        comma = specifier.comma,
        precision = specifier.precision,
        trim = specifier.trim,
        type = specifier.type;

    // The "n" type is an alias for ",g".
    if (type === "n") comma = true, type = "g";

    // The "" type, and any invalid type, is an alias for ".12~g".
    else if (!formatTypes[type]) precision === undefined && (precision = 12), trim = true, type = "g";

    // If zero fill is specified, padding goes after sign and before digits.
    if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

    // Compute the prefix and suffix.
    // For SI-prefix, the suffix is lazily computed.
    var prefix = symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
        suffix = symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : "";

    // What format function should we use?
    // Is this an integer type?
    // Can this type generate exponential notation?
    var formatType = formatTypes[type],
        maybeSuffix = /[defgprs%]/.test(type);

    // Set the default precision if not specified,
    // or clamp the specified precision to the supported range.
    // For significant precision, it must be in [1, 21].
    // For fixed precision, it must be in [0, 20].
    precision = precision === undefined ? 6
        : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
        : Math.max(0, Math.min(20, precision));

    function format(value) {
      var valuePrefix = prefix,
          valueSuffix = suffix,
          i, n, c;

      if (type === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;

        // Determine the sign. -0 is not less than 0, but 1 / -0 is!
        var valueNegative = value < 0 || 1 / value < 0;

        // Perform the initial formatting.
        value = isNaN(value) ? nan : formatType(Math.abs(value), precision);

        // Trim insignificant zeros.
        if (trim) value = formatTrim(value);

        // If a negative value rounds to zero after formatting, and no explicit positive sign is requested, hide the sign.
        if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;

        // Compute the prefix and suffix.
        valuePrefix = (valueNegative ? (sign === "(" ? sign : minus) : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
        valueSuffix = (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

        // Break the formatted value into the integer “value” part that can be
        // grouped, and fractional or exponential “suffix” part that is not.
        if (maybeSuffix) {
          i = -1, n = value.length;
          while (++i < n) {
            if (c = value.charCodeAt(i), 48 > c || c > 57) {
              valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
              value = value.slice(0, i);
              break;
            }
          }
        }
      }

      // If the fill character is not "0", grouping is applied before padding.
      if (comma && !zero) value = group(value, Infinity);

      // Compute the padding.
      var length = valuePrefix.length + value.length + valueSuffix.length,
          padding = length < width ? new Array(width - length + 1).join(fill) : "";

      // If the fill character is "0", grouping is applied after padding.
      if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

      // Reconstruct the final output based on the desired alignment.
      switch (align) {
        case "<": value = valuePrefix + value + valueSuffix + padding; break;
        case "=": value = valuePrefix + padding + value + valueSuffix; break;
        case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
        default: value = padding + valuePrefix + value + valueSuffix; break;
      }

      return numerals(value);
    }

    format.toString = function() {
      return specifier + "";
    };

    return format;
  }

  function formatPrefix(specifier, value) {
    var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
        e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
        k = Math.pow(10, -e),
        prefix = prefixes[8 + e / 3];
    return function(value) {
      return f(k * value) + prefix;
    };
  }

  return {
    format: newFormat,
    formatPrefix: formatPrefix
  };
}

var locale;
var format;
var formatPrefix;

defaultLocale({
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});

function defaultLocale(definition) {
  locale = formatLocale(definition);
  format = locale.format;
  formatPrefix = locale.formatPrefix;
  return locale;
}

function precisionFixed(step) {
  return Math.max(0, -exponent(Math.abs(step)));
}

function precisionPrefix(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
}

function precisionRound(step, max) {
  step = Math.abs(step), max = Math.abs(max) - step;
  return Math.max(0, exponent(max) - exponent(step)) + 1;
}

function initRange(domain, range) {
  switch (arguments.length) {
    case 0: break;
    case 1: this.range(domain); break;
    default: this.range(range).domain(domain); break;
  }
  return this;
}

function constants(x) {
  return function() {
    return x;
  };
}

function number(x) {
  return +x;
}

var unit = [0, 1];

function identity(x) {
  return x;
}

function normalize(a, b) {
  return (b -= (a = +a))
      ? function(x) { return (x - a) / b; }
      : constants(isNaN(b) ? NaN : 0.5);
}

function clamper(a, b) {
  var t;
  if (a > b) t = a, a = b, b = t;
  return function(x) { return Math.max(a, Math.min(b, x)); };
}

// normalize(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
// interpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding range value x in [a,b].
function bimap(domain, range, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
  if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x) { return r0(d0(x)); };
}

function polymap(domain, range, interpolate) {
  var j = Math.min(domain.length, range.length) - 1,
      d = new Array(j),
      r = new Array(j),
      i = -1;

  // Reverse descending domains.
  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range = range.slice().reverse();
  }

  while (++i < j) {
    d[i] = normalize(domain[i], domain[i + 1]);
    r[i] = interpolate(range[i], range[i + 1]);
  }

  return function(x) {
    var i = bisectRight(domain, x, 1, j) - 1;
    return r[i](d[i](x));
  };
}

function copy(source, target) {
  return target
      .domain(source.domain())
      .range(source.range())
      .interpolate(source.interpolate())
      .clamp(source.clamp())
      .unknown(source.unknown());
}

function transformer() {
  var domain = unit,
      range = unit,
      interpolate = interpolate$1,
      transform,
      untransform,
      unknown,
      clamp = identity,
      piecewise,
      output,
      input;

  function rescale() {
    var n = Math.min(domain.length, range.length);
    if (clamp !== identity) clamp = clamper(domain[0], domain[n - 1]);
    piecewise = n > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }

  function scale(x) {
    return x == null || isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate)))(transform(clamp(x)));
  }

  scale.invert = function(y) {
    return clamp(untransform((input || (input = piecewise(range, domain.map(transform), interpolateNumber)))(y)));
  };

  scale.domain = function(_) {
    return arguments.length ? (domain = Array.from(_, number), rescale()) : domain.slice();
  };

  scale.range = function(_) {
    return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
  };

  scale.rangeRound = function(_) {
    return range = Array.from(_), interpolate = interpolateRound, rescale();
  };

  scale.clamp = function(_) {
    return arguments.length ? (clamp = _ ? true : identity, rescale()) : clamp !== identity;
  };

  scale.interpolate = function(_) {
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  return function(t, u) {
    transform = t, untransform = u;
    return rescale();
  };
}

function continuous() {
  return transformer()(identity, identity);
}

function tickFormat(start, stop, count, specifier) {
  var step = tickStep(start, stop, count),
      precision;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

function linearish(scale) {
  var domain = scale.domain;

  scale.ticks = function(count) {
    var d = domain();
    return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
  };

  scale.tickFormat = function(count, specifier) {
    var d = domain();
    return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
  };

  scale.nice = function(count) {
    if (count == null) count = 10;

    var d = domain();
    var i0 = 0;
    var i1 = d.length - 1;
    var start = d[i0];
    var stop = d[i1];
    var prestep;
    var step;
    var maxIter = 10;

    if (stop < start) {
      step = start, start = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }
    
    while (maxIter-- > 0) {
      step = tickIncrement(start, stop, count);
      if (step === prestep) {
        d[i0] = start;
        d[i1] = stop;
        return domain(d);
      } else if (step > 0) {
        start = Math.floor(start / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start = Math.ceil(start * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      prestep = step;
    }

    return scale;
  };

  return scale;
}

function linear() {
  var scale = continuous();

  scale.copy = function() {
    return copy(scale, linear());
  };

  initRange.apply(scale, arguments);

  return linearish(scale);
}

function constant(x) {
  return function constant() {
    return x;
  };
}

function withPath(shape) {
  let digits = 3;

  shape.digits = function(_) {
    if (!arguments.length) return digits;
    if (_ == null) {
      digits = null;
    } else {
      const d = Math.floor(_);
      if (!(d >= 0)) throw new RangeError(`invalid digits: ${_}`);
      digits = d;
    }
    return shape;
  };

  return () => new Path(digits);
}

function array(x) {
  return typeof x === "object" && "length" in x
    ? x // Array, TypedArray, NodeList, array-like
    : Array.from(x); // Map, Set, iterable, string, or anything else
}

function Linear(context) {
  this._context = context;
}

Linear.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; // falls through
      default: this._context.lineTo(x, y); break;
    }
  }
};

function curveLinear(context) {
  return new Linear(context);
}

function x(p) {
  return p[0];
}

function y(p) {
  return p[1];
}

function line(x$1, y$1) {
  var defined = constant(true),
      context = null,
      curve = curveLinear,
      output = null,
      path = withPath(line);

  x$1 = typeof x$1 === "function" ? x$1 : (x$1 === undefined) ? x : constant(x$1);
  y$1 = typeof y$1 === "function" ? y$1 : (y$1 === undefined) ? y : constant(y$1);

  function line(data) {
    var i,
        n = (data = array(data)).length,
        d,
        defined0 = false,
        buffer;

    if (context == null) output = curve(buffer = path());

    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) output.lineStart();
        else output.lineEnd();
      }
      if (defined0) output.point(+x$1(d, i, data), +y$1(d, i, data));
    }

    if (buffer) return output = null, buffer + "" || null;
  }

  line.x = function(_) {
    return arguments.length ? (x$1 = typeof _ === "function" ? _ : constant(+_), line) : x$1;
  };

  line.y = function(_) {
    return arguments.length ? (y$1 = typeof _ === "function" ? _ : constant(+_), line) : y$1;
  };

  line.defined = function(_) {
    return arguments.length ? (defined = typeof _ === "function" ? _ : constant(!!_), line) : defined;
  };

  line.curve = function(_) {
    return arguments.length ? (curve = _, context != null && (output = curve(context)), line) : curve;
  };

  line.context = function(_) {
    return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line) : context;
  };

  return line;
}

function Transform(k, x, y) {
  this.k = k;
  this.x = x;
  this.y = y;
}

Transform.prototype = {
  constructor: Transform,
  scale: function(k) {
    return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
  },
  translate: function(x, y) {
    return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
  },
  apply: function(point) {
    return [point[0] * this.k + this.x, point[1] * this.k + this.y];
  },
  applyX: function(x) {
    return x * this.k + this.x;
  },
  applyY: function(y) {
    return y * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x) {
    return (x - this.x) / this.k;
  },
  invertY: function(y) {
    return (y - this.y) / this.k;
  },
  rescaleX: function(x) {
    return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
  },
  rescaleY: function(y) {
    return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};

Transform.prototype;

class SummaryEditor {
    constructor() {
        this.container = null;
        this.svg = null;
        this.data = [];
        this.originalData = [];
        this.selection = null;
        this.editHistory = [];
        this.historyIndex = -1;
        this.currentTool = "select";
        this.isInitialized = false;
        this.currentTime = 0;
        this.windowSize = 300; // 5 minutes window
        this.playbackTimeline = null; // Full dataset reference
        this.isDrawing = false;
        this.drawPath = [];

        // Dimensions - will be set based on container
        this.margin = { top: 40, right: 40, bottom: 60, left: 60 };
        this.width = 0; // Will be set dynamically
        this.height = 400;
        this.innerWidth = 0; // Will be calculated
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;

        // Scales
        this.xScale = null;
        this.yScale = null;
        this.brush = null;

        // Listen for edit mode request
        eventBus.addEventListener("ui.requestEditMode", () => {
            if (!this.isInitialized) {
                this.init();
                this.loadData();
                this.isInitialized = true;
            }
        });

        // Listen for playback time updates when in edit mode
        eventBus.addEventListener("playback.timeupdate", (e) => {
            if (this.isInitialized && e.detail.currentTime !== undefined) {
                this.currentTime = Math.floor(e.detail.currentTime);
                this.updateWindow();
            }
        });

        // Handle window resize to maintain responsiveness
        window.addEventListener("resize", () => {
            if (this.isInitialized) {
                this.handleResize();
            }
        });

        eventBus.addEventListener("playback.ready", (e) => {
            this.hierarchy = new Hierarchy(e.detail.hierarchy);
        });

        eventBus.addEventListener("playback.cameraChanged", (e) => {
            this.hierarchy = new Hierarchy(e.detail.hierarchy);
            this.loadData();
        });
    }

    handleResize() {
        const containerRect = this.svgContainer.getBoundingClientRect();
        const newWidth = Math.max(800, containerRect.width || 1000);

        if (Math.abs(newWidth - this.width) > 50) {
            // Only resize if significant change
            this.width = newWidth;
            this.innerWidth = this.width - this.margin.left - this.margin.right;

            // Update SVG dimensions
            this.svg
                .attr("width", this.width)
                .attr("viewBox", `0 0 ${this.width} ${this.height}`);

            // Update background rect
            this.g.select("rect").attr("width", this.innerWidth);

            // Update interaction layer rects
            if (this.adjustRect) {
                this.adjustRect.attr("width", this.innerWidth);
            }
            if (this.drawRect) {
                this.drawRect.attr("width", this.innerWidth);
            }

            // Update scales and render
            if (this.xScale && this.data.length > 0) {
                this.xScale.range([0, this.innerWidth]);
                this.yScale.domain([-1e3, 1000]); // Maintain fixed y-scale
                this.brush.extent([
                    [0, 0],
                    [this.innerWidth, this.innerHeight],
                ]);
                this.render();
            }
        }
    }

    createElement(options = {}) {
        const { div, button, span } = van.tags;

        // Toolbar
        this.toolbar = div(
            { class: "flex gap-2 p-2 bg-gray-800 border-b border-gray-700" },
            button(
                {
                    class: "px-3 py-1 bg-blue-500 text-white rounded",
                    onclick: () => this.setTool("select"),
                },
                "Select"
            ),
            button(
                {
                    class: "px-3 py-1 bg-yellow-500 text-white rounded",
                    onclick: () => this.setTool("adjust"),
                },
                "Adjust"
            ),
            button(
                {
                    class: "px-3 py-1 bg-orange-500 text-white rounded",
                    onclick: () => this.setTool("draw"),
                },
                "Draw"
            ),
            button(
                {
                    class: "px-3 py-1 bg-cyan-500 text-white rounded",
                    onclick: () => this.smooth(),
                },
                "Smooth"
            ),
            button(
                {
                    class: "px-3 py-1 bg-red-500 text-white rounded",
                    onclick: () => this.removeSpikes(),
                },
                "Remove Spikes"
            ),
            button(
                {
                    class: "px-3 py-1 bg-gray-500 text-white rounded",
                    onclick: () => this.undo(),
                },
                "Undo"
            ),
            button(
                {
                    class: "px-3 py-1 bg-gray-500 text-white rounded",
                    onclick: () => this.redo(),
                },
                "Redo"
            ),
            button(
                {
                    class: "px-3 py-1 bg-purple-500 text-white rounded",
                    onclick: () => this.exportData(),
                },
                "Export Changes"
            ),
            button(
                {
                    class: "px-3 py-1 bg-green-500 text-white rounded",
                    onclick: () => eventBus.fire("ui.requestViewMode"),
                },
                "Finish"
            )
        );

        // Selection info and time window info
        this.selectionInfo = div(
            {
                class: "p-2 bg-gray-800 text-gray-100 text-sm flex justify-between border-b border-gray-700",
            },
            span({ id: "selection-text" }, "No selection"),
            span(
                { id: "window-text" },
                `Window: ${this.windowSize}s around current time`
            )
        );

        // SVG container
        this.svgContainer = div({
            class: "w-full overflow-hidden bg-gray-900",
        });

        this.container = div(
            {
                class: "border rounded-lg bg-gray-900 border-gray-700",
                ...options,
            },
            this.toolbar,
            this.selectionInfo,
            this.svgContainer
        );

        return this.container;
    }

    init() {
        if (this.isInitialized) return;

        // Calculate responsive dimensions based on container
        const containerRect = this.svgContainer.getBoundingClientRect();
        this.width = Math.max(800, containerRect.width || 1000); // Minimum 800px
        this.innerWidth = this.width - this.margin.left - this.margin.right;

        // Create SVG
        this.svg = select(this.svgContainer)
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .style("width", "100%")
            .style("height", "auto");

        // Add dark theme styling and improve label colors
        this.svg.append("defs").append("style").text(`
            .brush .selection {
                fill: rgba(59, 130, 246, 0.3);
                stroke: rgb(59, 130, 246);
                stroke-width: 2;
            }
            .axis text {
                fill: #e5e7eb;
                font-size: 12px;
            }
            .axis path,
            .axis line {
                stroke: #6b7280;
            }
            .tick text {
                fill: #e5e7eb;
            }
        `);

        // Create main group
        this.g = this.svg
            .append("g")
            .attr(
                "transform",
                `translate(${this.margin.left},${this.margin.top})`
            );

        // Add dark background to chart area
        this.g
            .append("rect")
            .attr("width", this.innerWidth)
            .attr("height", this.innerHeight)
            .attr("fill", "#111827")
            .attr("stroke", "#374151")
            .attr("stroke-width", 1);

        // Create scales
        this.xScale = linear().range([0, this.innerWidth]);
        this.yScale = linear()
            .range([this.innerHeight, 0])
            .domain([-1e3, 1000]); // Fixed scale from -1000 to 1000

        // Create axes
        this.xAxis = axisBottom(this.xScale)
            .tickFormat((d) => timeUtil.format(d, true));

        this.yAxis = axisLeft(this.yScale);

        this.g
            .append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${this.innerHeight})`);

        this.g.append("g").attr("class", "y-axis");

        // Create separate interaction layers
        this.createInteractionLayers();

        // Add current time indicator line
        this.g
            .append("line")
            .attr("class", "current-time-line")
            .attr("stroke", "#ef4444")
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "5,5")
            .attr("y1", 0)
            .attr("y2", this.innerHeight);
    }

    createInteractionLayers() {
        // Create separate layers for each tool
        this.selectLayer = this.g.append("g").attr("class", "select-layer");
        this.adjustLayer = this.g.append("g").attr("class", "adjust-layer");
        this.drawLayer = this.g.append("g").attr("class", "draw-layer");

        // SELECT LAYER - Brush for range selection
        this.brush = brushX()
            .extent([
                [0, 0],
                [this.innerWidth, this.innerHeight],
            ])
            .on("start", (event) => this.onBrushStart(event))
            .on("brush", (event) => this.onBrush(event))
            .on("end", (event) => this.onBrushEnd(event));

        this.selectLayer.append("g").attr("class", "brush").call(this.brush);

        // ADJUST LAYER - Transparent rect for click events
        this.adjustRect = this.adjustLayer
            .append("rect")
            .attr("width", this.innerWidth)
            .attr("height", this.innerHeight)
            .attr("fill", "transparent")
            .style("cursor", "crosshair")
            .on("click", (event) => this.handleAdjustClick(event));

        // DRAW LAYER - Transparent rect for drag events
        this.drawRect = this.drawLayer
            .append("rect")
            .attr("width", this.innerWidth)
            .attr("height", this.innerHeight)
            .attr("fill", "transparent")
            .style("cursor", "crosshair")
            .on("mousedown", (event) => this.startDrawing(event))
            .on("mousemove", (event) => this.continueDrawing(event));

        // Initially show only select layer
        this.selectLayer.style("display", "block");
        this.adjustLayer.style("display", "none");
        this.drawLayer.style("display", "none");
    }

    loadData() {
        const summary = summarizer.getCurrent();
        if (!summary || summary.length === 0) return;

        // Store full dataset reference
        this.playbackTimeline = summary.map((d, i) => ({
            time: parseInt(d.startTime),
            score: d.score,
            people: d.people,
            index: i,
            changed: false, // Track which points have been modified
        }));

        // Load initial window
        this.updateWindow();
    }

    updateWindow() {
        if (!this.playbackTimeline) return;

        const halfWindow = this.windowSize / 2;
        const startTime = Math.max(0, this.currentTime - halfWindow);
        const endTime = this.currentTime + halfWindow;

        // Filter data to current window
        this.data = this.playbackTimeline.filter(
            (d) => d.time >= startTime && d.time <= endTime
        );

        if (this.data.length === 0) return;

        // Update scales for current window
        this.xScale.domain([startTime, endTime]);
        this.yScale.domain([-1e3, 1000]); // Fixed scale from -1000 to 1000

        // Save state if this is the first load
        if (this.editHistory.length === 0) {
            this.saveState();
        }

        this.render();
        this.updateWindowInfo();
    }

    render() {
        if (!this.svg || this.data.length === 0) return;

        // Update axes
        this.g.select(".x-axis").call(this.xAxis);
        this.g.select(".y-axis").call(this.yAxis);

        // Create line generator
        const line$1 = line()
            .x((d) => this.xScale(d.time))
            .y((d) => this.yScale(d.score))
            .curve(curveLinear);

        // Render score line
        const path = this.g.selectAll(".score-line").data([this.data]);

        path.enter()
            .append("path")
            .attr("class", "score-line")
            .attr("fill", "none")
            .attr("stroke", "#60a5fa")
            .attr("stroke-width", 3)
            .merge(path)
            .attr("d", line$1);

        // Update current time indicator
        this.g
            .select(".current-time-line")
            .attr("x1", this.xScale(this.currentTime))
            .attr("x2", this.xScale(this.currentTime));

        // Update brush extent to match current scales
        this.brush.extent([
            [0, 0],
            [this.innerWidth, this.innerHeight],
        ]);
        this.selectLayer.select(".brush").call(this.brush);

        // Maintain crosshair if in adjust or draw mode
        if (this.currentTool === "adjust") {
            this.showCrosshair("#eab308");
        } else if (this.currentTool === "draw") {
            this.showCrosshair("#10b981");
        }
    }

    // Tool methods
    setTool(tool) {
        this.currentTool = tool;

        // Update UI to show active tool
        this.container.querySelectorAll("button").forEach((btn) => {
            btn.classList.remove("ring-2", "ring-blue-300");
        });

        // Highlight active tool button
        const buttons = this.container.querySelectorAll("button");
        const toolMap = {
            select: 0,
            adjust: 1,
            draw: 2,
        };

        if (toolMap[tool] !== undefined) {
            buttons[toolMap[tool]].classList.add("ring-2", "ring-blue-300");
        }

        // Configure interaction mode based on tool
        if (tool === "select") {
            this.enableSelectMode();
        } else if (tool === "adjust") {
            this.enableAdjustMode();
        } else if (tool === "draw") {
            this.enableDrawMode();
        }
    }

    enableSelectMode() {
        this.selectLayer.style("display", "block");
        this.adjustLayer.style("display", "none");
        this.drawLayer.style("display", "none");

        // Enable brush interaction
        this.selectLayer.select(".brush").style("pointer-events", "all");

        this.hideCrosshair();
        this.isDrawing = false;
    }

    enableAdjustMode() {
        this.selectLayer.style("display", "block");
        this.adjustLayer.style("display", "block");
        this.drawLayer.style("display", "none");

        // Disable brush interaction but keep selection visible
        this.selectLayer.select(".brush").style("pointer-events", "none");

        this.showCrosshair("#eab308"); // Yellow crosshair
        this.isDrawing = false;
    }

    enableDrawMode() {
        this.selectLayer.style("display", "none");
        this.adjustLayer.style("display", "none");
        this.drawLayer.style("display", "block");

        // Clear selection when entering draw mode
        this.brush.clear(this.selectLayer.select(".brush"));
        this.selection = null;
        this.updateSelectionInfo();

        this.showCrosshair("#10b981"); // Green crosshair
    }

    // Adjust tool - click to create spikes/valleys
    handleAdjustClick(event) {
        if (this.currentTool !== "adjust") return;

        const [mouseX, mouseY] = pointer(event, this.g.node());

        // Convert pixel coordinates to data coordinates
        const clickTime = this.xScale.invert(mouseX);
        const targetScore = Math.max(
            -1e3,
            Math.min(1000, this.yScale.invert(mouseY))
        );

        // Find the closest data point in time
        const closestPoint = this.data.reduce((prev, curr) =>
            Math.abs(curr.time - clickTime) < Math.abs(prev.time - clickTime)
                ? curr
                : prev
        );

        if (closestPoint) {
            this.createAdjustment(closestPoint, targetScore);
        }
    }

    createAdjustment(centerPoint, targetScore) {
        const originalScore = centerPoint.score;
        const centerTime = centerPoint.time;

        // Determine affected points based on selection or default range
        let affectedPoints;
        let leftBound, rightBound;

        if (this.selection) {
            // Use selection bounds for affected points
            const [selStart, selEnd] = this.selection;
            leftBound = selStart;
            rightBound = selEnd;
            affectedPoints = this.data.filter(
                (d) => d.time >= selStart && d.time <= selEnd
            );
        } else {
            // Default ±2 seconds around center point
            leftBound = centerTime - 2;
            rightBound = centerTime + 2;
            affectedPoints = this.data.filter(
                (d) => d.time >= leftBound && d.time <= rightBound
            );
        }

        // Calculate asymmetrical distances for falloff
        const leftDistance = Math.abs(centerTime - leftBound);
        const rightDistance = Math.abs(rightBound - centerTime);

        affectedPoints.forEach((point) => {
            const oldScore = point.score;

            if (point.time === centerTime) {
                // Center point gets the exact target score
                point.score = targetScore;
            } else {
                // Calculate asymmetrical falloff
                let falloffStrength;

                if (point.time < centerTime) {
                    // Point is to the left of center
                    const distance = centerTime - point.time;
                    if (leftDistance > 0) {
                        const normalizedDistance = distance / leftDistance;
                        falloffStrength = Math.sin(
                            ((1 - normalizedDistance) * Math.PI) / 2
                        );
                    } else {
                        falloffStrength = 1; // Full strength if no left distance
                    }
                } else {
                    // Point is to the right of center
                    const distance = point.time - centerTime;
                    if (rightDistance > 0) {
                        const normalizedDistance = distance / rightDistance;
                        falloffStrength = Math.sin(
                            ((1 - normalizedDistance) * Math.PI) / 2
                        );
                    } else {
                        falloffStrength = 1; // Full strength if no right distance
                    }
                }

                // Apply the adjustment with falloff
                point.score =
                    originalScore +
                    (targetScore - originalScore) * falloffStrength;
            }

            // Mark as changed if score actually changed
            if (point.score !== oldScore) {
                point.changed = true;
            }
        });

        this.saveState();
        this.render();

        console.log(
            `Adjusted point at ${centerTime}s to score ${targetScore} affecting ${affectedPoints.length} points (left: ${leftDistance}s, right: ${rightDistance}s)`
        );
    }

    // Draw tool - drag to draw points manually
    startDrawing(event) {
        if (this.currentTool !== "draw") return;

        this.isDrawing = true;
        this.drawPath = [];

        const [mouseX, mouseY] = pointer(event, this.g.node());
        const time = this.xScale.invert(mouseX);
        const score = Math.max(
            -1e3,
            Math.min(1000, this.yScale.invert(mouseY))
        );

        this.drawPath.push({ time, score });

        // Add document-level mouseup listener to ensure we catch it
        const handleMouseUp = () => {
            this.stopDrawing();
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mouseup", handleMouseUp);
    }

    continueDrawing(event) {
        if (!this.isDrawing || this.currentTool !== "draw") return;

        const [mouseX, mouseY] = pointer(event, this.g.node());
        const time = this.xScale.invert(mouseX);
        const score = Math.max(
            -1e3,
            Math.min(1000, this.yScale.invert(mouseY))
        );

        this.drawPath.push({ time, score });

        // Apply drawing in real-time
        this.applyDrawPath();
    }

    stopDrawing() {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        if (this.drawPath.length > 0) {
            this.applyDrawPath();
            this.saveState();
            this.render();

            console.log(`Drew ${this.drawPath.length} points`);
        }

        this.drawPath = [];
    }

    applyDrawPath() {
        if (this.drawPath.length === 0) return;

        // For each point in the draw path, find and update the closest data point
        this.drawPath.forEach((drawPoint) => {
            const closestDataPoint = this.data.reduce((prev, curr) =>
                Math.abs(curr.time - drawPoint.time) <
                Math.abs(prev.time - drawPoint.time)
                    ? curr
                    : prev
            );

            if (
                closestDataPoint &&
                Math.abs(closestDataPoint.time - drawPoint.time) <= 1
            ) {
                const oldScore = closestDataPoint.score;
                closestDataPoint.score = drawPoint.score;

                // Mark as changed if score actually changed
                if (closestDataPoint.score !== oldScore) {
                    closestDataPoint.changed = true;
                }
            }
        });

        this.render();
    }

    // Visual feedback methods
    showCrosshair(color = "#eab308") {
        // Remove existing crosshair
        this.g.selectAll(".crosshair").remove();

        const crosshair = this.g.append("g").attr("class", "crosshair");

        const vLine = crosshair
            .append("line")
            .attr("class", "crosshair-v")
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3")
            .attr("y1", 0)
            .attr("y2", this.innerHeight)
            .style("pointer-events", "none")
            .style("opacity", 0);

        const hLine = crosshair
            .append("line")
            .attr("class", "crosshair-h")
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3")
            .attr("x1", 0)
            .attr("x2", this.innerWidth)
            .style("pointer-events", "none")
            .style("opacity", 0);

        // Add score indicator
        const scoreText = crosshair
            .append("text")
            .attr("class", "crosshair-score")
            .attr("fill", color)
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .style("pointer-events", "none")
            .style("opacity", 0);

        this.svg.on("mousemove.crosshair", (event) => {
            const [mouseX, mouseY] = pointer(event, this.g.node());
            const score = Math.round(this.yScale.invert(mouseY));

            vLine.attr("x1", mouseX).attr("x2", mouseX).style("opacity", 0.7);
            hLine.attr("y1", mouseY).attr("y2", mouseY).style("opacity", 0.7);

            scoreText
                .attr("x", mouseX + 10)
                .attr("y", mouseY - 10)
                .text(score)
                .style("opacity", 0.8);
        });

        this.svg.on("mouseleave.crosshair", () => {
            vLine.style("opacity", 0);
            hLine.style("opacity", 0);
            scoreText.style("opacity", 0);
        });
    }

    hideCrosshair() {
        this.g.selectAll(".crosshair").remove();
        this.svg.on("mousemove.crosshair", null);
        this.svg.on("mouseleave.crosshair", null);
    }

    smooth() {
        if (!this.selection) return;

        const [start, end] = this.selection;
        const selectedData = this.data.filter(
            (d) => d.time >= start && d.time <= end
        );

        if (selectedData.length < 3) return;

        // Simple moving average smoothing
        const windowSize = Math.min(5, Math.floor(selectedData.length / 3));

        selectedData.forEach((d, i) => {
            if (i >= windowSize && i < selectedData.length - windowSize) {
                const oldScore = d.score;
                const window = selectedData.slice(
                    i - windowSize,
                    i + windowSize + 1
                );
                d.score = mean(window, (w) => w.score);

                // Mark as changed if score actually changed
                if (d.score !== oldScore) {
                    d.changed = true;
                }
            }
        });

        this.saveState();
        this.render();
    }

    removeSpikes() {
        if (!this.selection) return;

        const [start, end] = this.selection;
        const selectedData = this.data.filter(
            (d) => d.time >= start && d.time <= end
        );

        if (selectedData.length === 0) return;

        // Simple spike removal: replace outliers with interpolated values
        const scores = selectedData.map((d) => d.score);
        const mean$1 = mean(scores);
        const stdDev = deviation(scores);
        const threshold = 2; // 2 standard deviations

        selectedData.forEach((d, i) => {
            if (Math.abs(d.score - mean$1) > threshold * stdDev) {
                const prevPoint = selectedData[i - 1];
                const nextPoint = selectedData[i + 1];

                if (prevPoint && nextPoint) {
                    const oldScore = d.score;
                    d.score = (prevPoint.score + nextPoint.score) / 2;

                    // Mark as changed if score actually changed
                    if (d.score !== oldScore) {
                        d.changed = true;
                    }
                }
            }
        });

        this.saveState();
        this.render();
    }

    // Save changes back to summarizer
    saveChanges() {
        const updatedSummary = this.playbackTimeline.map((d) => ({
            startTime: d.time.toString(),
            score: d.score,
            people: d.people,
        }));

        // Update the summarizer with edited data
        if (summarizer.updateCurrent) {
            summarizer.updateCurrent(updatedSummary);
        }

        // Dispatch event to notify other components
        eventBus.dispatchEvent(
            new CustomEvent("scoring.dataUpdated", {
                detail: { updatedPoints: this.data.length },
            })
        );

        console.log("Saved changes to summarizer");
    }

    // History management - only for current window
    saveState() {
        const state = this.data.map((d) => ({ ...d }));
        this.editHistory = this.editHistory.slice(0, this.historyIndex + 1);
        this.editHistory.push(state);
        this.historyIndex++;

        // Limit history size for window-based editing
        if (this.editHistory.length > 20) {
            this.editHistory.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.data = this.editHistory[this.historyIndex].map((d) => ({
                ...d,
            }));
            this.render();
        }
    }

    redo() {
        if (this.historyIndex < this.editHistory.length - 1) {
            this.historyIndex++;
            this.data = this.editHistory[this.historyIndex].map((d) => ({
                ...d,
            }));
            this.render();
        }
    }

    // Brush event handlers
    onBrushStart(event) {
        // Only process brush events when in select mode
        if (this.currentTool !== "select") return;

        // Clear any existing selection display on start
        if (!event.selection) {
            this.selection = null;
            this.updateSelectionInfo();
        }
    }

    onBrush(event) {
        // Only process brush events when in select mode
        if (this.currentTool !== "select") return;

        // Update selection during brushing
        if (event.selection) {
            this.selection = event.selection.map(this.xScale.invert);
            this.updateSelectionInfo();
        }
    }

    onBrushEnd(event) {
        // Only process brush events when in select mode
        if (this.currentTool !== "select") return;

        const selection = event.selection;
        if (selection) {
            // Set final selection
            this.selection = selection.map(this.xScale.invert);
            this.updateSelectionInfo();
        } else {
            // Clear selection if click without drag
            this.selection = null;
            this.updateSelectionInfo();
        }
    }

    // UI updates
    updateSelectionInfo() {
        const infoEl = this.container.querySelector("#selection-text");
        if (this.selection) {
            const [start, end] = this.selection;
            const duration = Math.round(end - start);
            infoEl.textContent = `Selected: ${timeUtil.format(
                start,
                true
            )} - ${timeUtil.format(end, true)} (${duration}s)`;
        } else {
            infoEl.textContent = "No selection";
        }
    }

    updateWindowInfo() {
        const windowEl = this.container.querySelector("#window-text");
        if (windowEl) {
            const halfWindow = this.windowSize / 2;
            const startTime = Math.max(0, this.currentTime - halfWindow);
            const endTime = this.currentTime + halfWindow;
            windowEl.textContent = `Window: ${timeUtil.format(
                startTime
            )} - ${timeUtil.format(endTime)} (${this.data.length} points)`;
        }
    }

    // Export only changed points with original indexes
    exportData() {
        // Filter to only changed points and include original indexes
        const changedPoints = this.playbackTimeline
            .filter((d) => d.changed)
            .map((d) => [d.index, d.time, d.score, d.people]);

        if (changedPoints.length === 0) {
            alert("No changes to export!");
            return [];
        }

        // Create a blob and download link
        const blob = new Blob([JSON.stringify(changedPoints, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        a.download = `edited-changes-${this.hierarchy.toString("-")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(
            "Exported changed data:",
            changedPoints.length,
            "points out of",
            this.playbackTimeline.length,
            "total"
        );
        return changedPoints;
    }
}

const summaryEditor = new SummaryEditor();

class Reports {
    constructor() {
        this.hierarchy = this.getHierarchyFromPath() || "raimondi-20250711-01";
        this.currentCamera = 1;
        this.startTimeOffset = this.getTimeOffsetFromHash() || 0;
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;

        this.score = scoring;

        this.transcript = [];
        this.tsIndex = 0;

        this.event = null;
        this.wallclockStartTimeUTC = null;
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
            this.hierarchy.replaceAll("-", ":")
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

            const pathname = `/reports/${hierarchy.replaceAll(":", "/")}`;
            window.location.pathname = pathname;
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
                            this.hierarchy.replaceAll("-", ":")
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
                        div(
                            {
                                id: "report-mode-edit",
                                class: "hidden",
                            },

                            summaryEditor.createElement()
                        ),
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
            this.hls.loadSource(this.playlistUrl);

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
