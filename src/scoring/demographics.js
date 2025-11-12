import { chunksData } from "../data/chunk.js";

class Demographics {
    constructor() {
        this.data = null;
        this.summary = null;
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

        this.summary = Object.values(result).sort((a, b) => a.time - b.time);

        return this.summary;
    }
}

const demographics = new Demographics();

if (typeof window !== "undefined") {
    window._vy_demographics = demographics;
}

export { demographics, Demographics };
