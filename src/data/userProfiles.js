import { database } from "./db.js";

/**
 * UserProfilesData class manages user profile-related data operations.
 *
 * User profiles are represented in a single collection as follows:
 * - id: Record identifier, matches user id
 * - email: User's email address
 * - displayName: User's display name
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION = "userProfiles";

class UserProfilesData {
    constructor() {}

    // =========================================================================
    // Query Methods
    // =========================================================================

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByIds(ids) {
        return await database.query(COLLECTION, {
            id: { op: "in", value: ids },
        });
    }

    async ensureProfile(id, email, displayName) {
        let profile = await this.getById(id);

        if (!profile) {
            displayName = displayName || email;
            const newProfile = {
                id,
                email,
                displayName,
            };
            await database.set(COLLECTION, newProfile);
            profile = await this.getById(id);
        }

        return profile;
    }

    // =========================================================================
    // CRUD Methods
    // =========================================================================

    async update(id, updates) {
        const allowedFields = ["displayName"];
        const filteredUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        if (Object.keys(filteredUpdates).length > 0) {
            await database.update(COLLECTION, id, filteredUpdates);
        }
    }
}

export { UserProfilesData };
