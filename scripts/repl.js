// Load shims
import "./jsdom-shim.js";
import "./firebase-shim.js";

// Enter REPL
import repl from "repl";
import path from "path";
import { fileURLToPath } from "url";

// Set up REPL with persistent history
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const historyFile = path.join(__dirname, "..", ".vy_repl_history");

console.log("Starting Vy REPL.  Use dynamic import() to load modules.");
console.log('eg: const { database } = await import("../src/data/db.js");');

const replServer = repl.start({
    prompt: "vy> ",
    historySize: 1000, // Keep last 1000 commands
});

// Load history from disk
replServer.setupHistory(historyFile, (err) => {
    if (err) {
        console.warn("Could not load REPL history:", err.message);
    }
});
