import van from "vanjs-core";

import { eventBus } from "../eventbus.js";
import { demographics } from "../scoring/demographics.js";

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

export { genderDemo, ageDemo, Demographics };
