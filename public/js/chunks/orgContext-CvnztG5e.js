import { v as van } from './eventbus-c5hoJhOF.js';
import { d as database, a as apiUtil } from './apiUtil-CDq4WBQY.js';

/**
 * OrganizationsData class manages organization-related data operations.
 *
 * Organizations are represented in a single collection as follows:
 * - id: Record identifier (auto-generated)
 * - name: Name of the organization
 * - owners: Array of user IDs who are owners
 * - members: Array of user IDs who are members (including owners)
 * - invites: Array of outstanding invitation tokens
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION = "organizations";

class OrganizationsData {
    constructor() {}

    // =========================================================================
    // Query Methods
    // =========================================================================

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByUser(userId) {
        return await database.query(COLLECTION, {
            members: { op: "array-contains", value: userId },
        });
    }

    async getByOwner(userId) {
        return await database.query(COLLECTION, {
            owners: { op: "array-contains", value: userId },
        });
    }

    async getPersonalOrgByUser(userId) {
        const orgs = await database.query(COLLECTION, {
            uid: userId,
            isPersonal: true,
        });
        return orgs && orgs.length > 0 ? orgs[0] : null;
    }

    // =========================================================================
    // CRUD Methods
    // =========================================================================

    async create(name, ownerUserId, orgData) {
        const org = {
            name,
            owners: [ownerUserId],
            members: [ownerUserId],
            invites: [],
            ...orgData,
        };
        const id = await database.set(COLLECTION, org);
        return id;
    }

    async update(id, updates) {
        const allowedFields = ["name"];
        const filteredUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        if (Object.keys(filteredUpdates).length === 0) {
            return false;
        }
        return await database.update(COLLECTION, id, filteredUpdates);
    }

    async delete(id) {
        const org = await this.getById(id);
        if (org?.isPersonal) {
            throw new Error("Cannot delete personal organization");
        }
        return await database.delete(COLLECTION, id);
    }

    tokenize(name) {
        // Simple tokenization: lowercase, trim, replace non-words with underscores,
        // collapse underscores
        return name
            .toLowerCase()
            .trim()
            .replace(/\W+/g, "_")
            .replace(/_+/g, "_");
    }

    async ensureUniqueToken(name) {
        // Ensures that the token generated from the organization name is unique
        // by appending a random suffix if necessary.

        const baseToken = this.tokenize(name);
        let token = baseToken;
        while (true) {
            const existingOrgs = await database.query(COLLECTION, {
                token: token,
            });
            if (!existingOrgs || existingOrgs.length === 0) {
                break;
            }
            const suffix = Math.floor(Math.random() * 900 + 100); // random 3-digit number
            token = `${baseToken}_${suffix}`;
        }

        return token;
    }

    async ensurePersonalOrg(user) {
        const userId = user.uid;
        const poid = user.poid;
        let existing = null;

        try {
            if (poid) {
                existing = await database.get(COLLECTION, poid);
            } else {
                // Query by membership — this works with Firestore security rules
                // that gate reads on the members array
                const userOrgs = await this.getByUser(userId);
                const personalOrg = userOrgs?.find((o) => o.isPersonal);
                if (personalOrg) {
                    existing = personalOrg;
                }
            }
        } catch (error) {
            console.error("Error checking for personal organization:", error);
        }

        if (existing instanceof Array) {
            if (existing.length > 0) {
                // If we didn't have a poid re-sync
                apiUtil.call("/api/org/sync", {}, "POST"); // Fire and forget

                return existing[0];
            }
        } else if (existing) {
            if (!poid) {
                // If we didn't have a poid re-sync
                apiUtil.call("/api/org/sync", {}, "POST"); // Fire and forget
            }
            return existing;
        }

        const result = await apiUtil.call(
            "/api/org/create/personal",
            {},
            "POST"
        );

        return result.organization;
    }

    // =========================================================================
    // Membership Methods
    // =========================================================================

    async addMember(orgId, userId) {
        return await database.update(COLLECTION, orgId, {
            members: { op: "arrayUnion", value: userId },
        });
    }

    async removeMember(orgId, userId) {
        // Remove from both members and owners
        return await database.update(COLLECTION, orgId, {
            members: { op: "arrayRemove", value: userId },
            owners: { op: "arrayRemove", value: userId },
        });
    }

    async addOwner(orgId, userId) {
        // Add to both owners and members (in case not already a member)
        return await database.update(COLLECTION, orgId, {
            owners: { op: "arrayUnion", value: userId },
            members: { op: "arrayUnion", value: userId },
        });
    }

    async removeOwner(orgId, userId) {
        // Remove from owners only, keep as member
        return await database.update(COLLECTION, orgId, {
            owners: { op: "arrayRemove", value: userId },
        });
    }

    // =========================================================================
    // Invitation Methods
    // =========================================================================

    async createInvite(orgId) {
        const token = database.pushid();
        await database.update(COLLECTION, orgId, {
            invites: { op: "arrayUnion", value: token },
        });
        return token;
    }

    async getByInvite(token) {
        const orgs = await database.query(COLLECTION, {
            invites: { op: "array-contains", value: token },
        });

        if (!orgs || orgs.length === 0) {
            return null;
        }

        if (orgs.length > 1) {
            console.warn(
                "Multiple organizations found with the same invite token:",
                token
            );
        }

        return orgs[0];
    }

    async acceptInvite(token, userId, role = "member") {
        const org = await this.getByInvite(token);
        if (!org) {
            return null;
        }

        // Remove the invite token
        await database.update(COLLECTION, org.id, {
            invites: { op: "arrayRemove", value: token },
        });

        // Add user based on role
        if (role === "owner") {
            await this.addOwner(org.id, userId);
        } else {
            await this.addMember(org.id, userId);
        }

        return org.id;
    }

    async revokeInvite(orgId, token) {
        return await database.update(COLLECTION, orgId, {
            invites: { op: "arrayRemove", value: token },
        });
    }
}

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
        const { eventBus } = await import('./eventbus-c5hoJhOF.js').then(function (n) { return n.a; });

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
            initialized
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
                AsyncLocalStorage = (await import('node:async_hooks'))
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

export { OrganizationsData as O, orgContext as o };
//# sourceMappingURL=orgContext-CvnztG5e.js.map
