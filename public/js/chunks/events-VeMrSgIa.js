import { v as van } from './van-t8DywzvC.js';
import { d as database } from './db-CmBGHhkA.js';
import { e as eventBus } from './eventbus-BbLtLH1t.js';

class Events {
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

    setSelectorToAvailable(state) {
        this.getAvailable().then((events) => {
            state.val = events;
        });
    }

    createOptionElement(eventData, selected) {
        const { option } = van.tags;

        const displayDate = eventData.begin.toDate().toLocaleDateString();
        const displayDescription = eventData.description.replace(
            /\(Baseball\) /,
            ""
        );
        const displayText = `${displayDate} - ${displayDescription}`;
        return option(
            {
                value: eventData.hierarchy,
                selected: eventData.hierarchy == selected,
            },
            displayText
        );
    }

    createSelectorElement(selected) {
        const { div, select } = van.tags;
        const eventListState = van.state([]);
        this.setSelectorToAvailable(eventListState);

        const container = div({ class: "vyevents-selector" }, () => {
            const sel = select({
                id: "report-event-select",
                class: "w-full text-black p-1",
            });

            eventListState.val.forEach((eventData) =>
                van.add(sel, this.createOptionElement(eventData, selected))
            );

            sel.addEventListener("change", (e) => {
                eventBus.dispatchEvent(
                    new CustomEvent("ui.requestEvent", {
                        detail: e.target.value,
                    })
                );
            });

            return sel;
        });

        return container;
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

const events = new Events();

export { events as e };
//# sourceMappingURL=events-VeMrSgIa.js.map
