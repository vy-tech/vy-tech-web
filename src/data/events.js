import van from "vanjs-core";
import { app } from "../rsfirebase.js";
import {
    getFirestore,
    collection,
    getDocs,
    where,
    orderBy,
    query,
    limit,
} from "firebase/firestore";
import { eventBus } from "../eventbus.js";

class Events {
    constructor() {
        this.current = null;
    }

    get() {
        return this.current;
    }

    async loadFromFirestore(hierarchy) {
        const firestore = getFirestore(app);
        const eventsRef = collection(firestore, "events");
        const q = query(
            eventsRef,
            where("hierarchy", "==", hierarchy),
            limit(1)
        );
        const docs = await getDocs(q);

        if (docs.empty) {
            this.current = null;
            return null;
        } else {
            let eventData = null;
            docs.forEach((doc) => {
                eventData = { id: doc.id, ...doc.data() };
            });
            this.current = eventData;
            return eventData;
        }
    }

    async queryAvailableEvents() {
        const firestore = getFirestore(app);
        const eventsRef = collection(firestore, "events");
        const q = query(
            eventsRef,
            where("status", "==", "available"),
            orderBy("begin")
        );
        const docs = await getDocs(q);

        return docs;
    }

    loadAvailableEvents(state) {
        this.queryAvailableEvents().then((docs) => {
            const result = [];
            docs.forEach((doc) => {
                result.push({ id: doc.id, ...doc.data() });
            });

            state.val = result;
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
        this.loadAvailableEvents(eventListState);

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
