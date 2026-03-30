import { database } from "./db.js";

/**
 * CamerasData manages camera records associated with a location.
 *
 * Cameras are stored in the "cameras" collection:
 * - id: Record identifier (auto-generated)
 * - oid: Organization ID
 * - location: FK to locations.id
 * - name: Camera name
 * - number: Camera number/identifier
 * - type: Stream type (rtspPull | rtspPush | httpPull | httpPush)
 * - endpointUrl: Stream endpoint URL
 * - monitorEnabled: Boolean
 * - monitorUrl: Monitoring endpoint URL
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION = "cameras";

class CamerasData {
    constructor() {}

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByLocation(oid, location) {
        return await database.query(COLLECTION, {
            oid,
            location,
        });
    }

    async getByOrg(oid) {
        return await database.query(COLLECTION, {
            oid: { op: "==", value: oid },
        });
    }

    async create(oid, locationId, data) {
        const camera = { oid, location: locationId, ...data };
        return await database.set(COLLECTION, camera);
    }

    async update(id, updates) {
        return await database.update(COLLECTION, id, updates);
    }

    async delete(id) {
        return await database.delete(COLLECTION, id);
    }
}

export { CamerasData };
