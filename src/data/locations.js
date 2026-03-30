import { database } from "./db.js";

/**
 * LocationsData manages physical location records for an organization.
 *
 * Locations are stored in the "locations" collection:
 * - id: Record identifier (auto-generated)
 * - oid: Organization ID
 * - name: Location name
 * - address: Street address
 * - city: City
 * - state: State/province
 * - zip: Postal code
 * - country: Country
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION = "locations";

class LocationsData {
    constructor() {}

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByOrg(oid) {
        return await database.query(COLLECTION, { oid: { op: "==", value: oid } });
    }

    async create(oid, data) {
        const location = { oid, ...data };
        return await database.set(COLLECTION, location);
    }

    async update(id, updates) {
        return await database.update(COLLECTION, id, updates);
    }

    async delete(id) {
        return await database.delete(COLLECTION, id);
    }
}

export { LocationsData };
