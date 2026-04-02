import van from './van-CscOHmlp.js';
import { eventBus } from './eventbus-CgpxZhAr.js';
import { E as EventsData, H as Hierarchy } from './events-DqRG79sU.js';

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

    createNavigationElement(selected) {
        const { div, details, summary, ul, li, i } = van.tags;
        const eventListState = van.state([]);
        const selectedState = van.state(selected || null);
        this.setSelectorToAvailable(eventListState);

        const groupEvents = (events) => {
            const grouped = new Map(); // location -> Map(year -> Map(monthName -> events[]))
            for (const evt of events) {
                const h = new Hierarchy(evt.hierarchy);
                const loc = h.location || "Unknown";
                const date = h.date || 19700101;

                const year = Math.floor(date / 10000);
                const month = Math.floor((date % 10000) / 100);

                if (!grouped.has(loc)) grouped.set(loc, new Map());
                const byYear = grouped.get(loc);
                if (!byYear.has(year)) byYear.set(year, new Map());
                const byMonth = byYear.get(year);
                if (!byMonth.has(month)) byMonth.set(month, []);
                byMonth.get(month).push(evt);
            }
            return grouped;
        };

        const leafLabel = (evt) => {
            if (evt.begin) {
                const date = evt.begin.toDate().toLocaleDateString();
                const desc = evt.description.replace(/\(Baseball\) /, "");
                return `${date} - ${desc}`;
            }
            return evt.description;
        };

        const container = div({ class: "vyevents-nav" }, () => {
            const grouped = groupEvents(eventListState.val);
            const sel = selectedState.val;
            const selHierarchy = new Hierarchy(sel);
            const selLocation = selHierarchy.location;
            const selYear = selHierarchy.date
                ? Math.floor(selHierarchy.date / 10000)
                : null;
            const selMonth = selHierarchy.date
                ? Math.floor((selHierarchy.date % 10000) / 100)
                : null;
            const locations = [...grouped.keys()];

            if (locations.length === 0) {
                return div(
                    { class: "p-4 text-gray-500" },
                    "No available events for the current organization."
                );
            }

            return div(
                ...locations.map((loc) => {
                    const byYear = grouped.get(loc);
                    const years = [...byYear.keys()].sort((a, b) => b - a);
                    return details(
                        { open: locations.length === 1 || loc === selLocation },
                        summary(
                            {
                                class: "cursor-pointer font-semibold p-1 select-none",
                            },
                            loc
                        ),
                        ...years.map((year) => {
                            const byMonth = byYear.get(year);
                            return details(
                                {
                                    open:
                                        years.length === 1 || year === selYear,
                                },
                                summary(
                                    {
                                        class: "cursor-pointer ml-2 p-1 select-none",
                                    },
                                    String(year)
                                ),
                                ...[...byMonth.keys()].map((month) =>
                                    details(
                                        { open: month === selMonth },
                                        summary(
                                            {
                                                class: "cursor-pointer ml-4 p-1 select-none",
                                            },
                                            month
                                        ),
                                        ul(
                                            { class: "ml-6 list-none" },
                                            ...byMonth.get(month).map((evt) =>
                                                li(
                                                    {
                                                        class: `cursor-pointer p-1 rounded hover:bg-blue-600${evt.hierarchy === sel ? " font-bold bg-blue-500" : ""}`,
                                                        onclick: () => {
                                                            selectedState.val =
                                                                evt.hierarchy;
                                                            eventBus.dispatchEvent(
                                                                new CustomEvent(
                                                                    "ui.requestEvent",
                                                                    {
                                                                        detail: evt.hierarchy,
                                                                    }
                                                                )
                                                            );
                                                        },
                                                    },
                                                    i({
                                                        class: `las la-calendar-day mr-2 flex-shrink-0`,
                                                    }),
                                                    leafLabel(evt)
                                                )
                                            )
                                        )
                                    )
                                )
                            );
                        })
                    );
                })
            );
        });

        eventBus.on("org.changed", () => {
            selectedState.val = null;
            this.setSelectorToAvailable(eventListState);
            eventBus.fire("ui.requestEvent", null);
        });

        return container;
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
            eventBus.fire("ui.requestEvent", null);
        });

        return container;
    }
}

const events = new Events();

export { events as e };
//# sourceMappingURL=events-Dinh3ncj.js.map
