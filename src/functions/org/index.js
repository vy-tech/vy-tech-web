import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

import { randomBytes, createHmac } from "crypto";

import { requireAuth, requireAdmin, getAuth } from "../common.js";

import { OrganizationsData } from "../../data/organizations.js";
import { ApplicationsData } from "../../data/applications.js";
import { ApiKeysData } from "../../data/apiKeys.js";
import { FilesData } from "../../data/files.js";
import { EventsData } from "../../data/events.js";
import { grantCredits } from "../../data/creditGrants.js";
import { database } from "../../data/db.js";

// Each new personal org gets a one-shot free credits grant so the user can
// try processing without paying. Idempotent via the `onlyIfNew` guard in
// `grantCredits` — a second /create/personal call (existing org) is a no-op.
const WELCOME_CREDITS = 1000;

const keyHashHmacSecret = defineSecret("KEY_HASH_HMAC_SECRET");

function getSecrets() {
    return {
        keyHashHmacSecret:
            process.env.KEY_HASH_HMAC_SECRET || keyHashHmacSecret.value(),
    };
}

// Express app for development
const orgApp = express();

orgApp.use(express.json());
orgApp.use(requireAuth);

// Helper to sync a user's org memberships to their custom claims
async function syncUserOrgClaims(userId) {
    const orgsData = new OrganizationsData();
    const orgs = await orgsData.getByUser(userId);
    const orgIds = orgs.map((org) => org.id);
    const poid = orgs.find((org) => org.isPersonal)?.id || null;

    await getAuth().setCustomUserClaims(userId, { orgIds, poid });
    console.log(
        `Updated claims for user ${userId}: orgIds = [${orgIds.join(", ")}] poid = ${poid}`
    );
    return orgIds;
}

// Accept an invite token and join organization
orgApp.post("/accept/:token", async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Invite token is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const orgId = await orgsData.acceptInvite(token, req.uid);

        if (!orgId) {
            return res.status(404).json({
                error: "Not Found",
                message: "Invalid or expired invite token",
            });
        }

        // Sync user's org claims
        await syncUserOrgClaims(req.uid);

        const org = await orgsData.getById(orgId);

        return res.status(200).json({
            success: true,
            message: "Successfully joined organization",
            organization: {
                id: org.id,
                name: org.name,
            },
        });
    } catch (error) {
        console.error("Error accepting invite:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to accept invite",
        });
    }
});

// Create a new organization
orgApp.post("/create", async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Organization name is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const orgId = await orgsData.create(name.trim(), req.uid);

        // Sync user's org claims
        await syncUserOrgClaims(req.uid);

        const org = await orgsData.getById(orgId);

        return res.status(201).json({
            success: true,
            message: "Organization created",
            organization: {
                id: org.id,
                name: org.name,
            },
        });
    } catch (error) {
        console.error("Error creating organization:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to create organization",
        });
    }
});

// Delete an organization (owner only)
orgApp.delete("/:orgId", async (req, res) => {
    const { orgId } = req.params;

    if (!orgId) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Organization ID is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(orgId);

        if (!org) {
            return res.status(404).json({
                error: "Not Found",
                message: "Organization not found",
            });
        }

        // Check if user is an owner
        if (!org.owners.includes(req.uid)) {
            return res.status(403).json({
                error: "Forbidden",
                message: "Only owners can delete an organization",
            });
        }

        // Get all members before deletion to update their claims
        const memberIds = [...org.members];

        // Delete the organization
        await orgsData.delete(orgId);

        // Sync claims for all affected members
        for (const memberId of memberIds) {
            await syncUserOrgClaims(memberId);
        }

        return res.status(200).json({
            success: true,
            message: "Organization deleted",
        });
    } catch (error) {
        console.error("Error deleting organization:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to delete organization",
        });
    }
});

orgApp.post("/create/personal", async (req, res) => {
    try {
        const orgsData = new OrganizationsData();

        // Check for an existing personal org to prevent duplicates
        const existing = await orgsData.getPersonalOrgByUser(req.uid);
        if (existing) {
            await syncUserOrgClaims(req.uid);
            return res.status(200).json({
                success: true,
                message: "Personal organization already exists",
                organization: existing,
            });
        }

        const user = await getAuth().getUser(req.uid);
        const token = await orgsData.ensureUniqueToken(user.email);

        const org = {
            name: user.displayName || user.email,
            isPersonal: true,
            uid: req.uid,
            owners: [req.uid],
            members: [req.uid],
            invites: [],
            token: token,
        };
        org.id = await orgsData.create(org.name, req.uid, org);

        await syncUserOrgClaims(req.uid);

        try {
            await grantCredits({
                oid: org.id,
                amount: WELCOME_CREDITS,
                source: "system",
                uid: req.uid,
                ref: "welcome",
                description: `Welcome bonus (${WELCOME_CREDITS.toLocaleString()} free credits)`,
                onlyIfNew: true,
            });
        } catch (grantErr) {
            // Don't fail org creation if the grant fails; log and continue.
            console.error("Welcome grant failed:", grantErr);
        }

        return res.status(201).json({
            success: true,
            message: "Personal organization created",
            organization: org,
        });
    } catch (error) {
        console.error("Error creating personal organization:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to create personal organization",
        });
    }
});

orgApp.post("/sync", async (req, res) => {
    await syncUserOrgClaims(req.uid);
    return res.status(200).json({ ok: "ok" });
});

