// Load shims
import "./jsdom-shim.js";
import "./firebase-shim.js";

import { WorkersEngine } from "../src/ga/engine.js";
import { parseArgs } from "node:util";
import { threadCpuUsage } from "node:process";

// Configuration
let tag = "ga";
let poolSize = 100;
let newPoolSize = null; // Use default (50% of poolSize)
let collectionName = "ga_population";
let workerBatchSize = null; // Use default based on hardware concurrency
let generations = 10;
let clearExisting = false;

function setupExitHandlers(engine) {
    // Handle Ctrl+C gracefully
    process.on("SIGINT", async () => {
        console.log("\nReceived SIGINT. Gracefully shutting down...");
        engine.stop();

        // Wait a moment for current generation to complete
        setInterval(async () => {
            if (engine.running) {
                console.log("Waiting for current generation to finish...");
            } else {
                console.log("Performing final cleanup...");
                await engine.finish();
                console.log("Shutdown complete.");
                process.exit(0);
            }
        }, 1000);
    });
}

function help() {
    console.log(`
Usage: node run-ga.js [options]

Options:
  -t, --tag <string>              GA tag identifier (default: "ga")
  -g, --generations <number>      Number of generations to run (default: 10)
  -p, --pool-size <number>        Population pool size (default: 100)
  -n, --new-pool-size <number>    New pool size (default: 50% of pool-size)
  -c, --collection-name <string>  Firestore collection name (default: "ga_population")
  -w, --worker-batch-size <number> Worker batch size (default: based on hardware)
  -x, --clear                     Clear existing population data before starting
  -h, --help                      Show this help message

Examples:
  node run-ga.js
  node run-ga.js --pool-size 200 --tag myga
  node run-ga.js -p 150 -n 75 -c my_population
`);
    process.exit(0);
}

function parseCommandLine() {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            tag: {
                type: "string",
                short: "t",
                default: "ga",
            },
            generations: {
                type: "string",
                short: "g",
                default: "10",
            },
            "pool-size": {
                type: "string",
                short: "p",
                default: "100",
            },
            "new-pool-size": {
                type: "string",
                short: "n",
            },
            "collection-name": {
                type: "string",
                short: "c",
                default: "ga_population",
            },
            "worker-batch-size": {
                type: "string",
                short: "w",
            },
            clear: {
                type: "boolean",
                default: false,
                short: "x",
            },
            help: {
                type: "boolean",
                short: "h",
            },
        },
        allowPositionals: false,
    });

    // Show help if requested
    if (values.help) {
        help();
    }

    // Parse and validate arguments
    const parsedTag = values.tag;
    const parsedPoolSize = parseInt(values["pool-size"]);
    const parsedNewPoolSize = values["new-pool-size"]
        ? parseInt(values["new-pool-size"])
        : null;
    const parsedCollectionName = values["collection-name"];
    const parsedWorkerBatchSize = values["worker-batch-size"]
        ? parseInt(values["worker-batch-size"])
        : null;
    const parsedGenerations = parseInt(values.generations);
    const parsedClearExisting = values.clear;

    // Validate numeric inputs
    if (isNaN(parsedPoolSize) || parsedPoolSize <= 0) {
        console.error("Error: pool-size must be a positive number");
        process.exit(1);
    }

    if (isNaN(parsedGenerations) || parsedGenerations <= 0) {
        console.error("Error: generations must be a positive number");
        process.exit(1);
    }

    if (
        values["new-pool-size"] &&
        (isNaN(parsedNewPoolSize) || parsedNewPoolSize <= 0)
    ) {
        console.error("Error: new-pool-size must be a positive number");
        process.exit(1);
    }

    if (
        values["worker-batch-size"] &&
        (isNaN(parsedWorkerBatchSize) || parsedWorkerBatchSize <= 0)
    ) {
        console.error("Error: worker-batch-size must be a positive number");
        process.exit(1);
    }

    // Update global configuration variables
    tag = parsedTag;
    poolSize = parsedPoolSize;
    newPoolSize = parsedNewPoolSize;
    collectionName = parsedCollectionName;
    workerBatchSize = parsedWorkerBatchSize;
    generations = parsedGenerations;
    clearExisting = parsedClearExisting;

    // Log configuration
    console.log(`Starting GA with configuration:
  Tag: ${tag}
  Generations: ${generations}
  Pool Size: ${poolSize}
  New Pool Size: ${
      newPoolSize || `${Math.floor(poolSize * 0.5)} (50% of pool-size)`
  }
  Collection: ${collectionName}
  Worker Batch Size: ${workerBatchSize || "auto (based on hardware)"}
  Clear Existing: ${clearExisting}
`);
}

async function main() {
    parseCommandLine();

    // Sleep for a moment to allow to control-c before starting
    console.log("Starting... Press Ctrl+C to cancel.");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Create and run the GA engine
    const engine = new WorkersEngine(
        tag,
        collectionName,
        poolSize,
        newPoolSize,
        workerBatchSize
    );

    if (clearExisting) {
        console.log("Clearing existing population data...");
        await engine.clear();
    }

    setupExitHandlers(engine);
    await engine.initialize();
    await engine.evolve(generations);
    await engine.finish();
}

await main();
