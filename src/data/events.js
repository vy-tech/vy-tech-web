import { database } from "./db.js";
import { timeUtil } from "../util/time.js";
import { orgContext } from "./orgContext.js";

class EventsData {
    constructor() {
        this.current = null;
    }

    get() {
        return this.current;
    }

    getCurrentTitle() {
        if (this.current) {
            let displayText = this.current.description;

            if (this.current.begin) {
                const displayDate = this.current.begin
                    .toDate()
                    .toLocaleDateString();
                const displayDescription = this.current.description.replace(
                    /\(Baseball\) /,
                    ""
                );

                displayText = `${displayDate} - ${displayDescription}`;
            }

            return displayText;
        } else {
            return "(No Event Selected)";
        }
    }

    async getByHierarchy(hierarchy) {
        if (hierarchy == null) {
            this.current = null;
            return null;
        }

        const events = await database.query("events", { hierarchy: hierarchy });

        if (events && events.length > 0) {
            this.current = events[0];
            return this.current;
        } else {
            console.warn("Event not found for hierarchy:", hierarchy);
        }

        this.current = null;
        return null;
    }

    async getAvailable() {
        let orgId = orgContext.getCurrentOrg();
        console.log("Fetching events for org:", orgId);
        const events = await database.query(
            "events",
            { status: "available", oid: orgId },
            "begin"
        );

        console.log(`Found ${events.length} available events for org:`, orgId);
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

    async create(event, timeZone = "America/Los_Angeles") {
        event.begin = timeUtil.asUTC(event.begin, timeZone);
        event.end = timeUtil.asUTC(event.end, timeZone);

        await database.set("events", event);

        return event;
    }
}

const eventsData = new EventsData();
export default EventsData;
export { eventsData, EventsData };
