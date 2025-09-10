import { eventBus } from "./eventbus.js";

class Viz {
    scoreToHue(score) {
        let hueOffset = (score / 1000.0) * 64;
        if (hueOffset < 0) hueOffset = Math.max(hueOffset, -64);
        else hueOffset = Math.min(hueOffset, 64);
        const hue = 64 + hueOffset;
        return hue;
    }

    paintHeatmap(canvas, window, start, end, windowSize) {
        if (!canvas) {
            console.error("Canvas element not found");
            return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Failed to get canvas context");
            return;
        }

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!window[end]) return;

        let endTime = window[end].time;

        for (let i = end; i >= start; i--) {
            const row = window[i];
            if (!row) break;

            //if (row.frame != frame) break;

            const ox = row.box.x;
            const oy = row.box.y;
            const ow = row.box.w;
            const oh = row.box.h;
            const score = row.score;
            const age = (row.time - endTime) / windowSize;

            // Scale the box coordinates to the canvas size
            const x = (ox / 3840) * canvas.width;
            const y = (oy / 2160) * canvas.height;
            const w = (ow / 3840) * canvas.width;
            const h = (oh / 2160) * canvas.height;

            // Calculate center and radiuses for the radial gradient
            const cx = x + w / 2;
            const cy = y + h / 2;
            const rw = w * 2; //10.0;
            const rh = h * 2; //10.0;
            const rx = cx - rw / 2;
            const ry = cy - rh / 2;
            const innerR = 1;
            const outerR = rh / 2;

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
            const alpha = (windowSize - age) * 50;

            gradient.addColorStop(0, `hsl(${hue}, 100%, 50%, ${alpha}%)`);
            gradient.addColorStop(1, `hsl(${hue}, 100%, 50%, 0%)`);
            ctx.fillStyle = gradient;
            ctx.strokeStyle = `hsl(${hue}, 100%, 50%, ${alpha}%)`;
            ctx.lineWidth = 1;
            //ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);
        }
    }
    paintActiveHeatmap(canvas, activeBoxes) {
        if (!canvas) {
            console.error("Canvas element not found");
            return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Failed to get canvas context");
            return;
        }

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const box of activeBoxes) {
            const ox = box.x;
            const oy = box.y;
            const ow = box.w;
            const oh = box.h;
            const score = Math.floor(box.score);
            const expires = box.expires;

            // Scale the box coordinates to the canvas size
            const x = (ox / 3840) * canvas.width;
            const y = (oy / 2160) * canvas.height;
            const w = (ow / 3840) * canvas.width;
            const h = (oh / 2160) * canvas.height;

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

    isPointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
        const area = (x1, y1, x2, y2, x3, y3) =>
            0.5 * Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

        const A = area(x1, y1, x2, y2, x3, y3);
        const A1 = area(px, py, x2, y2, x3, y3);
        const A2 = area(x1, y1, px, py, x3, y3);
        const A3 = area(x1, y1, x2, y2, px, py);

        return A === A1 + A2 + A3;
    }

    findTriangleContainingPoint(x, y, triangles) {
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];
            const [x1, y1, x2, y2, x3, y3] = triangle;
            if (this.isPointInTriangle(x, y, x1, y1, x2, y2, x3, y3)) {
                return i + 1; // Return 1-based index
            }
        }
        return null; // No triangle found
    }

    initCameraMap(cameraMapCanvas) {
        this.cameraMapActive = 1;
        this.cameraMapHover = null;
        this.cameraMapCanvas = cameraMapCanvas;

        this.cameraMapTriangles = [
            [390, 84, 499, 7, 499, 125],
            [-20, -40, 107, 80, 0, 103],
            [303, 180, 376, 249, 279, 249],
            [195, 180, 172, 249, 250, 249],
            [479, 145, 407, 233, 360, 180],
        ];

        this.cameraMapLabels = [
            [408, 87, 1],
            [83, 79, 2],
            [301, 200, 3],
            [192, 202, 4],
            [452, 166, 5],
        ];

        this.cameraMapSummaryLabels = [
            [408, 87, 1],
            [83, 79, 2],
            [301, 200, 3],
            [192, 202, 4],
            [452, 166, 5],
        ];

        // Load /img/raimondi-seat-map.png
        this.cameraMapImg = new Image();
        this.cameraMapImg.src = "/img/raimondi-seat-map.png";
        this.cameraMapImg.onload = () => {
            this.paintCameraMap();
        };
        this.cameraMapImg.onerror = () => {
            console.error("Failed to load the seat map image.");
        };

        this.cameraMapCanvas.addEventListener("mousemove", (event) => {
            const rect = this.cameraMapCanvas.getBoundingClientRect();
            // Calculate the mouse position relative to the canvas
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Find the triangle that contains the mouse position
            const point = this.findTriangleContainingPoint(
                x,
                y,
                this.cameraMapTriangles
            );
            this.cameraMapHover = point;
            this.paintCameraMap();

            // Set mouse pointer if hovering over a triangle
            this.cameraMapCanvas.style.cursor = point ? "pointer" : "default";
        });

        this.cameraMapCanvas.addEventListener("mouseout", () => {
            this.cameraMapHover = null;
            this.paintCameraMap();
        });

        this.cameraMapCanvas.addEventListener("click", (event) => {
            const rect = this.cameraMapCanvas.getBoundingClientRect();
            // Calculate the mouse position relative to the canvas
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Find the triangle that contains the mouse position
            const point = this.findTriangleContainingPoint(
                x,
                y,
                this.cameraMapTriangles
            );
            if (point) {
                this.cameraMapActive = point;
                this.paintCameraMap();
                eventBus.dispatchEvent(
                    new CustomEvent("cameraChangeRequest", {
                        detail: { camera: point },
                    })
                );
            }
        });
    }

    initEkg(ekg, label) {
        this.ekgLabel = label;
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

        this.smoothie.streamTo(ekg, 1000);
        window.setTimeout(() => this.smoothie.stop(), 10);
        this.timeSeries = new TimeSeries();

        this.smoothie.addTimeSeries(this.timeSeries, {
            strokeStyle: "rgb(0, 0, 255)",
            fillStyle: "rgba(0,0,255, 0.4)",
            lineWidth: 3,
        });

        // this.smoothie.addTimeSeries(this.posTimeSeries, {
        //     strokeStyle: "rgb(0, 255, 0, 0.4)",
        //     fillStyle: "rgba(0, 255, 0, 0.0)",
        //     lineWidth: 3,
        // });
        // this.smoothie.addTimeSeries(this.negTimeSeries, {
        //     strokeStyle: "rgb(255, 0, 0, 0.4)",
        //     fillStyle: "rgba(255, 0, 0, 0.0)",
        //     lineWidth: 3,
        // });
    }

    paintCameraMap(summaries, second) {
        // Save summaries and second for mousemove events.  Please refactor.
        summaries = this.pcmSummaries = summaries || this.pcmSummaries;
        second = this.pcmSecond = second || this.pcmSecond;

        var ctx = this.cameraMapCanvas.getContext("2d");
        ctx.drawImage(
            this.cameraMapImg,
            0,
            0,
            this.cameraMapCanvas.width,
            this.cameraMapCanvas.height
        );

        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.fillRect(
            0,
            0,
            this.cameraMapCanvas.width,
            this.cameraMapCanvas.height
        );

        ctx.lineWidth = 2;
        for (let i = 0; i < this.cameraMapTriangles.length; i++) {
            let score =
                summaries &&
                summaries[i] &&
                summaries[i][second] &&
                summaries[i][second].score;

            if (this.cameraMapHover === i + 1) {
                ctx.strokeStyle = "#6d0098ff";
                ctx.fillStyle = "#6d00987F";
            } else if (this.cameraMapActive === i + 1) {
                ctx.strokeStyle = "#3fa7d7ff";
                ctx.fillStyle = "#3fa7d77f";
            } else if (score) {
                const hue = this.scoreToHue(score);
                ctx.strokeStyle = `hsl(${hue}, 100%, 50%, 1)`;
                ctx.fillStyle = `hsl(${hue}, 100%, 50%, 0.5)`;
            } else {
                ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            }
            const triangle = this.cameraMapTriangles[i];
            const [x1, y1, x2, y2, x3, y3] = triangle;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            const label = this.cameraMapLabels[i];
            const [lx, ly, ltext] = label;
            ctx.font = "16px Arial";
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillText(ltext, lx, ly);
        }
    }

    paintEkg(score) {
        this.timeSeries.append(Date.now(), score);
        this.ekgLabel.innerText = score.toFixed(0);
    }

    initSpider(spider) {
        var ctx = spider.getContext("2d");

        var labels = [
            "Anger", //0
            "Disgust", //1
            "Fear", //2
            "Happiness", //3
            "Sadness", //4
            "Surprise", //5
            "Neutral", //6
        ];

        // GROSS TODO FIXME
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

    paintSpider(cores) {
        if (!this.spiderChart) return;

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

    initPpl(canvas) {
        const ctx = canvas.getContext("2d");

        const labels = [];
        const borderColors = [];

        for (let i = 0; i < 100; i++) {
            labels.push(`${i + 1}%`);
            borderColors.push("#3fa7d7");
        }

        if (this.pplChart) this.pplChart.destroy();

        this.pplChart = new Chart(ctx, {
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
        this.pplChart.update();

        canvas.addEventListener("click", (evt) => {
            const points = this.pplChart.getElementsAtEventForMode(
                evt,
                "nearest",
                { intersect: true },
                true
            );

            if (points.length) {
                const firstPoint = points[0];
                const label = this.pplChart.data.labels[firstPoint.index];
                // const value =
                //     this.pplChart.data.datasets[firstPoint.datasetIndex].data[
                //         firstPoint.index
                //     ];
                eventBus.dispatchEvent(
                    new CustomEvent("playerSeekRequest", {
                        detail: { time: label },
                    })
                );
            }
        });
    }

    initDemo(canvas, title, labels, data) {
        const ctx = canvas.getContext("2d");

        var demoChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [title],
                datasets: [
                    {
                        label: labels[0],
                        data: [data[0]],
                        fill: true,
                        borderWidth: 1,
                        borderColor: ["#d94d507f"],
                        backgroundColor: ["#d94d50"],
                    },

                    {
                        label: labels[1],
                        data: [data[1]],
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
        demoChart.update();
    }

    formatTime(seconds) {
        let hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        let minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds - minutes * 60);

        return (
            hours.toString().padStart(2, "0") +
            ":" +
            minutes.toString().padStart(2, "0")
        );
    }

    paintPpl(summary) {
        if (!this.pplChart) return;

        // Only paint it when the summary changes..
        if (this.pplChartSummary === summary) return;
        this.pplChartSummary = summary;

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
            let time = 0;

            for (let j = 0; j < step; j++) {
                people += summary[idx + j].people;
                time += parseInt(summary[idx + j].startTime);
            }

            data.push(people / step);
            labels.push(this.formatTime(time / step));
        }

        // Update the spider chart data
        this.pplChart.data.labels = labels;
        this.pplChart.data.datasets[0].data = data;
        this.pplChart.update();
    }

    reset() {
        this.timeSeries.clear();
    }

    play() {
        this.smoothie.start();
    }

    pause() {
        this.smoothie.stop();
    }
}

export default Viz;
