import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";

import { getAuth } from "firebase-admin/auth";

import { requireAuth, isAdmin, requireAdmin } from "../common.js";
import { OrganizationsData } from "../../data/organizations.js";
import { grantCredits } from "../../data/creditGrants.js";
import { JobsData } from "../../data/jobs.js";
import { database, serverTimestamp } from "../../data/db.js";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const stripePriceStarter1000 = defineSecret("STRIPE_PRICE_STARTER_1000");

// Server-side credit pack catalog. Credits and label live in code; the Stripe
// price id is a secret so pack pricing can be rotated without a code deploy.
const CREDIT_PACKS = {
    "starter-1000": {
        label: "1,000 credits",
        credits: 1000,
        priceUsd: 10,
        priceIdSecret: stripePriceStarter1000,
    },
};

let stripeClient = null;
const getStripe = () => {
    if (!stripeClient) {
        const key = process.env.STRIPE_SECRET_KEY || stripeSecretKey.value();
        stripeClient = new Stripe(key);
    }
    return stripeClient;
};

const getPriceId = (pack) =>
    process.env.STRIPE_PRICE_STARTER_1000 || pack.priceIdSecret.value();

const billingApp = express();

// Webhook — Firebase Functions Gen 2 parses the JSON body before Express
// middleware runs, so `req.body` is already a parsed object and is useless
// for Stripe signature verification. Gen 2 preserves the original bytes on
// `req.rawBody`; fall back to `express.raw()` output for local dev where
// server.js doesn't pre-parse.
billingApp.post(
    "/webhook/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
        const sig = req.headers["stripe-signature"];
        const secret =
            process.env.STRIPE_WEBHOOK_SECRET || stripeWebhookSecret.value();

        const rawBody = req.rawBody || req.body;

        let event;
        try {
            event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
        } catch (err) {
            console.error(
                "Stripe webhook signature verification failed:",
                err.message
            );
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type !== "checkout.session.completed") {
            return res.status(200).json({ received: true });
        }

        try {
            await handleCheckoutCompleted(event);
            return res.status(200).json({ received: true });
        } catch (err) {
            console.error("Failed to process checkout.session.completed:", err);
            return res.status(500).json({ error: err.message });
        }
    }
);

billingApp.use(express.json());
billingApp.use(requireAuth);

// List available credit packs (authenticated users can see; purchasing is
// separately gated to owners).
billingApp.get("/packs", (req, res) => {
    const packs = Object.entries(CREDIT_PACKS).map(([id, p]) => ({
        id,
        label: p.label,
        credits: p.credits,
        priceUsd: p.priceUsd,
    }));
    res.json({ packs });
});

billingApp.post("/checkout/create", async (req, res) => {
    try {
        const { oid, packId } = req.body || {};
        if (!oid || !packId) {
            return res.status(400).json({ error: "Missing oid or packId" });
        }

        const pack = CREDIT_PACKS[packId];
        if (!pack) {
            return res.status(400).json({ error: "Unknown pack" });
        }

        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(oid);
        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }
        if (!org.owners?.includes(req.uid)) {
            return res.status(403).json({
                error: "Only organization owners can purchase credits",
            });
        }

        const origin =
            req.headers.origin ||
            (req.headers.referer
                ? new URL(req.headers.referer).origin
                : null) ||
            "";

        // Stripe Tax: automatic_tax uses the tax_code set on the Stripe
        // Product (txcd_10105004 — "Artificial Intelligence as a Service").
        // Requires a billing address to determine jurisdiction;
        // tax_id_collection lets B2B customers enter a VAT/tax ID for
        // reverse-charge treatment where applicable.
        const session = await getStripe().checkout.sessions.create({
            mode: "payment",
            line_items: [{ price: getPriceId(pack), quantity: 1 }],
            success_url: `${origin}/billing?purchase=success`,
            cancel_url: `${origin}/billing?purchase=cancelled`,
            client_reference_id: oid,
            automatic_tax: { enabled: true },
            billing_address_collection: "required",
            tax_id_collection: { enabled: true },
            metadata: {
                oid,
                uid: req.uid,
                packId,
                credits: String(pack.credits),
            },
        });

        return res.status(200).json({ url: session.url });
    } catch (err) {
        console.error("Error creating checkout session:", err);
        return res.status(500).json({ error: err.message });
    }
});

billingApp.get("/balance", async (req, res) => {
    try {
        const oid = req.query.oid;
        if (!oid) return res.status(400).json({ error: "Missing oid" });

        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(oid);
        if (!org) return res.status(404).json({ error: "Organization not found" });

        const isOwner = org.owners?.includes(req.uid);
        const isMember = org.members?.includes(req.uid);
        if (!isOwner && !isMember) {
            return res.status(403).json({ error: "Not a member of this organization" });
        }

        const balance = await database.get("credit_balances", oid);
        const credits = balance?.credits || 0;

        return res.status(200).json({ credits });
    } catch (err) {
        console.error("Error fetching balance:", err);
        return res.status(500).json({ error: err.message });
    }
});

billingApp.get("/history", async (req, res) => {
    try {
        const oid = req.query.oid;
        if (!oid) return res.status(400).json({ error: "Missing oid" });

        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(oid);
        if (!org) return res.status(404).json({ error: "Organization not found" });
        if (!org.owners?.includes(req.uid)) {
            return res.status(403).json({
                error: "Only organization owners can view billing history",
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit || "50", 10) || 50, 1),
            200
        );

        const rows = await database.query(
            "credit_ledger",
            { oid },
            { key: "created", dir: "desc" },
            limit
        );

        const history = rows.map((data) => ({
            id: data.id,
            oid: data.oid,
            type: data.type,
            amount: data.amount,
            balanceAfter: data.balanceAfter,
            source: data.source,
            ref: data.ref,
            packId: data.packId || null,
            description: data.description || null,
            created: data.created?.toDate?.()?.toISOString() || null,
        }));

        return res.status(200).json({ history });
    } catch (err) {
        console.error("Error fetching history:", err);
        return res.status(500).json({ error: err.message });
    }
});

