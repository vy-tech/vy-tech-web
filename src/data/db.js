import { getApp } from "./firebase.js";

let getFirestore,
    doc,
    collection,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    where,
    limit,
    onSnapshot,
    serverTimestamp,
    runTransaction,
    arrayUnion,
    arrayRemove;

async function initializeFirestore() {
    // Initialize Firebase functions based on environment
    let firebaseFunctions;

    if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
        console.log("Importing Admin Firestore SDK...");
        firebaseFunctions = global._vy_firebase_functions;
    } else {
        console.log("Importing Client Firestore SDK...");
        const firebaseModules = await import("firebase/firestore");
        firebaseFunctions = firebaseModules;
    }

    getFirestore = firebaseFunctions.getFirestore;
    doc = firebaseFunctions.doc;
    collection = firebaseFunctions.collection;
    setDoc = firebaseFunctions.setDoc;
    getDoc = firebaseFunctions.getDoc;
    getDocs = firebaseFunctions.getDocs;
    deleteDoc = firebaseFunctions.deleteDoc;
    updateDoc = firebaseFunctions.updateDoc;
    query = firebaseFunctions.query;
    orderBy = firebaseFunctions.orderBy;
    where = firebaseFunctions.where;
    limit = firebaseFunctions.limit;
    onSnapshot = firebaseFunctions.onSnapshot;
    serverTimestamp = firebaseFunctions.serverTimestamp;
    runTransaction = firebaseFunctions.runTransaction;
    arrayUnion = firebaseFunctions.arrayUnion;
    arrayRemove = firebaseFunctions.arrayRemove;
}

async function ensureInitialized() {
    if (!getFirestore) {
        await initializeFirestore();
    }
}

class Database {
    constructor() {
        this.db = null;
    }

    async ensureFirestore() {
        if (!this.db) {
            const app = await getApp();
            await ensureInitialized();
            this.db = getFirestore(app);
        }

        return this.db;
    }

    pushid(now = null) {
        const pushChars =
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

        // Date of original proof of concept video capture
        const epoch = new Date(2024, 8, 14, 3, 27, 0).getTime(); // Month is 0-indexed in JS
        now = now || Date.now(); // Current time in ms

        // Encode timestamp into 8 characters
        const timeStampChars = new Array(8);
        let timestamp = now - epoch;
        for (let i = 7; i >= 0; i--) {
            timeStampChars[i] = pushChars[timestamp % pushChars.length];
            timestamp = Math.floor(timestamp / pushChars.length);
        }
        if (timestamp !== 0) {
            throw new Error("Timestamp didn't fully convert");
        }

        const lastRandChars = Array.from({ length: 12 }, () =>
            Math.floor(Math.random() * pushChars.length)
        );
        const randChars = lastRandChars.map((i) => pushChars[i]);

        return timeStampChars.concat(randChars).join("");
    }

    async set(collectionName, docData, isNew=false) {
        console.log("Setting", collectionName, docData);
        await this.ensureFirestore();

        if (!docData.id || isNew) {
            docData.created = serverTimestamp();
        }
        
        if (!docData.id) {
            docData.id = this.pushid();
        }

        docData.updated = serverTimestamp();
        const docRef = doc(this.db, collectionName, docData.id);
        await setDoc(docRef, docData);

        return docData.id;
    }

    async get(collectionName, docId) {
        console.log("Getting", collectionName, docId);
        await this.ensureFirestore();

        const docRef = doc(this.db, collectionName, docId);
        const docSnap = await getDoc(docRef);

        if (
            !docSnap ||
            (typeof docSnap.exists === "boolean" && !docSnap.exists) ||
            (typeof docSnap.exists === "function" && !docSnap.exists())
        ) {
            return null;
        }

        const data = docSnap.data();
        data.id = docSnap.id;
        return data;
    }

    async query(collectionName, filters = null, order = null, limitN = null) {
        console.log("Querying", collectionName, filters, order, limitN);
        await this.ensureFirestore();

        let q = collection(this.db, collectionName);

        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (
                    typeof value === "object" &&
                    value !== null &&
                    !Array.isArray(value)
                ) {
                    const op = value.op || "==";
                    const val = value.value;
                    q = query(q, where(key, op, val));
                } else if (Array.isArray(value)) {
                    q = query(q, where(key, "in", value));
                } else {
                    q = query(q, where(key, "==", value));
                }
            }

