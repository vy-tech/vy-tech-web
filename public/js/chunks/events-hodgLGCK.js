import { d as database } from './db-t5vCVEST.js';

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
}

const eventsData = new EventsData();

export { EventsData as E, eventsData as e };
//# sourceMappingURL=events-hodgLGCK.js.map
