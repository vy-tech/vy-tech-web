import { parentPort } from "worker_threads";

import { database } from "../data/db.js";
import { Score } from "../scoring/scoring.js";
import { Fitness } from "../scoring/fitness.js";

class Scenario {
    constructor(hierarchy, time) {
        this.hierarchy = hierarchy;
        this.time = time;
        this.scoring = null;
        this.rawData = null;
        this.spilloverRawData = null;
        this.fitness = null;
    }

    async getChunks() {
        let chunks =
            (await database.query("chunks", {
                hierarchy: this.hierarchy,
            })) || [];

        chunks.sort((a, b) => a.minuteOfDay - b.minuteOfDay);

        return chunks;
    }

    getMinuteOfDay(creationTime, videoTime) {
        const startDate = new Date(creationTime);
        const targetDate = new Date(startDate.getTime() + videoTime * 1000);
        return targetDate.getUTCHours() * 60 + targetDate.getUTCMinutes();
    }

    isNearEndOfVideo(time, duration = 15) {
        // Videos are broken into 1 minute chunks.  This returns
        // true if the videoTime is within the last 15 seconds of a chunk.

        return time % 60 >= 60 - duration;
    }

    getChunkTime(firstCreationTime, chunkCreationTime) {
        const startDate = new Date(firstCreationTime);
        const chunkDate = new Date(chunkCreationTime);
        const chunkTime = (chunkDate - startDate) / 1000.0;
        const offset = this.time - chunkTime;

        return offset;
    }

    getSourceURL(chunk) {
        if (!chunk) return null;
        // Construct the URL based on the storage type
        let path = chunk.expressionsPath;
        let prefix = "";
        let suffix = "";

        if (chunk.storage == "firebase") {
            prefix =
                "https://firebasestorage.googleapis.com/v0/b/roarscore-1ddf5.firebasestorage.app/o/";
            suffix = "?alt=media&ext=.json";
        } else if (chunk.storage == "minio") {
            prefix = "https://storage.roarscore.ai/production/";
        }
        else if (chunk.storage == "seaweed") {
            prefix = "https://s.vy.vision/";
        }

        return `${prefix}${path}${suffix}`;
    }

    async load() {
        const scoring = new Score();

        const chunks = await this.getChunks();
        const minuteOfDay = this.getMinuteOfDay(
            chunks[0].creationTime,
            this.time
        );

        let chunk = chunks.find((c) => c.minuteOfDay === minuteOfDay);
        let totalRows = 0;

        this.chunkTime = this.getChunkTime(
            chunks[0].creationTime,
            chunk.creationTime
        );
        this.rawData = await scoring.loadDetections(this.getSourceURL(chunk));
        totalRows += this.rawData.length;

        // If we're near the end of the video chunk, load the next chunk as spillover data
        if (this.isNearEndOfVideo(this.time)) {
            chunk = chunks.find((c) => c.minuteOfDay === minuteOfDay + 1);
            this.spilloverRawData = await scoring.loadDetections(
                this.getSourceURL(chunk)
            );
            totalRows += this.spilloverRawData.length;
        }

        console.log(
            `Scenario ${this.hierarchy} @ ${this.time} loaded ${totalRows} rows.`
        );
    }

    deepCopy(rows) {
        return structuredClone(rows);
    }

    initWindow(profile) {
        if (!this.rawData) {
            throw new Error("Scenario not loaded");
        }

        this.scoring = new Score();

        // Apply the profile parameters to the scoring engine
        this.scoring.applyProfileToParams(profile.params);

        // Apply the profile to our preloaded raw data and append to the scoring window
        let rows = this.deepCopy(this.rawData);
        this.scoring.applyTime(rows, 0.0);
        this.scoring.ensureTracking(rows);
        this.scoring.applyFilters(rows);
        this.scoring.applyProfile(rows, profile);
        this.scoring.appendToWindow(rows);

        // If we have spillover data, apply the profile and append as well
        if (this.spilloverRawData) {
            const timeOffset = this.scoring.getWindowEndTime();
            let spilloverRows = this.deepCopy(this.spilloverRawData);
            this.scoring.applyTime(spilloverRows, timeOffset);
            this.scoring.ensureTracking(spilloverRows);
            this.scoring.applyFilters(spilloverRows);
            this.scoring.applyProfile(spilloverRows, profile);
            this.scoring.appendToWindow(spilloverRows);
        }

        //console.log(`Scenario ${this.hierarchy} @ ${this.time} window initialized with ${this.scoring.window.length} rows.`);
    }

    async evaluate(profile) {
        if (!this.rawData) {
            throw new Error("Scenario not loaded");
        }

        // Set up the scoring window with the profile we're evaluating
        this.initWindow(profile);

        // Set up the fitness evaluator
        this.fitness = new Fitness(this.scoring);
        await this.fitness.buildScores();

        // Evaluate the fitness and return the scores
        const scores = this.fitness.evaluate(this.chunkTime);

        return scores;
    }
}

class ScenarioWorker {
    constructor() {
        this.scenario = null;
        this.isReady = false;
        this.setupMessageHandler();
    }

    setupMessageHandler() {
        parentPort.on("message", async (message) => {
            const { type, data } = message;

            try {
                switch (type) {
                    case "init":
                        await this.initialize(data.hierarchy, data.time);
                        break;

                    case "evaluate":
                        await this.evaluate(data.profile);
                        break;

                    case "shutdown":
                        this.shutdown();
                        break;

                    default:
                        throw new Error(`Unknown message type: ${type}`);
                }
            } catch (error) {
                this.sendError(error.message, data?.profileIndex);
            }
        });
    }

    async initialize(hierarchy, time) {
        try {
            console.log(`Worker initializing scenario: ${hierarchy} @ ${time}`);
            this.scenario = new Scenario(hierarchy, time);
            await this.scenario.load();
            this.isReady = true;

            this.sendMessage({
                type: "ready",
                hierarchy: hierarchy,
                time: time,
            });
        } catch (error) {
            this.sendError(`Initialization failed: ${error.message}`);
        }
    }

    async evaluate(profile) {
        if (!this.isReady) {
            throw new Error("Worker not ready - call init first");
        }

        try {
            const scores = await this.scenario.evaluate(profile);

            this.sendMessage({
                type: "result",
                data: {
                    hierarchy: this.scenario.hierarchy,
                    time: this.scenario.time,
                    scores: scores,
                    fitness: scores.overall,
                },
            });
        } catch (error) {
            this.sendError(`Evaluation failed: ${error.message}`);
        }
    }

    shutdown() {
        this.sendMessage({ type: "shutdown-complete" });
        process.exit(0);
    }

    sendMessage(message) {
        parentPort.postMessage(message);
    }

    sendError(errorMessage) {
        this.sendMessage({
            type: "error",
            error: errorMessage,
            hierarchy: this.scenario?.hierarchy,
            time: this.scenario?.time,
        });
    }
}

export { Scenario, ScenarioWorker };
