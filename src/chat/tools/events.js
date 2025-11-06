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

        const result = events.map((event) => ({
            hierarchy: new Hierarchy(event.hierarchy).toEventString(),
            location: event.location,
            name: event.name.replace(/\(Baseball\) /, "").trim(),
            summary: event.summary,
            begin: event.begin.toDate(),
            end: event.end.toDate(),
            duration: event.summary.seconds,
            cameras: event.summary.cameras,
        }));

        return result;
    }
}

export default EventsTool;
export { EventsTool };
