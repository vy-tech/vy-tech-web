import { database } from "./db.js";

/**
 * ApiKeysData manages API keys associated with an application.
 *
 * API keys are stored in the "api_keys" collection:
 * - id: Record identifier (auto-generated)
 * - oid: Organization ID
 * - application: FK to applications.id
 * - name: Human-readable key name
 * - key: The API key value (vyk_ + 32 random hex chars)
 * - expires: Expiration date (optional)
 * - used: Last used date (optional)
 * - created: Timestamp of creation (auto-generated)
 *
 * Keys are written by the /api/org/api_key/generate endpoint.
 */

const COLLECTION = "api_keys";

class ApiKeysData {
    constructor() {}

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByApplication(oid, application) {
        return await database.query(COLLECTION, {
            oid,
            application,
        });
    }

    async getByOrg(oid) {
        return await database.query(COLLECTION, {
            oid,
        });
    }

    async create(keyData) {
        return await database.set(COLLECTION, keyData);
    }

    async update(id, updates) {
        return await database.update(COLLECTION, id, updates);
    }

    async delete(id) {
        return await database.delete(COLLECTION, id);
    }

    async getByHash(keyHash) {
        const results = await database.query(COLLECTION, { keyHash });
        return results[0] || null;
    }
}

export { ApiKeysData };
