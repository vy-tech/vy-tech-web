import { expressionsData } from "../../data/expressions.js";
import { Hierarchy } from "../../util/hierarchy.js";
import { eventBus } from "../../eventbus.js";

const ALL_CAMERAS = [1, 2, 3, 4, 5];

// Soft cap on rows loaded per camera. The crowd map samples again on the way
// in (crowdMap.maxPointsPerCamera), so this only bounds transient memory.
const MAX_ROWS_PER_CAMERA = 20000;

// Width of one scrub step. Detections arrive ~3/sec, so a few seconds sees
// everyone present without smearing across real movement.
const WINDOW_SECONDS = 4;

/**
 * Show the user a crowd sentiment map for a moment or span during an event.
 *
 * Unlike the other tools in this directory, this one has a side effect beyond
 * its return value: it fires `ui.showCrowdSnapshot` on the eventBus so the chat
 * banner (Chat.showCrowdSnapshot in src/rschat.js) renders it. The returned
 * JSON is the compact version the model reasons about; the banner receives the
 * detection rows, which it immediately reduces to plotted points.
 *
 * Data is addressed through the chunks API (src/data/expressions.js), not the
 * HLS playlist path — the latter is built for a single player driving a single
 * camera and needs a playlist load per camera just to locate the JSON.
 */
class CrowdSnapshotTool {
    constructor() {}

    get name() {
        return "show_crowd_snapshot";
    }

    get description() {
        return (
            "Display a visual crowd map to the user for a moment or span of " +
            "time during an event. Shows approximately where people were " +
            "sitting in each camera's view and how positive or negative their " +
            "expressions were. Use this when a moment is worth showing rather " +
            "than only describing. Returns a per-camera summary of how many " +
            "people were visible and their average sentiment."
        );
    }

    get parameters() {
        return {
            type: "object",
            properties: {
                hierarchy: {
                    type: "string",
                    description:
                        'The hierarchy identifier for the event ("location:date" ' +
                        'eg:"raimondi:20250711"). Any camera segment is ignored; ' +
                        "cameras are chosen with the `cameras` argument.",
                },
                startTime: {
                    type: "number",
                    description:
                        "Start of the span to show, in seconds from the start of the event.",
                },
                endTime: {
                    type: "number",
                    description:
                        "End of the span, in seconds from the start of the event. " +
                        "Omit to show a single instant at startTime.",
                },
                cameras: {
                    type: "array",
                    items: { type: "number" },
                    description:
                        "Which cameras to show (1-5). Omit to show all five.",
                },
            },
            required: ["hierarchy", "startTime"],
        };
    }

    get supportsCursors() {
        return false;
    }

    normalizeCameras(cameras) {
        if (!Array.isArray(cameras) || !cameras.length) return ALL_CAMERAS;
        const picked = cameras
            .map((c) => parseInt(c, 10))
            .filter((c) => ALL_CAMERAS.includes(c));
        return picked.length ? [...new Set(picked)] : ALL_CAMERAS;
    }

    async invoke(args = {}) {
        if (!args.hierarchy) {
            throw new Error("Hierarchy argument is required");
        }
        if (typeof args.startTime !== "number") {
            throw new Error("startTime argument is required");
        }

        const hier = new Hierarchy(args.hierarchy);
        const cameras = this.normalizeCameras(args.cameras);
        const startTime = args.startTime;
        const endTime =
            typeof args.endTime === "number" ? args.endTime : args.startTime;

        // A bare instant still gets one window, so the view model is uniform.
        const spanEnd =
            endTime > startTime ? endTime : startTime + WINDOW_SECONDS;

        const { steps, errors } = await expressionsData.loadWindowsForCameras(
            hier,
            cameras,
            startTime,
            spanEnd,
            WINDOW_SECONDS,
            MAX_ROWS_PER_CAMERA
        );

        const label = this.buildLabel(hier, startTime, endTime);
        eventBus.fire("ui.showCrowdSnapshot", {
            steps,
            label,
            hierarchy: hier.toString(":"),
            startTime,
            endTime: spanEnd,
            windowSeconds: WINDOW_SECONDS,
        });

        return {
            displayed: true,
            hierarchy: hier.toString(":"),
            startTime,
            endTime: spanEnd,
            windowSeconds: WINDOW_SECONDS,
            steps: steps.length,
            // Per-step, per-camera people counts and mean sentiment, so the
            // model can talk about how the crowd changed across the span
            // rather than only its average.
            timeline: steps.map((step) => ({
                time: Math.round(step.time),
                cameras: this.summarizeStep(step, cameras),
            })),
            errors: errors.length ? errors : undefined,
        };
    }

    // One step's per-camera counts. Each person is collapsed to one entry per
    // window, so this counts distinct tracks rather than raw detections.
    //
    // `approximatePeople` is deliberately hedged: it is the number of distinct
    // tracks seen during the window, which overcounts. Some of that is real
    // (more people pass through a 4s window than are visible in any one
    // frame), and some is track fragmentation the tracker can't fully avoid on
    // ~0.33s detection cadence. Measured against the samples it runs ~2x the
    // per-frame headcount. It is a good relative signal across cameras and
    // across time; it is not an attendance figure.
    summarizeStep(step, cameras) {
        const out = {};
        for (const camera of cameras) {
            const people = (step.byCamera && step.byCamera[camera]) || [];
            if (!people.length) continue;
            let sum = 0;
            for (const person of people) sum += person.score || 0;
            out[camera] = {
                approximatePeople: people.length,
                averageSentiment: Math.round(sum / people.length),
            };
        }
        return out;
    }

    buildLabel(hier, startTime, endTime) {
        const span =
            endTime > startTime
                ? `${this.formatTime(startTime)}–${this.formatTime(endTime)}`
                : this.formatTime(startTime);
        return `${hier.toString(":")} @ ${span}`;
    }

    formatTime(seconds) {
        const s = Math.max(0, Math.floor(seconds));
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;
        const pad = (n) => n.toString().padStart(2, "0");
        return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
    }
}

export default CrowdSnapshotTool;
export { CrowdSnapshotTool };
