import { EventsData } from "../../data/events.js";
import { Hierarchy } from "../../util/hierarchy.js";

class EventsTool {
    constructor() {
        this.data = new EventsData();
    }

    get name() {
        return "events_list";
    }

    get description() {
        return "Get a list of available events";
    }
    get parameters() {
        return null;
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        const events = await this.data.getAvailable();

        // An event becomes "available" when it's captured, but `summary` is
        // written by a later processing pass — so a recently captured event
        // legitimately has no summary yet, and one such event used to throw
        // here and take the whole tool call (and the conversation waiting on
        // it) down with it. Report those events with the fields they do have
        // rather than dropping them, so the model still knows they exist.
        const result = events.map((event) => {
            const summary = event.summary || {};

            return {
                hierarchy: new Hierarchy(event.hierarchy).toEventString(),
                location: event.location,
                name: (event.name || "").replace(/\(Baseball\) /, "").trim(),
                summary: event.summary,
                begin: this.toDate(event.begin),
                end: this.toDate(event.end),
                duration: summary.seconds,
                cameras: summary.cameras,
            };
        });

        return result;
    }

    // Firestore hands back Timestamps here, but the same records arrive as
    // plain Dates through other paths, and an unprocessed event may carry
    // neither.
    toDate(value) {
        if (!value) return null;
        return typeof value.toDate === "function" ? value.toDate() : value;
    }
}

export default EventsTool;
export { EventsTool };