// ── Admin routes ────────────────────────────────────────────────────────────

billingApp.get("/admin/status", async (req, res) => {
    res.json({ isAdmin: await isAdmin(req.uid) });
});

billingApp.get("/admin/search", requireAdmin, async (req, res) => {
    try {
        const q = (req.query.q || "").trim();
        const results = { orgs: [], users: [] };
        if (!q) return res.json(results);

        const orgsData = new OrganizationsData();
        const lower = q.toLowerCase();

        // Exact id lookup first
        if (/^[A-Za-z0-9_-]{15,}$/.test(q)) {
            const exact = await orgsData.getById(q);
            if (exact) {
                results.orgs.push(await enrichOrg(exact));
            }
        }

        // Email → user → their orgs
        if (q.includes("@")) {
            try {
                const userRecord = await getAuth().getUserByEmail(q);
                const userOrgs = await orgsData.getByUser(userRecord.uid);
                results.users.push({
                    uid: userRecord.uid,
                    email: userRecord.email,
                    displayName: userRecord.displayName || null,
                    orgIds: (userOrgs || []).map((o) => o.id),
                });
                for (const o of userOrgs || []) {
                    if (!results.orgs.find((r) => r.id === o.id)) {
                        results.orgs.push(await enrichOrg(o));
                    }
                }
            } catch {
                // No user with that email — fall through to name search
            }
        }

        // Org name / token substring match. Firestore doesn't support case-
        // insensitive substring queries, so we fetch all orgs and filter in
        // memory. Fine at current scale; revisit if the org count grows large.
        const allOrgs = await database.query("organizations");
        const matches = allOrgs.filter((data) => {
            const name = (data.name || "").toLowerCase();
            const token = (data.token || "").toLowerCase();
            return (
                (name && name.includes(lower)) ||
                (token && token.includes(lower))
            );
        });
        matches.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        for (const m of matches.slice(0, 25)) {
            if (!results.orgs.find((r) => r.id === m.id)) {
                results.orgs.push(await enrichOrg(m));
            }
        }

        return res.json(results);
    } catch (err) {
        console.error("Admin search failed:", err);
        return res.status(500).json({ error: err.message });
    }
});

billingApp.post("/admin/grant", requireAdmin, async (req, res) => {
    try {
        const { oid, credits, note } = req.body || {};
        const amount = parseInt(credits, 10);
        if (!oid || !Number.isFinite(amount) || amount === 0) {
            return res
                .status(400)
                .json({ error: "oid and non-zero integer credits required" });
        }

        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(oid);
        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }

        const { balanceAfter } = await grantCredits({
            oid,
            amount,
            source: "admin",
            uid: req.uid,
            ref: req.uid,
            description: note?.trim() || "Admin credit grant",
        });

        return res.json({ ok: true, balanceAfter });
    } catch (err) {
        console.error("Admin grant failed:", err);
        return res.status(500).json({ error: err.message });
    }
});

async function enrichOrg(org) {
    const balance = await database.get("credit_balances", org.id);
    return {
        id: org.id,
        name: org.name || null,
        token: org.token || null,
        isPersonal: org.isPersonal || false,
        uid: org.uid || null,
        ownerCount: (org.owners || []).length,
        memberCount: (org.members || []).length,
        credits: balance?.credits || 0,
    };
}

async function handleCheckoutCompleted(event) {
    const session = event.data.object;
    const oid = session.metadata?.oid;
    const uid = session.metadata?.uid || null;
    const packId = session.metadata?.packId || null;
    const credits = parseInt(session.metadata?.credits || "0", 10);

    if (!oid || !credits) {
        console.warn(
            "Checkout session missing oid/credits metadata; skipping.",
            session.id
        );
        return;
    }

    const applied = await database.transaction(async (tx) => {
        const existingEvent = await tx.get("stripe_events", event.id);
        if (existingEvent) {
            console.log(
                `Stripe event ${event.id} already processed; skipping.`
            );
            return false;
        }

        const balance = await tx.get("credit_balances", oid);
        const current = balance?.credits || 0;
        const next = current + credits;

        tx.set("credit_balances", {
            id: oid,
            oid,
            credits: next,
            created: balance?.created || serverTimestamp(),
        });

        tx.set("credit_ledger", {
            oid,
            type: "purchase",
            amount: credits,
            balanceAfter: next,
            uid,
            source: "stripe",
            ref: session.id,
            packId,
            description: `Purchased ${credits.toLocaleString()} credits`,
        });

        tx.set("stripe_events", {
            id: event.id,
            eventType: event.type,
            oid,
            sessionId: session.id,
        });

        return true;
    });

    if (applied) {
        await new JobsData().resetRejectedByOrg(oid);
    }
}

// In production, Firebase Hosting forwards the full URL path to the function
// (e.g. `/api/billing/packs`), so mount billingApp at that prefix here. In
// dev, server.js mounts billingApp directly at `/api/billing`.
const functionApp = express();
functionApp.use("/api/billing", billingApp);

export { billingApp };

export const billing = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 30,
        invoker: "public",
        secrets: [stripeSecretKey, stripeWebhookSecret, stripePriceStarter1000],
    },
    functionApp
);
