import { Worker } from "worker_threads";

import { Scenario } from "./scenario.js";
import { annotations } from "../data/annotations.js";
import { Hierarchy } from "../util/hierarchy.js";

class Scenarios {
    constructor(tag = null) {
        this.annotations = [];
        this.scenarios = [];
        this.tag = tag;
    }

    async loadAnnotations() {
        if (this.tag) {
            this.annotations = await annotations.getByTag(this.tag);
        } else {
            this.annotations = await annotations.getByImportance("critical");
            this.annotations = this.annotations.filter(
                (a) => a.type === "action"
            );
        }

        return this.annotations;
    }

    async createScenarios(baseHierarchy, time, cameras = 4) {
        let hier = new Hierarchy(baseHierarchy);

        for (let i = 1; i <= cameras; i++) {
            hier.camera = i;
            let scenario = new Scenario(hier.toString(), time);
            this.scenarios.push(scenario);
        }
    }

    async load() {
        await this.loadAnnotations();

        for (let annotation of this.annotations) {
            await this.createScenarios(annotation.hierarchy, annotation.time);
        }

        for (let scenario of this.scenarios) {
            await scenario.load();
        }
    }

    async evaluate(profile) {
        let evaluations = [];

        for (let scenario of this.scenarios) {
            let scores = await scenario.evaluate(profile);
            evaluations.push({
                hierarchy: scenario.hierarchy,
                time: scenario.time,
                scores: scores,
                fitness: scores.overall,
            });
            console.log(
                `Scenario: ${scenario.hierarchy} @ ${scenario.time} = ${scores.overall}`
            );
        }

        let result = {
            profile: profile,
            evaluations: evaluations,
            fitness:
                evaluations.reduce((sum, e) => sum + e.fitness, 0) /
                evaluations.length,
        };

        console.log(`Profile ${profile.name} - ${profile.description}`);
        console.log(
            `Evals: ${result.evaluations.length} Fitness: ${result.fitness}`
        );

        return result;
    }
}

class ScenarioWorkers extends Scenarios {
    constructor(tag = null, batchSize = 4) {
        super(tag);
        this.scenarioWorkers = [];
        this.batchSize = batchSize;
    }

    createScenarioWorker() {
        const workerCode = `
            import './scripts/jsdom-shim.js';
            import './scripts/firebase-shim.js';
            import { ScenarioWorker } from './src/ga/scenario.js';
            
            // Create and start the worker
            new ScenarioWorker();
        `;

        return new Worker(workerCode, { eval: true });
    }

    async createScenarios(baseHierarchy, time, cameras = 4) {
        let hier = new Hierarchy(baseHierarchy);

        // Instead of passing the hierarchy and time to the
        // constructor we'll do it via a message once the
        // worker is ready.

        for (let i = 1; i <= cameras; i++) {
            hier.camera = i;
            const worker = this.createScenarioWorker();

            this.scenarioWorkers.push({
                worker: worker,
                hierarchy: hier.toString(),
                time: time,
            });
        }
    }

    postMessage(scenarioWorker, type, data, timeout = 60000) {
        const message = { type, data };
        const promise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Worker message timeout after ${timeout}ms`));
            }, timeout);

            scenarioWorker.worker.once("message", (message) => {
                clearTimeout(timer);

                process.stdout.write("<");

                if (message.type === "error") {
                    reject(new Error(message.error));
                } else {
                    resolve(message);
                }
            });

            process.stdout.write(">");
            scenarioWorker.worker.postMessage(message);
        });

        return promise;
    }

    async broadcastMessage(type, dataFunc, timeout = 60000) {
        // const promises = this.scenarioWorkers.map((sw) =>
        //     this.postMessage(sw, type, dataFunc(sw), timeout)
        // );

        const results = [];
        const totalBatches = Math.ceil(
            this.scenarioWorkers.length / this.batchSize
        );

        for (let i = 0; i < this.scenarioWorkers.length; i += this.batchSize) {
            const batchNum = Math.floor(i / this.batchSize) + 1;
            const batch = this.scenarioWorkers.slice(i, i + this.batchSize);

            const t = Date.now();
            process.stdout.write(`Batch ${batchNum}: `);
            const batchResults = await Promise.all(
                batch.map((sw) =>
                    this.postMessage(sw, type, dataFunc(sw), timeout)
                )
            );

            process.stdout.write(` completed in ${Date.now() - t} ms\n`);
            results.push(...batchResults);
        }

        return results;
    }

    checkResponsesType(responses, expectedType) {
        responses.forEach((r) => {
            if (r.type !== expectedType) {
                throw new Error(`Unexpected message type: ${r.type}`);
            }
        });
    }

    async initWorkers() {
        const responses = await this.broadcastMessage("init", (sw) => ({
            hierarchy: sw.hierarchy,
            time: sw.time,
        }));

        this.checkResponsesType(responses, "ready");
    }

    async load() {
        await this.loadAnnotations();

        // Create workers for all scenarios
        for (let annotation of this.annotations) {
            await this.createScenarios(annotation.hierarchy, annotation.time);
        }

        // Initialize all workers
        console.log(
            `Initializing ${this.scenarioWorkers.length} scenario workers...`
        );
        await this.initWorkers();

        console.log(
            `All ${this.scenarioWorkers.length} scenario workers initialized`
        );
    }

    async evaluate(profile) {
        const responses = await this.broadcastMessage("evaluate", (sw) => ({
            profile,
        }));

        this.checkResponsesType(responses, "result");

        const evaluations = responses.map((r) => r.data);

        evaluations.forEach((evaluation) => {
            console.log(
                `Scenario: ${evaluation.hierarchy} @ ${evaluation.time} = ${evaluation.fitness}`
            );
        });

        const result = {
            profile: profile,
            evaluations: evaluations,
            fitness:
                evaluations.reduce((sum, e) => sum + e.fitness, 0) /
                evaluations.length,
        };

        console.log(`Profile ${profile.name} - ${profile.description}`);
        console.log(
            `Evals: ${result.evaluations.length} Fitness: ${result.fitness}`
        );

        return result;
    }

    async cleanup() {
        console.log("Shutting down scenario workers...");

        const responses = await this.broadcastMessage("shutdown", (sw) => ({}));
        this.checkResponsesType(responses, "shutdown-complete");

        // Terminate workers after shutdown
        this.scenarioWorkers.forEach((sw) => {
            sw.worker.terminate();
        });

        this.scenarioWorkers = [];
    }
}

export { Scenarios, ScenarioWorkers };
