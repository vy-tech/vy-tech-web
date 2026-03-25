import { database } from "./db.js";

/**
 * ApplicationsData manages application records for an organization.
 *
 * Applications are stored in the "applications" collection:
 * - id: Record identifier (auto-generated)
 * - oid: Organization ID
 * - name: Application name
 * - description: Application description
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION = "applications";

class ApplicationsData {
    constructor() {}

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByOrg(oid) {
        return await database.query(COLLECTION, { oid: { op: "==", value: oid } });
    }

    async create(oid, data) {
        const application = { oid, ...data };
        return await database.set(COLLECTION, application);
    }

    async update(id, updates) {
        return await database.update(COLLECTION, id, updates);
    }

    async delete(id) {
        return await database.delete(COLLECTION, id);
    }
}

export { ApplicationsData };
