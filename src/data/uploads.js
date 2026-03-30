import { database } from "./db.js";

const COLLECTION = "uploads";

class UploadsData {
    async create(data) {
        return await database.set(COLLECTION, data);
    }

    async getByUploadId(uploadId) {
        const results = await database.query(COLLECTION, { uploadId });
        return results?.[0] ?? null;
    }

    async delete(id) {
        return await database.delete(COLLECTION, id);
    }
}

export { UploadsData };
