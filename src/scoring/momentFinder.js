import { summarizer } from "./summarizer.js";
import { timeUtil } from "../util/time.js";
import { eventBus } from "../eventbus.js";

class MomentFinder {
    constructor() {
        this.moments = null;

        eventBus.addEventListener("summarizer.ready", () => {
            this.find();
        });

        eventBus.addEventListener("viz.cameraChanged", () => {
            this.find();
        });
    }

    get() {
        return this.moments;
    }

    isSame(s1, s2) {
        const buffer = 180;
        return (
            (s2.startTime >= s1.startTime - buffer &&
                s2.startTime <= s1.endTime + buffer) ||
            (s2.endTime >= s1.startTime - buffer &&
                s2.endTime <= s1.endTime + buffer)
        );
    }

    find() {
        let summary = summarizer.getCurrent();
        let sorted = [...summary];
        let moments = [];

        // Sort by score and limit to top 100
        sorted.sort((a, b) => b.score - a.score);
        sorted.splice(100, sorted.length - 100);

        // Top score is our first moment
        moments.push(sorted.shift());

        while (moments.length < 10 && sorted.length > 0) {
            let moment = sorted.shift();

            // Find any same moment and merge them, or add a new one
            let merge = moments.find((a) => this.isSame(a, moment));
            if (merge) {
                merge.startTime = Math.min(moment.startTime, merge.startTime);
                merge.endTime = Math.max(moment.endTime, merge.endTime);
            } else {
                console.log("Adding..", moment);
                moments.push(moment);
            }
        }

        // Sort moments by time and add time label
        moments.sort((a, b) => a.startTime - b.startTime);
        moments.forEach((a) => (a.label = timeUtil.format(a.startTime)));

        this.moments = moments;

        eventBus.fire("momentFinder.changed");

        return moments;
    }
}

const momentFinder = new MomentFinder();
export default momentFinder;
export { momentFinder, MomentFinder };
