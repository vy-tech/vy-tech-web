import "./jsdom-shim.js";
import "./firebase-shim.js";

import { events } from "../src/data/events.js";
import { summarizer } from "../src/scoring/summarizer.js";

const availableEvents = await events.getAvailable();

for (const event of availableEvents) {
    await summarizer.ensure(event.hierarchy);
    await summarizer.rebuildEventSummary(event.hierarchy);
}
process.exit(0);
