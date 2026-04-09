import { createHmac } from "crypto";

import { ApiKeysData } from "../../data/apiKeys.js";
import { OrganizationsData } from "../../data/organizations.js";
import { orgContext } from "../../data/orgContext.js";
import { getSecrets } from "./helpers.js";

export async function requireApiKey(req, res, next) {
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

        // Set server-side org context for downstream data layer code
        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(apiKey.oid);

        orgContext.run(
            {
                orgId: apiKey.oid,
                org: org || { id: apiKey.oid },
                userId: apiKey.uid || "api:" + apiKey.id,
            },
            () => next()
        );
    } catch (error) {
        console.error("API key auth error:", error);
        return res
            .status(401)
            .json({ error: "Unauthorized", message: "Invalid API key" });
    }
}
