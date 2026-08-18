import { Summarizer } from "../../scoring/summarizer.js";
import { Hierarchy } from "../../util/hierarchy.js";

class SummarySecondsTool {
    constructor() {}

    get name() {
        return "get_summary_seconds";
    }

    get description() {
        return "Get per second engagement summary for a given hierarchy";
    }

    get parameters() {
        return {
            type: "object",
            properties: {
                hierarchy: {
                    type: "string",
                    description:
                        'The hierarchy identifier ("location:date:camera" eg:"raimondi:20250711:01") for the event to summarize',
                },
                start: {
                    type: "number",
                    description:
                        "The starting second for the summary (inclusive, optional)",
                },
                end: {
                    type: "number",
                    description:
                        "The ending second for the summary (exclusive, optional)",
                },
            },
            required: ["hierarchy"],
        };
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        if (!args.hierarchy) {
            throw new Error("Hierarchy argument is required");
        }

        const hierarchy = new Hierarchy(args.hierarchy);
        const summarizer = new Summarizer();
        const summary = await summarizer.loadFromStorage(
            hierarchy.toString("-")
        );

        const start = args.start !== undefined ? args.start : 0;
        const end = args.end !== undefined ? args.end : summary.length;

        return summary.slice(start, end);
    }
}

class SummaryMinutesTool {
    constructor() {}

    get name() {
        return "get_summary_minutes";
    }
    get description() {
        return "Get per minute engagement summary for a given hierarchy";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                hierarchy: {
                    type: "string",
                    description:
                        'The hierarchy identifier ("location:date:camera" eg:"raimondi:20250711:01") for the event to summarize',
                },
            },
            required: ["hierarchy"],
        };
    }
    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        if (!args.hierarchy) {
            throw new Error("Hierarchy argument is required");
        }

        const hierarchy = new Hierarchy(args.hierarchy);

        if (hierarchy.camera == null) {
            throw new Error(
                "Hierarchy must include a camera for minute summary"
            );
        }

        const summarizer = new Summarizer();
        const summary = await summarizer.loadFromStorage(
            hierarchy.toString("-")
        );
        const minutesSummary = [];
        for (let i = 0; i < summary.length; i += 60) {
            const minuteSlice = summary.slice(i, i + 60);

            const minuteSum = {
                startTime: minuteSlice[0].startTime,
                endTime: minuteSlice[minuteSlice.length - 1].endTime,
                total: 0,
                people: 0,
                min: 99999999,
                max: -99999999,
                average: 0,
                stddev: 0,
            };

            let sumOfSquares = 0;
            for (const sec of minuteSlice) {
                minuteSum.total += sec.score;
                minuteSum.people += sec.people;
                minuteSum.min = Math.min(minuteSum.min, sec.score);
                minuteSum.max = Math.max(minuteSum.max, sec.score);
                sumOfSquares += sec.score * sec.score;
            }

            minuteSum.average = minuteSum.total / minuteSlice.length;
            minuteSum.people = minuteSum.people / minuteSlice.length;

            // Sample standard deviation (divide by n-1)
            if (minuteSlice.length > 1) {
                const variance =
                    (sumOfSquares -
                        minuteSlice.length *
                            minuteSum.average *
                            minuteSum.average) /
                    (minuteSlice.length - 1);
                minuteSum.stddev = Math.sqrt(variance);
            } else {
                minuteSum.stddev = 0;
            }

            minutesSummary.push(minuteSum);
        }

        return minutesSummary;
    }
}

export default SummarySecondsTool;
export { SummarySecondsTool, SummaryMinutesTool };
