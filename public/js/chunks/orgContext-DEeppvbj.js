import { v as van } from './van-t8DywzvC.js';
import { e as eventBus } from './eventbus-B9JUr222.js';
import { d as database } from './db-BZQDImdW.js';

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

    // =========================================================================
    // CRUD Methods
    // =========================================================================

    async create(name, ownerUserId) {
        const org = {
            name,
            owners: [ownerUserId],
            members: [ownerUserId],
            invites: [],
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

    async ensurePersonalOrg(userId, displayName) {
        const id = `personal_${userId}`;
        const orgName = displayName ? `${displayName}'s Personal` : "Personal";
        let existing = null;
        try {
            existing = await database.get(COLLECTION, id);
        } catch (error) {
            console.error("Error checking for personal organization:", error);
        }

        if (existing) {
            return existing;
        }

        const org = {
            id: id,
            name: orgName,
            isPersonal: true,
            owners: [userId],
            members: [userId],
            invites: [],
        };
        await database.set(COLLECTION, org);
        return await this.getById(org.id);
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

class OrgContext {
    constructor() {
        this.orgsData = new OrganizationsData();

        this.currentOrgId = van.state(null);
        this.currentOrg = van.state(null);
        this.userOrgs = van.state([]);
        this.isLoading = van.state(true);

        this.userId = null;
    }

    async init(userId) {
        this.userId = userId;
        this.isLoading.val = true;

        const personalOrg = await this.orgsData.ensurePersonalOrg(userId);

        console.log("Getting organizations for user:", userId);
        const orgs = await this.orgsData.getByUser(userId);
        console.log("Fetched user orgs:", orgs);
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

    async setCurrentOrg(orgId, fireEvent = true) {
        const org = this.userOrgs.val.find((o) => o.id === orgId);
        if (!org) {
            console.warn("Organization not found:", orgId);
            return false;
        }

        this.currentOrgId.val = orgId;
        this.currentOrg.val = org;
        localStorage.setItem(STORAGE_KEY, orgId);

        if (fireEvent) {
            eventBus.fire("org.changed", {
                orgId,
                org,
                isPersonal: org.isPersonal || false,
            });
        }

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
}

const orgContext = new OrgContext();

if (typeof window !== "undefined") {
    window._vy_orgContext = orgContext;
}

export { OrganizationsData as O, orgContext as o };
//# sourceMappingURL=orgContext-DEeppvbj.js.map
