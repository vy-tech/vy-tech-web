import { v as van } from './chunks/van-t8DywzvC.js';
import { e as eventBus } from './chunks/eventbus-DzIYHcTJ.js';
import { L as List, F as Form } from './chunks/db-Byk5c9nh.js';
import './chunks/firebase-DTGT__LK.js';

class Locations {
    constructor() {
        eventBus.addEventListener("addLocationClick", (e) =>
            this.handleAddLocation(e)
        );
    }

    init() {
        this.addElements();
        this.addListElements(document.getElementById("location-list"));
        this.addFormElements(document.getElementById("location-form"));
    }

    addElements(parentElement) {
        const { a, div, main, h1 } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                h1("Locations"),
                div({ id: "location-list" }),
                div({ id: "location-form" })
            )
        );
    }

    addListElements(parentElement) {
        var list = new List("locations", [
            { name: "name", displayName: "Location", row: 0 },
            {
                name: "city",
                displayName: "City",
                row: 1,
                containerClass: "w-1/2",
            },
            {
                name: "state",
                displayName: "State",
                row: 1,
                containerClass: "w-1/2",
            },
        ]);
        list.addElements(parentElement);
    }

    addFormElements(parentElement) {
        var form = new Form("locations", [
            { name: "name", displayName: "Location name", row: 0 },
            { name: "address", displayName: "Address", row: 1 },
            {
                name: "city",
                displayName: "City",
                row: 2,
                containerClass: "w-1/2",
            },
            {
                name: "state",
                displayName: "State",
                row: 2,
                containerClass: "w-1/2",
            },
            { name: "zip", displayName: "Zip code", row: 3 },
        ]);

        form.addElements(parentElement);
    }
}

const locations = new Locations();

export { Locations, locations };
//# sourceMappingURL=rslocations.js.map
