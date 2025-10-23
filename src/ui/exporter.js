import { summarizer } from "../scoring/summarizer.js";
import { annotations } from "./annotations.js";
import { timeUtil } from "../util/time.js";
import { eventBus } from "../eventbus.js";
import { Hierarchy } from "../util/hierarchy.js";

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

let exporter = new Exporter();

export default exporter;
export { exporter, Exporter };
