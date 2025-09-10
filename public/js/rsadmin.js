import { v as van } from './chunks/van-t8DywzvC.js';
import { c as collection, f as firestore, g as getDocs } from './chunks/rsdb-CUSZDmYY.js';
import './chunks/eventbus-B2NG0GvW.js';
import './chunks/rsfirebase-IdUc1I6T.js';

class Admin {
    constructor() {
        this.statusLabels = [
            "requested",
            "processing",
            "waiting",
            "failed",
            "completed",
        ];
    }

    async init() {
        this.addElements();
        this.initJobsChart();
        await this.updateJobsChart();
    }

    addElements(parentElement) {
        const { a, div, main, h1, canvas } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                div({ class: "flex justify-center items-center" }, h1("Admin")),
                div(
                    {},
                    canvas({
                        id: "admin-jobs",
                        width: 640,
                        height: 360,
                    })
                )
            )
        );
    }

    async getJobsByStatus() {
        const colRef = collection(firestore, "jobs");
        const snapshot = await getDocs(colRef);

        let result = {
            requested: { status: "requested", count: 0, jobs: [] },
            processing: { status: "processing", count: 0, jobs: [] },
            waiting: { status: "waiting", count: 0, jobs: [] },
            failed: { status: "failed", count: 0, jobs: [] },
            completed: { status: "completed", count: 0, jobs: [] },
        };

        snapshot.forEach((doc) => {
            let data = doc.data();
            let status = result[data.status];
            status.count += 1;
            status.jobs.push(data);
        });

        return result;
    }

    initJobsChart() {
        const canvas = document.getElementById("admin-jobs");
        const ctx = canvas.getContext("2d");

        if (this.jobsChart) this.jobsChart.destroy();

        this.jobsChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: this.statusLabels,
                datasets: [
                    {
                        label: "Status",
                        data: this.statusLabels.map(() => 0),
                        fill: true,
                        borderWidth: 1,
                        borderColor: "red",
                        backgroundColor: "red",
                    },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
            },
        });
        this.jobsChart.update();
    }

    async updateJobsChart() {
        let jobs = await this.getJobsByStatus();
        let data = this.statusLabels.map((label) => jobs[label].count);

        this.jobsChart.data.datasets[0].data = data;
        this.jobsChart.update();
    }
}

const admin = new Admin();
window.admin = admin;

export { Admin, admin };
//# sourceMappingURL=rsadmin.js.map
