import { d as database } from './apiUtil-CDq4WBQY.js';
import { H as Hierarchy, t as timeUtil } from './hierarchy-BeeefNz4.js';
import { o as orgContext } from './orgContext-CvnztG5e.js';

class EventsData {
    constructor() {
        // this.event = null;
    }

    // get() {
    //     return this.event;
    // }

    getTitle(event) {
        if (event) {
            let displayText = event.description;

            if (event.begin) {
                const displayDate = event.begin.toDate().toLocaleDateString();
                const displayDescription = event.description.replace(
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

    async getById(id) {
        return await database.get("events", id) || null;
    }

    async getByHierarchy(hierarchy) {
        if (hierarchy == null) {
            this.event = null;
            return null;
        }

        let h = new Hierarchy(hierarchy);

        if (!h.date && !h.event) {
            console.warn("Invalid hierarchy for event lookup:", hierarchy);
            this.event = null;
            return null;
        }

        let events = await database.query("events", {
            hierarchy: h.toEventString(),
        });

        // Try falling back to camera 1 if no event found
        if (events.length === 0) {
            h.camera = 1;
            events = await database.query("events", {
                hierarchy: h.toString(),
            });
        }

        if (events && events.length > 0) {
            this.event = events[0];
            return this.event;
        } else {
            console.warn("Event not found for hierarchy:", h.toEventString());
        }

        this.event = null;
        return null;
    }

    async getByOrg(oid, { status, location } = {}) {
        const filters = { oid };
        if (status) filters.status = status;
        if (location) filters.location = location;
        return await database.query("events", filters, "begin");
    }

    async getAvailable() {
        let orgId = orgContext.getCurrentOrgId();
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
            this.event.hierarchy == hierarchy
                ? this.event
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

export { EventsData as E, eventsData as e };
//# sourceMappingURL=events-D5QflqmM.js.map
