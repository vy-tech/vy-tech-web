import {
    profilesData,
    defaultScoringParams,
    defaultEmotionWeights,
} from "../data/profiles.js";
import { database } from "../data/db.js";

class Population {
    constructor(
        collectionName = "ga_population",
        poolSize = 100,
        newPoolSize = null
    ) {
        this.collectionName = collectionName;
        this.poolSize = poolSize;
        this.newPoolSize = newPoolSize;
        this.pool = [];
        this.generation = 0;
    }

    async initialize() {
        // Restore the existing pool
        await this.restore();

        // If the pool is empty, seed it with default profiles
        if (this.pool.length === 0) {
            await this.seed();
        }
    }

    async seed() {
        const allProfiles = await profilesData.getAll();
        if (allProfiles.length === 0) {
            throw new Error("No profiles available to seed the population.");
        }

        // Randomly breed profiles to fill the pool
        while (this.pool.length < this.poolSize) {
            const mom =
                allProfiles[Math.floor(Math.random() * allProfiles.length)];
            const dad =
                allProfiles[Math.floor(Math.random() * allProfiles.length)];
            this.pool.push(this.breedProfiles(mom, dad, 0, this.pool.length));
        }
    }

    async restore() {
        const rows = await database.query(this.collectionName);
        this.pool = rows || [];
        this.generation = rows.reduce((max, p) => Math.max(max, p.gen || 0), 0);
    }

    async clear() {
        console.log("Deleting old population data...");
        await database.deleteAll(this.collectionName);
    }

    async save() {
        await this.clear();

        process.stdout.write("Saving population data...");
        let i = 0;
        for (let row of this.pool) {
            await database.set(this.collectionName, row);
            process.stdout.write(
                `\rSaving population data... ${++i}/${this.pool.length}`
            );
        }
        process.stdout.write("\n");
    }

    breedProfiles(mom, dad, gen, index) {
        const newEmotions = { ...mom.emotions };
        const newParams = { ...dad.params };

        const emotionMutation = this.mutateEmotions(newEmotions);
        const paramMutation = this.mutateParams(newParams);

        const child = {
            name: `GA ${gen}.${index}`,
            description: `${mom.name}.${emotionMutation} + ${dad.name}.${paramMutation}`,
            gen: gen,
            emotions: newEmotions,
            params: newParams,
            scores: {},
            fitness: 0,
        };

        return child;
    }

    add(child) {
        this.pool.push(child);
        // Sort by fitness (higher is better)
        this.pool.sort((a, b) => b.fitness - a.fitness);
    }

    cull() {
        // Limit to pool size
        const survivors = this.pool.slice(0, this.poolSize);
        this.pool = survivors;
    }

    select(tournamentSize = 3) {
        if (this.pool.length === 0) {
            throw new Error("Cannot select from empty pool");
        }

        // Handle case where tournament size is larger than pool
        const actualTournamentSize = Math.min(tournamentSize, this.pool.length);
        const tournament = [];

        // Pick random individuals for tournament
        for (let i = 0; i < actualTournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * this.pool.length);
            tournament.push(this.pool[randomIndex]);
        }

        // Return the fittest from the tournament
        return tournament.reduce((best, current) =>
            current.fitness > best.fitness ? current : best
        );
    }

    mutateEmotions(emotions) {
        // Pick a random emotion to mutate
        const emotionKeys = Object.keys(defaultEmotionWeights);
        const keyToMutate =
            emotionKeys[Math.floor(Math.random() * emotionKeys.length)];

        // Mutate the selected emotion by a small random amount
        const mutationAmount = Math.random() * 0.2 - 0.1;
        emotions[keyToMutate] += mutationAmount;

        return keyToMutate;
    }

    mutateBoolean(value) {
        return !value;
    }

    mutateChoice(value, choices) {
        const newChoices = choices.filter((c) => c !== value);
        return newChoices[Math.floor(Math.random() * newChoices.length)];
    }

    mutateNumber(value, defaultValue) {
        const maxMagnitude =
            defaultValue == 0 ? 0.1 : Math.abs(defaultValue) / 10;
        const mutationAmount = Math.random() * 2 * maxMagnitude - maxMagnitude;
        return value + mutationAmount;
    }

    hasPotency(params, key) {
        // Some parameters depend on others being enabled

        if (key.startsWith("adaptive") && key !== "adaptiveNormalization") {
            return params["adaptiveNormalization"];
        } else if (key.startsWith("decay")) {
            return params["useDecayWeighting"];
        } else if (key.startsWith("robust")) {
            return params["useRobustNormalization"];
        } else if (key.startsWith("ui")) {
            return params["applyUISquash"];
        }

        return true;
    }

    randomParam(params) {
        const keys = Object.keys(defaultScoringParams);
        let key = null;
        let attempts = 0;

        // Keep picking a random key until we find one that has potency
        while (attempts < 100) {
            key = keys[Math.floor(Math.random() * keys.length)];
            if (this.hasPotency(params, key)) {
                return key;
            }
            attempts++;
        }

        // If we didn't find a valid key, throw an error
        throw new Error("Failed to find a valid parameter to mutate.");
    }

    mutateParams(params) {
        // Pick a random parameter to mutate
        const key = this.randomParam(params);
        const keyType = typeof defaultScoringParams[key];
        const value = params[key] || defaultScoringParams[key];
        let newValue = null;

        if (key === "adaptiveScalingFunction") {
            newValue = this.mutateChoice(value, ["sqrt", "log", "linear"]);
        } else if (keyType === "boolean") {
            newValue = this.mutateBoolean(value);
        } else if (keyType === "number") {
            newValue = this.mutateNumber(value, defaultScoringParams[key]);
        } else {
            throw new Error(
                `Unsupported parameter type for mutation: ${key} (${keyType})`
            );
        }

        params[key] = newValue;

        return key;
    }

    breedNewGeneration(newPoolSize = null, tournamentSize = 5) {
        newPoolSize =
            newPoolSize || this.newPoolSize || Math.floor(this.poolSize / 2);
        const newPool = [];
        const newGeneration = this.generation + 1;

        while (newPool.length < newPoolSize) {
            const mom = this.select(tournamentSize);
            const dad = this.select(tournamentSize);

            let child = this.breedProfiles(
                mom,
                dad,
                newGeneration,
                newPool.length
            );
            newPool.push(child);
        }

        this.generation = newGeneration;

        return newPool;
    }

    mergeGeneration(newPool) {
        for (let profile of newPool) {
            this.pool.push(profile);
        }

        this.pool.sort((a, b) => b.fitness - a.fitness);
        this.cull();
    }
}

export { Population };
