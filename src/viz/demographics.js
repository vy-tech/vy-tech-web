import van from "vanjs-core";

class Demographics {
    constructor(title, labels, data) {
        this.canvas = null;
        this.title = title;
        this.labels = labels;
        this.data = data;
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

    init() {
        const ctx = this.canvas.getContext("2d");

        var demoChart = new Chart(ctx, {
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
        demoChart.update();
    }
}

const genderDemo = new Demographics("Gender", ["male", "female"], [60, 40]);
const ageDemo = new Demographics("Age", ["adult", "child"], [80, 20]);

export { genderDemo, ageDemo, Demographics };
