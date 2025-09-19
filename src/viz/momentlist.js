import van from "vanjs-core";

import { eventBus } from "../eventbus.js";
import { momentFinder } from "../scoring/momentFinder.js";

class MomentList {
    constructor() {
        this.count = 10;
        this.container = null;

        eventBus.addEventListener("momentFinder.changed", () => {
            this.update();
        });
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = { ...options };
        this.container = div(merged);

        for (let i = 0; i < this.count; i++) {
            let moment = div(
                {
                    id: `report-moment-${i + 1}`,
                    class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                    onclick: () => {
                        this.seekTo(i + 1);
                    },
                },
                div({ class: "text-2xl mb-1" }, "▶"),
                div({ class: "text-sm" }, "0")
            );
            van.add(this.container, moment);
        }

        return this.container;
    }

    update() {
        let moments = momentFinder.get();

        for (let i = 0; i < this.count; i++) {
            const moment = moments[i];
            const momentDiv = document.getElementById(`report-moment-${i + 1}`);

            if (!momentDiv) continue;

            if (moment) {
                momentDiv.querySelector(
                    "div.text-sm"
                ).textContent = `${moment.label}`;
                momentDiv.style.display = "block";
            } else {
                momentDiv.style.display = "none";
            }
        }
    }

    seekTo(number) {
        let moments = momentFinder.get();
        const moment = moments[number - 1];
        if (moment) {
            eventBus.fire("ui.requestTimeSeek", {
                seconds: moment.startTime - 15,
            });
        }
    }
}

const momentlist = new MomentList();
export default momentlist;
export { momentlist, MomentList };
