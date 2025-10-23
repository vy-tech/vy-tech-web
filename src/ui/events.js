import van from "vanjs-core";
import { eventBus } from "../eventbus.js";
import { EventsData } from "../data/events.js";

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
}

const events = new Events();
export default events;
export { events };
