import { database } from "./db.js";

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

export { OrganizationsData };
