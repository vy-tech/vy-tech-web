import van from "vanjs-core";
import { OrganizationsData } from "./organizations.js";

const STORAGE_KEY = "vy_current_org_id";

// node:async_hooks is loaded lazily inside ServerOrgContext so the module graph
// stays free of top-level await (Firebase Functions loads via require(), which
// rejects ESM graphs containing TLA).
let AsyncLocalStorage = null;

// ── BrowserOrgContext ───────────────────────────────────────────────────────
// Full-featured org context for browser environments. Uses VanJS reactive
// state and localStorage for persistence.

class BrowserOrgContext {
    constructor() {
        this.orgsData = new OrganizationsData();
        this.currentOrgId = van.state(null);
        this.currentOrg = van.state(null);
        this.userOrgs = van.state([]);
        this.isLoading = van.state(true);
        this.userId = null;
    }

    async init(user) {
        console.log("init org context with user:", user);

        this.userId = user.uid;

        this.isLoading.val = true;

        const personalOrg = await this.orgsData.ensurePersonalOrg(user);

        const orgs = await this.orgsData.getByUser(this.userId);
        this.userOrgs.val = this.sortOrgs(orgs || []);

        const storedOrgId = localStorage.getItem(STORAGE_KEY);
        const validOrg = this.userOrgs.val.find((o) => o.id === storedOrgId);

        if (validOrg) {
            await this.setCurrentOrg(storedOrgId, false);
        } else {
            await this.setCurrentOrg(personalOrg.id, false);
        }

        this.isLoading.val = false;
    }

    sortOrgs(orgs) {
        return orgs.slice().sort((a, b) => {
            if (a.isPersonal && !b.isPersonal) return -1;
            if (!a.isPersonal && b.isPersonal) return 1;
            return (a.name || "").localeCompare(b.name || "");
        });
    }

    getCurrentOrgId() {
        let orgId = this.currentOrgId.val;

        if (!orgId) {
            orgId = localStorage.getItem(STORAGE_KEY);
        }

        return orgId;
    }

    getCurrentOrg() {
        return this.currentOrg.val;
    }

    async setCurrentOrg(orgId, initialized = true) {
        const { eventBus } = await import("../eventbus.js");

        const org = this.userOrgs.val.find((o) => o.id === orgId);
        if (!org) {
            console.warn("Organization not found:", orgId);
            return false;
        }

        this.currentOrgId.val = orgId;
        this.currentOrg.val = org;
        localStorage.setItem(STORAGE_KEY, orgId);
        console.log("Set current organization to:", orgId);

        eventBus.fire("org.changed", {
            orgId,
            org,
            isPersonal: org.isPersonal || false,
            initialized,
        });

        return true;
    }

    async refreshOrgs() {
        if (!this.userId) return;

        const orgs = await this.orgsData.getByUser(this.userId);
        this.userOrgs.val = this.sortOrgs(orgs || []);

        const currentStillValid = this.userOrgs.val.find(
            (o) => o.id === this.currentOrgId.val
        );
        if (!currentStillValid) {
            const personal = this.userOrgs.val.find((o) => o.isPersonal);
            if (personal) {
                await this.setCurrentOrg(personal.id);
            }
        } else {
            this.currentOrg.val = currentStillValid;
        }
    }

    getPersonalOrg() {
        return this.userOrgs.val.find((o) => o.isPersonal);
    }

    isInOrg(orgId) {
        return this.userOrgs.val.some((o) => o.id === orgId);
    }
}

// ── ServerOrgContext ─────────────────────────────────────────────────────────
// Lightweight request-scoped org context for server (Cloud Functions)
// environments. Uses Node.js AsyncLocalStorage so each concurrent request
// gets its own isolated context.

class ServerOrgContext {
    constructor() {
        // _als is created lazily on first run() call to avoid needing
        // AsyncLocalStorage at module load time.
        this._als = null;
    }

    async _ensureAls() {
        if (!this._als) {
            if (!AsyncLocalStorage) {
                AsyncLocalStorage = (await import("node:async_hooks"))
                    .AsyncLocalStorage;
            }
            this._als = new AsyncLocalStorage();
        }
    }

    /** Executes `fn` with the given org context available to all downstream code. */
    async run(context, fn) {
        await this._ensureAls();
        return this._als.run(context, fn);
    }

    getCurrentOrgId() {
        return this._als?.getStore()?.orgId ?? null;
    }

    getCurrentOrg() {
        return this._als?.getStore()?.org ?? null;
    }

    get userId() {
        return this._als?.getStore()?.userId ?? null;
    }

    isInOrg(orgId) {
        return this.getCurrentOrgId() === orgId;
    }
}

// ── Proxy export ────────────────────────────────────────────────────────────

const orgContext =
    typeof window !== "undefined"
        ? new BrowserOrgContext()
        : new ServerOrgContext();

if (typeof window !== "undefined") {
    window._vy_orgContext = orgContext;
}

export { BrowserOrgContext, ServerOrgContext, orgContext };
