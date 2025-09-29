import "./jsdom-shim.js";
import "./firebase-shim.js";

import { execSync } from "child_process";
import { database } from "../src/data/db.js";

const events = await database.query("events", { status: "available" }, "begin");

for (const event of events) {
    let parts = event.hierarchy.split(":");

    for (let camera = 1; camera <= 5; camera++) {
        let rebuildHierarchy = `${parts[0]}-${parts[1]}-${camera
            .toString()
            .padStart(2, "0")}`;

        // Execute node script to rebuild summaries for this hierarchy
        console.log(`Rebuilding summaries for ${rebuildHierarchy}`);

        execSync(`node rebuild-summaries.js ${rebuildHierarchy}`, {
            stdio: "inherit",
        });
    }
}
process.exit(0);
