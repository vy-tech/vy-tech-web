import van from "vanjs-core";

class Schedule {
    constructor() {}

    init() {
        this.addElements();
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
                div(
                    { class: "flex justify-center items-center" },
                    h1("Schedule")
                )
            )
        );
    }
}

const schedule = new Schedule();
export { Schedule, schedule };
