import { Scenarios, ScenarioWorkers } from "./scenarios.js";
import { Population } from "./population.js";
import { profilesData } from "../data/profiles.js";

const winningProfileId = "00YJi1sNM5LhKAyTVJTE";

class Engine {
    constructor(
        tag,
        collectionName = "ga_population",
        poolSize = 100,
        newPoolSize = null
    ) {
        this.scenarios = new Scenarios(tag);
        this.population = new Population(collectionName, poolSize, newPoolSize);
        this.stopped = false;
        this.running = false;
    }

    async clear() {
        await this.population.clear();
    }

    async initialize() {
        console.log("Loading scenarios...");
        await this.scenarios.load();
        console.log(`Loaded ${this.scenarios.scenarios.length} scenarios.`);

        console.log("Initializing population...");
        await this.population.initialize();
        console.log(
            `Population initialized with ${this.population.pool.length} profiles.`
        );
    }

    async runGeneration(newPoolSize = null) {
        const startTime = Date.now();
        console.log(`Running generation ${this.population.generation + 1}`);

        const newPool = this.population.breedNewGeneration(newPoolSize);
        for (let profile of newPool) {
            const scores = await this.scenarios.evaluate(profile);
            profile.fitness = scores.fitness;

            if (this.stopped) break;
        }
        this.population.mergeGeneration(newPool);

        const endTime = Date.now();
        console.log(
            `Generation ${this.population.generation + 1} completed in ${(
                (endTime - startTime) /
                1000
            ).toFixed(2)} s`
        );
    }

    showTop(n = 10) {
        console.log(`Top ${n} profiles:`);
        for (let i = 0; i < Math.min(n, this.population.pool.length); i++) {
            const profile = this.population.pool[i];
            console.log(
                `Rank ${i + 1}: ` +
                    `Fitness=${profile.fitness.toFixed(4)}, ` +
                    `Gen=${profile.gen}, ` +
                    `Name=${profile.name}, ` +
                    `Desc=${profile.description}`
            );
        }
    }

    async save() {
        await this.population.save();
        console.log("Population saved.");
    }

    async saveWinningProfile() {
        await profilesData.update(winningProfileId, this.population.pool[0]);
        console.log("Winning profile updated.");
    }

    stop() {
        console.log("Stop requested...");
        this.stopped = true;
    }

    async evolve(generations = 10, newPoolSize = null) {
        this.running = true;
        for (let gen = 0; gen < generations; gen++) {
            await this.runGeneration(newPoolSize);
            this.showTop(10);
            await this.save();
            await this.saveWinningProfile();

            if (this.stopped) break;
        }
        this.running = false;
    }
}

class WorkersEngine extends Engine {
    constructor(
        tag,
        collectionName = "ga_population",
        poolSize = 100,
        newPoolSize = null,
        workerBatchSize = null
    ) {
        super(tag, collectionName, poolSize, newPoolSize);
        workerBatchSize = workerBatchSize || navigator.hardwareConcurrency || 4;
        this.scenarios = new ScenarioWorkers(tag, workerBatchSize);
        this.population = new Population(collectionName, poolSize, newPoolSize);
    }

    async finish() {
        await this.scenarios.cleanup();
        console.log("Engine cleanup completed.");
    }
}

export { Engine, WorkersEngine };
