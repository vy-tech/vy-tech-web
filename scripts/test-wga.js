// Load shims
import "./jsdom-shim.js";
import "./firebase-shim.js";

import { profiles } from "../src/data/profiles.js";
import { Scenarios } from "../src/ga/scenarios.js";
import { Engine, WorkersEngine } from "../src/ga/engine.js";

const engine = new WorkersEngine("ga", 100, navigator.hardwareConcurrency);
await engine.initialize();

await engine.runGeneration(50);
engine.showTop(10);
await engine.finish();
