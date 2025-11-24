import { chunksData } from "../data/chunk.js";
import { eventBus } from "../eventbus.js";

class Demographics {
    constructor() {
        this.data = null;
        this.summary = null;
        this.current = {
            male: 0,
            female: 0,
            adult: 0,
            child: 0,
            person: 0,
        };

        eventBus.on("playback.timeupdate", (e) => {
            const second = Math.floor(e.detail.currentTime);
            if (this.summary && second in this.summary) {
                const entry = this.summary[second];

                if (entry.person) this.current.person = entry.person;
                if (entry.adult) {
                    this.current.adult = entry.adult;

                    // Child detection is currently not populating correctly
                    if (this.current.person) {
                        this.current.child = Math.max(
                            this.current.person - this.current.adult,
                            0
                        );
                    }
                }

                if (entry.male) this.current.male = entry.male;
                if (entry.female) this.current.female = entry.female;
            }
        });
    }

    async loadFromCurrentChunk(timeOffset = 0) {
        const chunk = chunksData.get();
        return await this.loadFromChunk(chunk, timeOffset);
    }

    async loadFromChunk(chunk, timeOffset = 0) {
        if (!chunk) return;

        const url = chunk.getDemographicsUrl();
        return await this.loadFromUrl(url, timeOffset);
    }

    async loadFromUrl(url, timeOffset) {
        if (!url) return;

        console.log(`Loading demographics from ${url}`);
        const response = await fetch(url);
        const demographics = await response.json();
        this.data = demographics;

        var result = {};

        for (const entry of demographics) {
            const time = Math.floor(entry.time) + timeOffset;
            result[time] = result[time] || { time };
            result[time][entry.detection] = entry.count;
        }

        let sorted = Object.values(result).sort((a, b) => a.time - b.time);
        this.summary = {};
        for (const entry of sorted) {
            this.summary[Math.floor(entry.time)] = entry;
        }

        return this.summary;
    }
}

const demographics = new Demographics();

if (typeof window !== "undefined") {
    window._vy_demographics = demographics;
}

export { demographics, Demographics };