            if (order) {
                if (typeof order === "object") {
                    q = query(q, orderBy(order.key, order.dir));
                } else {
                    q = query(q, orderBy(order));
                }
            }
        }

        if (limitN) {
            q = query(q, limit(limitN));
        }

        const querySnapshot = await getDocs(q);
        const results = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id;
            results.push(data);
        });

        return results;
    }

    async delete(collectionName, docId) {
        console.log("Deleting", collectionName, docId);
        await this.ensureFirestore();

        const docRef = doc(this.db, collectionName, docId);
        await deleteDoc(docRef);
        return true;
    }

    async deleteAll(collectionName, filters = null) {
        console.log("Deleting all from", collectionName, filters);
        await this.ensureFirestore();

        let rows = await this.query(collectionName, filters);
        if (!rows || rows.length === 0) return true;

        for (let row of rows) {
            await this.delete(collectionName, row.id);
        }
        return true;
    }

    async update(collectionName, docId, updates) {
        console.log("Updating", collectionName, docId, updates);
        await this.ensureFirestore();

        const docRef = doc(this.db, collectionName, docId);

        // Process special array operations
        const processedUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                if (value.op === "arrayUnion") {
                    processedUpdates[key] = arrayUnion(value.value);
                } else if (value.op === "arrayRemove") {
                    processedUpdates[key] = arrayRemove(value.value);
                } else {
                    processedUpdates[key] = value;
                }
            } else {
                processedUpdates[key] = value;
            }
        }

        processedUpdates.updated = serverTimestamp();
        await updateDoc(docRef, processedUpdates);
        return true;
    }

    async atomicUpdate(
        collectionName,
        docId,
        column,
        oldValue,
        newValue,
        updates = {}
    ) {
        console.log(
            "Atomic updating",
            collectionName,
            docId,
            column,
            oldValue,
            newValue,
            updates
        );
        await this.ensureFirestore();

        const docRef = doc(this.db, collectionName, docId);

        try {
            const result = await runTransaction(
                this.db,
                async (transaction) => {
                    const docSnap = await transaction.get(docRef);

                    if (
                        docSnap.exists() &&
                        docSnap.data()[column] === oldValue
                    ) {
                        const updateData = {
                            [column]: newValue,
                            updated: serverTimestamp(),
                            ...updates,
                        };
                        transaction.update(docRef, updateData);
                        return true;
                    }

                    return false;
                }
            );

            return result;
        } catch (error) {
            console.error("Transaction failed: ", error);
            return false;
        }
    }

    /**
     * Run a Firestore transaction. The callback receives a tx-scoped proxy
     * exposing `get`, `set`, `update`, `delete` against collection + docId,
     * mirroring the non-transactional API. All reads must occur before any
     * writes within the callback (Firestore requirement).
     *
     * The `set` call mirrors `Database.set`: if `docData.id` is missing it
     * is auto-assigned via `pushid()`; `created` is stamped on new docs; and
     * `updated` is stamped on every write.
     *
     * @param {(tx: { get, set, update, delete }) => Promise<T>} callback
     * @returns {Promise<T>}
     */
    async transaction(callback) {
        await this.ensureFirestore();

        return await runTransaction(this.db, async (tx) => {
            const proxy = {
                get: async (collectionName, docId) => {
                    const docRef = doc(this.db, collectionName, docId);
                    const docSnap = await tx.get(docRef);
                    if (
                        !docSnap ||
                        (typeof docSnap.exists === "boolean" &&
                            !docSnap.exists) ||
                        (typeof docSnap.exists === "function" &&
                            !docSnap.exists())
                    ) {
                        return null;
                    }
                    const data = docSnap.data();
                    data.id = docSnap.id;
                    return data;
                },
                set: (collectionName, docData, isNew = false) => {
                    if (!docData.id || isNew) {
                        docData.created = docData.created || serverTimestamp();
                    }
                    if (!docData.id) {
                        docData.id = this.pushid();
                    }
                    docData.updated = serverTimestamp();
                    const docRef = doc(this.db, collectionName, docData.id);
                    tx.set(docRef, docData);
                    return docData.id;
                },
                update: (collectionName, docId, updates) => {
                    const docRef = doc(this.db, collectionName, docId);
                    const processedUpdates = { ...updates };
                    processedUpdates.updated = serverTimestamp();
                    tx.update(docRef, processedUpdates);
                },
                delete: (collectionName, docId) => {
                    const docRef = doc(this.db, collectionName, docId);
                    tx.delete(docRef);
                },
            };

            return await callback(proxy);
        });
    }

    async listen(collectionName, callback, filters = null) {
        console.log("Setting up listener for", collectionName, filters);
        await this.ensureFirestore();

        let q = collection(this.db, collectionName);

        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (
                    typeof value === "object" &&
                    value !== null &&
                    !Array.isArray(value)
                ) {
                    const op = value.op || "==";
                    const val = value.value;
                    q = query(q, where(key, op, val));
                } else if (Array.isArray(value)) {
                    q = query(q, where(key, "in", value));
                } else {
                    q = query(q, where(key, "==", value));
                }
            }
        }

        return onSnapshot(q, (querySnapshot) => {
            console.log("Listener triggered for", collectionName);
            const results = [];

            querySnapshot.docChanges().forEach((change) => {
                if (change.type === "added" || change.type === "modified") {
                    const data = change.doc.data();
                    data.id = change.doc.id;
                    results.push(data);
                }
            });

            if (results.length > 0) {
                callback(results);
            }
        });
    }

    async watch(collectionName, docId, callback) {
        await this.ensureFirestore();
        const docRef = doc(this.db, collectionName, docId);

        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                data.id = docSnap.id;
                callback(data);
            }
        });
    }

    stop(listener) {
        listener();
    }
}

let database = new Database();

function changeDatabase(newDb) {
    database = newDb;
}

// let firestore = getFirestore(app);

if (typeof window !== "undefined") {
    window._vy_database = database;
}

export default database;
export { database, Database, changeDatabase, serverTimestamp };
