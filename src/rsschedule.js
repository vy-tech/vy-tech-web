import van from "vanjs-core";

import { eventgrid } from "./viz/eventgrid.js";

class Schedule {
    constructor() {}

    init() {
        this.addElements();
        eventgrid.refresh();
    }

    addElements(parentElement) {
        const { div, main } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] h-screen p-4 overflow-auto" },
                div(
                    { class: "flex justify-center items-center h-full" },
                    eventgrid.createElement({ class: "w-full h-full" })
                )
            )
        );
    }
}

const schedule = new Schedule();
export { Schedule, schedule };
