import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";

import { keyHashHmacSecret, seaweedAccessKey, seaweedSecretKey } from "./helpers.js";
import { requireApiKey } from "./middleware.js";
import videoRoutes from "./routes/video.js";
import fetchRoutes from "./routes/fetch.js";
import locationsRoutes from "./routes/locations.js";
import eventsRoutes from "./routes/events.js";

// ── Express app ─────────────────────────────────────────────────────────────

const v1App = express();

v1App.use(express.json());
v1App.use(requireApiKey);

const functionApp = express();
functionApp.use("/api/v1", v1App);

// Export for development server
export { v1App };

// ── Routes ─────────────────────────────────────────────────────────────────

v1App.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

v1App.use("/video", videoRoutes);
v1App.use("/videos", videoRoutes);
v1App.use("/fetch", fetchRoutes);
v1App.use("/locations", locationsRoutes);
v1App.use("/event", eventsRoutes);
v1App.use("/events", eventsRoutes);

// ── Cloud Function export ───────────────────────────────────────────────────

console.log("Setting up Cloud Function export...");
export const v1 = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        invoker: "public",
        secrets: [keyHashHmacSecret, seaweedAccessKey, seaweedSecretKey],
    },
    functionApp
);
