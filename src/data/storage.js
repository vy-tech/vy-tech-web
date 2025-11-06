import { getApp } from "./firebase.js";

let getStorage, ref, uploadString, getDownloadURL;

async function initializeStorage() {
    // Initialize Firebase storage functions based on environment
    let storageFunctions;

    if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
        console.log("Using Admin Storage SDK...");
        storageFunctions = global._vy_storage_functions;
    } else {
        console.log("Importing Client Storage SDK...");
        storageFunctions = await import("firebase/storage");
    }

    getStorage = storageFunctions.getStorage;
    ref = storageFunctions.ref;
    uploadString = storageFunctions.uploadString;
    getDownloadURL = storageFunctions.getDownloadURL;
}

async function ensureInitialized() {
    if (!getStorage) {
        await initializeStorage();
    }
}

class Storage {
    constructor() {
        this.storage = null;
    }

    async ensureStorage() {
        if (!this.storage) {
            const app = await getApp();
            await ensureInitialized();
            this.storage = getStorage(app);
        }

        return this.storage;
    }

    async getDownloadUrl(path) {
        await this.ensureStorage();

        const storageRef = ref(this.storage, path);
        console.log(`Getting download URL from storage: ${path}`);
        return await getDownloadURL(storageRef);
    }

    async uploadString(path, data) {
        await this.ensureStorage();

        const storageRef = ref(this.storage, path);
        console.log(`Saving to storage: ${path}`);
        await uploadString(storageRef, data);
    }
}

let storage = new Storage();

function changeStorage(newStorage) {
    storage = newStorage;
}

if (typeof window !== "undefined") {
    window._vy_storage = storage;
}

export default storage;
export { storage, Storage, changeStorage };
