import { v as van } from './van-t8DywzvC.js';
import { e as eventBus } from './eventbus-B9JUr222.js';
import { E as EventsData } from './events-B3vAjkhd.js';

class Events extends EventsData {
    constructor() {
        super();
    }

    setSelectorToAvailable(state) {
        this.getAvailable().then((events) => {
            state.val = events;
        });
    }

    createOptionElement(eventData, selected) {
        const { option } = van.tags;

        let displayText = eventData.description;

        if (eventData.begin) {
            const displayDate = eventData.begin.toDate().toLocaleDateString();
            const displayDescription = eventData.description.replace(
                /\(Baseball\) /,
                ""
            );
            displayText = `${displayDate} - ${displayDescription}`;
        }

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

            van.add(
                sel,
                this.createOptionElement(
                    {
                        hierarchy: "",
                        description: "(Select an Event)",
                    },
                    selected
                )
            );
            eventListState.val.forEach((eventData) =>
                van.add(sel, this.createOptionElement(eventData, selected))
            );

            sel.addEventListener("change", (e) => {
                const hierarchy = e.target.value == "" ? null : e.target.value;
                eventBus.dispatchEvent(
                    new CustomEvent("ui.requestEvent", {
                        detail: hierarchy,
                    })
                );
            });

            return sel;
        });

        eventBus.on("org.changed", () => {
            this.setSelectorToAvailable(eventListState);
        });

        return container;
    }
}

const events = new Events();

export { events as e };
//# sourceMappingURL=events-DrmZLZx5.js.map
