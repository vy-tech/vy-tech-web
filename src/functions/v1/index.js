import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

import { createHmac } from "crypto";

import { ApiKeysData } from "../../data/apiKeys.js";

const keyHashHmacSecret = defineSecret("KEY_HASH_HMAC_SECRET");

function getSecrets() {
    return {
        keyHashHmacSecret:
            process.env.KEY_HASH_HMAC_SECRET || keyHashHmacSecret.value(),
    };
}

async function requireApiKey(req, res, next) {
    // Accept X-API-Key header or Authorization: Bearer vyk_...
    let key = req.headers["x-api-key"];
    if (!key) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer vyk_")) {
            key = authHeader.slice(7);
        }
    }

    if (!key?.startsWith("vyk_")) {
        return res
            .status(401)
            .json({ error: "Unauthorized", message: "Invalid API key" });
    }

    try {
        const { keyHashHmacSecret } = getSecrets();
        const keyHash = createHmac("sha256", keyHashHmacSecret)
            .update(key)
            .digest("hex");

        const apiKeysData = new ApiKeysData();
        const apiKey = await apiKeysData.getByHash(keyHash);

        if (!apiKey) {
            return res
                .status(401)
                .json({ error: "Unauthorized", message: "Invalid API key" });
        }

        if (apiKey.expires && Date.now() > apiKey.expires) {
            return res
                .status(401)
                .json({ error: "Unauthorized", message: "Invalid API key" });
        }

        req.apiKey = {
            id: apiKey.id,
            oid: apiKey.oid,
            application: apiKey.application,
            name: apiKey.name,
        };

        // Fire-and-forget last-used timestamp
        apiKeysData.update(apiKey.id, { used: Date.now() }).catch(() => {});

        next();
    } catch (error) {
        console.error("API key auth error:", error);
        return res
            .status(401)
            .json({ error: "Unauthorized", message: "Invalid API key" });
    }
}

// Express app for development
const v1App = express();

v1App.use(express.json());
v1App.use(requireApiKey);

const functionApp = express();
functionApp.use("/api/v1", v1App);

// Export for development server
export { v1App };

v1App.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

console.log("Setting up Cloud Function export...");
// Export Cloud Function for production
export const v1 = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        invoker: "public",
        secrets: [keyHashHmacSecret],
    },
    functionApp
);
