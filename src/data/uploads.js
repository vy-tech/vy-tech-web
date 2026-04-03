import { database } from "./db.js";

const COLLECTION = "uploads";

class UploadsData {
    async create(data) {
        return await database.set(COLLECTION, data);
    }

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async delete(id) {
        return await database.delete(COLLECTION, id);
    }
}

export { UploadsData };
