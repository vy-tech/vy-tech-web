class Viz {
    constructor() {}

    paintHeatmap(canvas, activeBoxes) {
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
            // Use array destructuring for Int32Array
            const [ox, oy, ow, oh, score, expires] = box;

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
            const outerR = h / 2;

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
            const alpha = Math.floor((expires / 10000.0) * 50);
            gradient.addColorStop(0, `hsl(${hue}, 100%, 50%, ${alpha}%)`);
            gradient.addColorStop(1, `hsl(${hue}, 100%, 50%, 0%)`);
            ctx.fillStyle = gradient;

            ctx.fillRect(rx, ry, rw, rh);
        }
    }

    initEkg(ekg) {
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

    paintEkg(score) {
        this.timeSeries.append(Date.now(), score);
    }

    initSpider(spider) {
        var ctx = spider.getContext("2d");

        var labels = [
            "Anger",
            "Disgust",
            "Fear",
            "Happiness",
            "Sadness",
            "Surprise",
            "Neutral",
        ];

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

        // Update the spider chart data
        this.spiderChart.data.datasets[0].data = cores.map((c) =>
            Math.min(1000, Math.abs(c))
        );
        this.spiderChart.update();
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
