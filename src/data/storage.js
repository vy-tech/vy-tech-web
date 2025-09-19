import { app } from "./firebase.js";

// Initialize Firebase storage functions based on environment
let storageFunctions;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
    console.log("Using Admin Storage SDK...");
    storageFunctions = global._vy_storage_functions;
} else {
    console.log("Importing Client Storage SDK...");
    storageFunctions = await import("firebase/storage");
}

const { getStorage, ref, uploadString, getDownloadURL } = storageFunctions;

class Storage {
    constructor() {
        this.storage = getStorage(app);
    }

    async getDownloadUrl(path) {
        const storageRef = ref(this.storage, path);
        console.log(`Getting download URL from storage: ${path}`);
        return await getDownloadURL(storageRef);
    }

    async uploadString(path, data) {
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
