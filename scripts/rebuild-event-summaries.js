import "./jsdom-shim.js";
import "./firebase-shim.js";

import { eventsData } from "../src/data/events.js";
import { summarizer } from "../src/scoring/summarizer.js";

const OID = "00hBBrBghhaYMr5WIHZN";
const availableEvents = await eventsData.getAvailable(OID);

for (const event of availableEvents) {
    await summarizer.ensure(event.hierarchy);
    await summarizer.rebuildEventSummary(event.hierarchy);
}

process.exit(0);