// Admin listing of all orgs with member, video, event, and credit stats.
// Restricted to Vy admins via requireAdmin.
orgApp.get("/admin/list", requireAdmin, async (req, res) => {
    try {
        const userCache = new Map();
        const filesData = new FilesData();
        const eventsData = new EventsData();

        const orgs = await database.query("organizations");
        orgs.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", undefined, {
                sensitivity: "base",
            })
        );

        const enriched = await Promise.all(
            orgs.map(async (org) => {
                const base = {
                    id: org.id,
                    name: org.name || null,
                    token: org.token || null,
                    isPersonal: !!org.isPersonal,
                    ownerCount: (org.owners || []).length,
                    memberCount: (org.members || []).length,
                };
                try {
                    const [members, videos, events, credits] =
                        await Promise.all([
                            getAllMembers(org, userCache),
                            getOrgVideoStats(filesData, org.id),
                            getOrgEventStats(eventsData, org.id),
                            getOrgCredits(org.id),
                        ]);
                    return {
                        ...base,
                        members,
                        credits,
                        videos,
                        events,
                    };
                } catch (err) {
                    console.error(`Failed to enrich org ${org.id}:`, err);
                    return { ...base, error: err.message || String(err) };
                }
            })
        );

        return res.json({ orgs: enriched });
    } catch (err) {
        console.error("Admin list failed:", err);
        return res.status(500).json({ error: err.message });
    }
});

async function getAllMembers(org, userCache) {
    const owners = new Set(org.owners || []);
    const memberIds = org.members || [];
    return await Promise.all(
        memberIds.map(async (uid) => {
            const isOwner = owners.has(uid);
            if (!userCache.has(uid)) {
                try {
                    const u = await getAuth().getUser(uid);
                    userCache.set(uid, {
                        uid: u.uid,
                        email: u.email || null,
                        displayName: u.displayName || null,
                    });
                } catch (err) {
                    if (err?.code !== "auth/user-not-found") {
                        console.warn(
                            `getUser(${uid}) failed:`,
                            err?.message || err
                        );
                    }
                    userCache.set(uid, {
                        uid,
                        email: null,
                        displayName: null,
                    });
                }
            }
            return { ...userCache.get(uid), isOwner };
        })
    );
}

async function getOrgVideoStats(filesData, orgId) {
    const files = await filesData.getByOrgAndContext(orgId, "video");
    const byStatus = {};
    for (const f of files || []) {
        const status = f.status || "uploaded";
        byStatus[status] = (byStatus[status] || 0) + 1;
    }
    return { total: (files || []).length, byStatus };
}

function toDateMaybe(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

async function getOrgEventStats(eventsData, orgId) {
    const events = await eventsData.getByOrg(orgId);
    const now = Date.now();
    const byStatus = {};
    for (const e of events || []) {
        let status = e.status;
        if (!status) {
            const end = toDateMaybe(e.end);
            // First processed event in Vy history
            const cutoff = toDateMaybe("2025-07-11");

            if (end) {
                if (end.getTime() < cutoff.getTime()) {
                    status = "missed";
                } else if (end.getTime() < now) {
                    status = "captured";
                } else {
                    status = "scheduled";
                }
            }
        }
        byStatus[status] = (byStatus[status] || 0) + 1;
    }
    return { total: (events || []).length, byStatus };
}

async function getOrgCredits(orgId) {
    const balance = await database.get("credit_balances", orgId);
    return balance?.credits || 0;
}

orgApp.post("/key/generate", async (req, res) => {
    const { application, name } = req.body;

    if (!application || !name?.trim()) {
        return res.status(400).json({
            error: "Bad Request",
            message: "application and name are required",
        });
    }

    try {
        // Look up the application to get its org
        const appsData = new ApplicationsData();
        const app = await appsData.getById(application);

        if (!app) {
            return res.status(404).json({
                error: "Not Found",
                message: "Application not found",
            });
        }

        // Validate the user belongs to the org that owns the application
        const userOrgIds = req.user.orgIds || [];
        if (!userOrgIds.includes(app.oid)) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have access to this application",
            });
        }

        // Generate the API key using a cryptographically secure method
        const rawKey = randomBytes(24).toString("hex");
        const fullKey = `vyk_${rawKey}`;
        const keyPrefix = `vyk_${rawKey.substring(0, 8)}`;

        // Hash the API key using HMAC-SHA256
        const secrets = getSecrets();
        const keyHash = createHmac("sha256", secrets.keyHashHmacSecret)
            .update(fullKey)
            .digest("hex");

        // Store the hashed key, prefix, and metadata — never the full key
        const apiKeysData = new ApiKeysData();
        const keyData = {
            oid: app.oid,
            uid: req.uid,
            application,
            name: name.trim(),
            keyHash,
            keyPrefix,
        };
        const id = await apiKeysData.create(keyData);

        // Return the full key once — it will never be retrievable again
        return res.status(201).json({
            success: true,
            id,
            name: name.trim(),
            keyPrefix,
            key: fullKey,
        });
    } catch (error) {
        console.error("Error generating API key:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to generate API key",
        });
    }
});

const functionApp = express();
functionApp.use("/api/org", orgApp);

// Export for development server
export { orgApp };

console.log("Setting up Cloud Function export...");
// Export Cloud Function for production
export const org = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        invoker: "public",
        secrets: [keyHashHmacSecret],
    },
    functionApp
);
