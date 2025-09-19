import "./jsdom-shim.js";
import "./firebase-shim.js";

import { database } from "../src/data/db.js";

const events = await database.query("events", { status: "available" }, "begin");

for (const event of events) {
    let parts = event.hierarchy.split(":");

    for (let camera = 1; camera <= 5; camera++) {
        console.log(
            `${parts[0]}:${parts[1]}:${camera.toString().padStart(2, "0")}`
        );
    }
}
process.exit(0);
