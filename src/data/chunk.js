import { database } from "./db.js";

class Chunk {
    getPublicUrl(path) {
        if (this.storage == "firebase") {
            return `https://firebasestorage.googleapis.com/v0/b/roarscore-1ddf5.firebasestorage.app/o/${path}?alt=media`;
        } else if (this.storage == "minio") {
            return `https://storage.roarscore.ai/production/${path}`;
        }
        else if (this.storage == "seaweed") {
            return `https://s.vy.vision/${path}`;
        }

        return null;
    }

    getDemographicsUrl() {
        if (!this.demographicsPath) return null;

        return this.getPublicUrl(this.demographicsPath);
    }
}

class ChunksData {
    constructor() {
        this.current = null;
    }

    get() {
        return this.current;
    }

    async getById(id) {
        if (this.current && this.current.id === id) {
            return this.current;
        }
        let chunk = await database.get("chunks", id);
        if (chunk) {
            this.current = Object.setPrototypeOf(chunk, Chunk.prototype);
            return this.current;
        }
        return null;
    }
}

const chunksData = new ChunksData();

export { chunksData, ChunksData };
