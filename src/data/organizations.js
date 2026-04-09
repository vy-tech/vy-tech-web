import { database } from "./db.js";

import { apiUtil } from "../util/apiUtil.js";

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

export { OrganizationsData };
