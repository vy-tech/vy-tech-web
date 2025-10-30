import { database } from "./db.js";
import { timeUtil } from "../util/time.js";

class EventsData {
    constructor() {
        this.current = null;
    }

    get() {
        return this.current;
    }

    async getByHierarchy(hierarchy) {
        const events = await database.query("events", { hierarchy: hierarchy });

        if (events && events.length > 0) {
            this.current = events[0];
            return this.current;
        }

        this.current = null;
        return null;
    }

    async getAvailable() {
        const events = await database.query(
            "events",
            { status: "available" },
            "begin"
        );
        return events;
    }

    async updateEventSummary(hierarchy, summary) {
        let event =
            this.current.hierarchy == hierarchy
                ? this.current
                : await this.getByHierarchy(hierarchy);

        if (!event) {
            console.warn(`Event not found: ${hierarchy}`);
            return;
        }

        event.summary = summary;

        await database.update("events", event.id, event);
    }

    async create(event, timeZone="America/Los_Angeles") {
        event.begin = timeUtil.asUTC(event.begin, timeZone);
        event.end = timeUtil.asUTC(event.end, timeZone);

        await database.set("events", event);
        
        return event;
    }
}

const eventsData = new EventsData();
export default EventsData;
export { eventsData, EventsData };
