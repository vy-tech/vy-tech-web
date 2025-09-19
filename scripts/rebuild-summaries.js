import "./jsdom-shim.js";
import "./firebase-shim.js";

import { summarizer } from "../src/scoring/summarizer.js";

// Get the event ID from command line arguments
const eventId = process.argv[2];

if (!eventId) {
    console.error("Usage: node scripts/rebuild-summaries.js <event-id>");
    console.error(
        "Example: node scripts/rebuild-summaries.js raimondi-20250711-01"
    );
    process.exit(1);
}

console.log(`Rebuilding summaries for event: ${eventId}`);
await summarizer.rebuild(eventId);
console.log("Done.");
process.exit(0);
