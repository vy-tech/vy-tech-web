import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore as getFirestore$1, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import OpenAI from 'openai';

var type = "service_account";
var project_id = "roarscore-1ddf5";
var private_key_id = "12c960d1ee1a4fd84dabe4cb028d268ae638720f";
var private_key = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDQSHFP8U1zeCSV\n8DE9elkDubIbdxxGaGiuT182i8m1Ws0bj3T4ap1f9WbrEWMbTNBimmrhgRYiLPKZ\nyBo7kU2ZW7mWsV1YsjFD8waFSdUkUxbyq/ZXAkxHnWazwePaPHPus0xnIs7hU7sF\nmxBO3m01NmCanp3/W/LfUlnNLu4Dqhq3AqLHusYshAQmtd41xXacFXGvv5HaLu4G\nUNc3/fkQK3PMenBqA2R/BzCDH3bM7hUBk3PFLKiylfNQDtmAciIWtQm/AGC0YKia\ncuU54Zh9mfOVDi+ZPGirl9AE5zxgC9djyKt66KHrRvb32SE1JIhPf1NeqpATt2+N\n086wUzANAgMBAAECggEAAjCQyGdgChO8RrtEuUG9B9X+8lz5NiBI4XRCKv+jOj3f\nJCgI8celKeoZj+UZ5qKTGkZHU2GZCvjv///jjrbDWxZkyBnLQnB1JiK68dHJ5Nze\nw+Rc7aM/jA0ylDc4nwW9rkfCSN9Lz4Ci2bc8n6ek/Ec7EsUSIiokToa+HPMeW3l8\nfVeS9zTW+E4QbbDCLXFXz/gquPOpGSdIvVZBDIDkRu1uHbHJS8Y7SNitpdYuIv2A\nU5mRtpv3DeMJlP8DzALyEXZXIYwoJaavrGwQHdNwrPvFnFtd/hVGOLCHVgPn7mlM\nzXz3QZTcJGwM3GZu3zoj5tMvCccMOIfkk1S0VMSFnQKBgQDqE763BaqQM8wsLrYf\nDjkgRvcA+2NnuDUUxS/G4+DZP5WIYi9c+jQceHc1Eh/q6wDI/g2Sks3CmPwrFsnf\n1rDElGqTIff2URjx+jqjf4iAsv7oCW8XHpIgOV/oDUJDoeskx7rPBw/pMt/oLBc4\nJsrUK1YZcohLLk8y/h4nui+1bwKBgQDjykE0qfwU2X65OJRqvLgV8BBvi7fraMzu\nM8Fua+pNlT71xbtJ2MNeqVEBkQQD1K+AXXo+wwY5AubkE+Ryx5NDWUSramULtpHn\nQlCUQQPSJ1PbkTP1YslhWogm7eTmDBFibs+JBXPDBN722WVK5pb2SmY2OKRQMwT+\nDq07aEKMQwKBgHYBNEEyUxVVd5XCir/HPNdfz0Aoe6mbPO9WpUpgMUd0fZ7+2J/H\n5yN/O6F+nKaiiIfLQ+5joeV7mIzkdSsqIX1I0R2Rn18G7Ut3+b3ZGmi/VDCIKP//\nwm0KX6YtoP1VkKS/KBccmVHX+vch2ybMr64cltBHZBx6oSS05WDjxQ9zAoGBALV3\nHaUHueMeNR73HP0/JGONoHpMUxN9pKwqnPELlVeDCuoeQIqe3V0fA4J89TbcC4f2\nb/lpwh5O2oNd+YMazI09oz/vfVnscqVJpgnFFXcoj1x+e2cD8KvWxFpG8C/38y14\nW2qr5kG5MqpyG4ik1CSWtoCBdRzS2CpQpN6Lu2AjAoGBAJd6JhnPAwQYd1FKOnbm\nDVThBK+Jdy5K0Zbe24RjshIYvEeCY+DLH9IIg2TO4prs9m2uhN7EBdHKSMsofoyO\ncHSvEQk7DMzsK3fbS6uSVFjRSL+B6/rWfyQRerkJs3IJzZfqlzM1r9WeDzLoSZMy\n0YSVdoN/mUVLhSF/4BioRPsI\n-----END PRIVATE KEY-----\n";
var client_email = "firebase-adminsdk-dm03y@roarscore-1ddf5.iam.gserviceaccount.com";
var client_id = "100927211475441857111";
var auth_uri = "https://accounts.google.com/o/oauth2/auth";
var token_uri = "https://oauth2.googleapis.com/token";
var auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs";
var client_x509_cert_url = "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-dm03y%40roarscore-1ddf5.iam.gserviceaccount.com";
var universe_domain = "googleapis.com";
var credential = {
	type: type,
	project_id: project_id,
	private_key_id: private_key_id,
	private_key: private_key,
	client_email: client_email,
	client_id: client_id,
	auth_uri: auth_uri,
	token_uri: token_uri,
	auth_provider_x509_cert_url: auth_provider_x509_cert_url,
	client_x509_cert_url: client_x509_cert_url,
	universe_domain: universe_domain
};

const app$1 = initializeApp({
    credential: cert(credential),
    storageBucket: credential.project_id + ".firebasestorage.app", // Updated Firebase storage bucket format
});
const db = getFirestore$1(app$1);
const storage = getStorage(app$1);

let firebaseFunctions = {
    getFirestore: () => db,
    doc: (database, ...args) => db.doc(args.join("/")),
    collection: (database, collectionPath) => db.collection(collectionPath),
    setDoc: (docRef, data) => docRef.set(data),
    getDoc: (docRef) => docRef.get(),
    getDocs: (query) => query.get(),
    deleteDoc: (docRef) => docRef.delete(),
    updateDoc: (docRef, updates) => docRef.update(updates),
    query: (collectionRef, ...constraints) => {
        let q = collectionRef;
        constraints.forEach((constraint) => {
            if (constraint.type === "where") {
                q = q.where(constraint.field, constraint.op, constraint.value);
            } else if (constraint.type === "orderBy") {
                q = q.orderBy(constraint.field, constraint.direction || "asc");
            }
        });
        return q;
    },
    where: (field, op, value) => ({ type: "where", field, op, value }),
    orderBy: (field, direction) => ({ type: "orderBy", field, direction }),
    onSnapshot: (query, callback) => query.onSnapshot(callback),
    serverTimestamp: () => Timestamp.now(),
    runTransaction: (database, updateFunction) =>
        db.runTransaction(updateFunction),
    arrayRemove: FieldValue.arrayRemove,
    arrayUnion: FieldValue.arrayUnion,
};

let storageFunctions = {
    getStorage: () => storage,
    ref: (storageInstance, path) => storage.bucket().file(path),
    uploadString: async (fileRef, data) => {
        // Admin SDK uses different method - save buffer to file
        return await fileRef.save(Buffer.from(data, "utf8"));
    },
    getDownloadURL: async (fileRef) => {
        // Admin SDK uses different method to get download URL
        const [url] = await fileRef.getSignedUrl({
            action: "read",
            expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
        });
        return url;
    },
};

global._vy_firebase_admin_sdk = true;
global._vy_firebase_app = app$1;
global._vy_firebase_functions = firebaseFunctions;
global._vy_storage_functions = storageFunctions;

let app;

async function getApp() {
    if (app) return app;

    if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
        console.log("Using Firebase Admin SDK...");
        app = global._vy_firebase_app;
    } else {
        console.log("Initializing Firebase Client App...");
        const { initializeApp } = await import('firebase/app');
        const { config } = await import('../../firebase-config.js');
        app = initializeApp(config);
    }

    return app;
}

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
        const firebaseModules = await import('firebase/firestore');
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

    async query(collectionName, filters = null, order = null) {
        console.log("Querying", collectionName, filters, order);
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

// let firestore = getFirestore(app);

if (typeof window !== "undefined") {
    window._vy_database = database;
}

const EXPIRE_TIME = 5 * 60 * 1000; // 5 minutes

class WebHooksData {
    constructor() {
        this.pending = {};
        this.cancelListener = null;
        this.expireTimer = null;
    }

    async restore(uid) {
        const rows = await database.query("webhooks", { uid: uid });
        if (!rows || rows.length === 0) {
            return;
        }
        for (const row of rows) {
            this.pending[row.key] = row.updated.toMillis();
        }
    }

    async listen(callback, expireCallback = null) {
        if (!callback)
            throw new Error(
                "Callback function is required for listening to webhooks."
            );

        this.cancelListener = await database.listen(
            "webhooks",
            async (webhooks) => {
                for (const webhook of webhooks) {
                    if (this.pending[webhook.key] && webhook.payload) {
                        delete this.pending[webhook.key];
                        await database.delete("webhooks", webhook.id);
                        callback(webhook.payload);
                    }
                }
            }
        );

        if (expireCallback) {
            this.expireTimer = setInterval(async () => {
                await this.expire(expireCallback);
            }, EXPIRE_TIME / 10);

            // Initial expire check after 1 second
            setTimeout(async () => {
                await this.expire(expireCallback);
            }, 1000);
        }
    }

    async expire(callback) {
        const now = new Date().getTime();
        for (const key in this.pending) {
            if (now - this.pending[key] > EXPIRE_TIME) {
                delete this.pending[key];
                await database.deleteAll("webhooks", { key: key });
                if (callback) {
                    callback(key);
                }
            }
        }
    }

    stopListening() {
        if (this.cancelListener) {
            this.cancelListener();
            this.cancelListener = null;
        }

        if (this.expireTimer) {
            clearInterval(this.expireTimer);
            this.expireTimer = null;
        }
    }

    async create(key, uid) {
        console.log(`Creating webhook with key: ${key}`);
        const result = await database.set("webhooks", {
            key: key,
            uid: uid,
        });

        this.pending[key] = new Date().getTime();

        return result;
    }

    async resolve(key, payload) {
        console.log(`Resolving webhook with key: ${key}`);
        const webhooks = await database.query("webhooks", { key: key });
        if (webhooks.length === 0) {
            throw new Error(`No webhook found for key: ${key}`);
        }

        const webhook = webhooks[0];
        return await database.update("webhooks", webhook.id, {
            payload: payload,
        });
    }
}

class Hierarchy {
    constructor(fromString = null) {
        this.location = null;
        this.date = null;
        this.event = null;
        this.org = null;
        this.camera = null;
        this.file = null;
        this.context = null;

        if (fromString instanceof Hierarchy) {
            this.location = fromString.location;
            this.date = fromString.date;
            this.event = fromString.event;
            this.org = fromString.org;
            this.camera = fromString.camera;
            this.file = fromString.file;
            this.context = fromString.context;
        } else if (fromString) {
            this.parseHierarchyString(fromString);
        }
    }

    parseHierarchyString(hierarchyString) {
        /**
         * $location/$date					    - length=2, ends with number
         * $org/$file					        - length=2, both are strings
         * $org/$context/$file                  - length=3, last is string
         * $location/$date/$camera				- length=3, ends with number
         * $org/$location/$date/$event			- length=4, ends with string
         * $org/$location/$date/$camera		    - length=4, ends with number
         * $org/$location/$date/$event/$camera	- length=5, ends with number
         * $org/$location/$date/$event/$file	- length=5, ends with string
         * $key=$val/...					    - length=n, all vals contain equals
         **/
        let parts = hierarchyString.split(/(?<!\\)[\-\:\/]/);
        parts = parts.map((p) => p.replace(/\\([\-:\/])/g, "$1"));

        if (parts.every((p) => p.includes("="))) {
            for (const part of parts) {
                const eqIdx = part.indexOf("=");
                this[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
            }
        } else if (parts.length === 2) {
            if (/^\d+$/.test(parts[1])) {
                this.location = parts[0];
                this.date = parseInt(parts[1]);
            } else {
                this.org = parts[0];
                this.file = parts[1];
            }
        } else if (
            parts.length === 3 &&
            /^\d+$/.test(parts[1]) &&
            /^\d+$/.test(parts[2])
        ) {
            this.location = parts[0];
            this.date = parseInt(parts[1]);
            this.camera = parseInt(parts[2]);
        } else if (parts.length === 3) {
            this.org = parts[0];
            this.context = parts[1];
            this.file = parts[2];
        } else if (parts.length === 4) {
            if (/^\d+$/.test(parts[3])) {
                this.org = parts[0];
                this.location = parts[1];
                this.date = parseInt(parts[2]);
                this.camera = parseInt(parts[3]);
            } else {
                this.org = parts[0];
                this.location = parts[1];
                this.date = parseInt(parts[2]);
                this.event = parts[3];
            }
        } else if (parts.length === 5) {
            this.org = parts[0];
            this.location = parts[1];
            this.date = parseInt(parts[2]);
            this.event = parts[3];
            if (/^\d+$/.test(parts[4])) {
                this.camera = parseInt(parts[4]);
            } else {
                this.file = parts[4];
            }
        } else if (parts.length === 6) {
            this.org = parts[0];
            this.location = parts[1];
            this.date = parseInt(parts[2]);
            this.event = parts[3];
            this.context = parts[4];
            this.file = parts[5];
        }
    }

    escapePart(part) {
        return part.replace(/([\-:\/])/g, "\\$1");
    }

    toString(separator = ":") {
        if (this.file) {
            return this.toFileString(separator);
        } else if (this.camera) {
            return this.toCameraString(separator);
        } else {
            return this.toEventString(separator);
        }
    }

    toFileString(separator = ":") {
        if (this.location && this.event) {
            return [
                this.location,
                this.date,
                this.event,
                this.escapePart(this.file),
            ].join(separator);
        } else if (this.context) {
            return [this.org, this.context, this.escapePart(this.file)].join(
                separator
            );
        } else {
            return [this.org, this.escapePart(this.file)].join(separator);
        }
    }

    toCameraString(separator = ":", defaultCamera = 1) {
        let cam = (this.camera || defaultCamera).toString().padStart(2, "0");

        if (this.org && this.event) {
            return [this.org, this.location, this.date, this.event, cam].join(
                separator
            );
        } else if (this.org) {
            return [this.org, this.location, this.date, cam].join(separator);
        } else {
            return [this.location, this.date, cam].join(separator);
        }
    }

    toEventString(separator = ":") {
        if (this.org && this.event) {
            return [this.org, this.location, this.date, this.event].join(
                separator
            );
        } else {
            return [this.location, this.date].join(separator);
        }
    }

    toFileOrEventString(separator = ":") {
        if (this.file) {
            return this.toFileString(separator);
        } else {
            return this.toEventString(separator);
        }
    }

    static test() {
        let passed = 0;
        let failed = 0;

        function assert(label, actual, expected) {
            if (actual === expected) {
                console.log(`  ✓ ${label}`);
                passed++;
            } else {
                console.error(
                    `  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
                );
                failed++;
            }
        }

        function test(label, input, expectedFields) {
            console.log(`${label}: "${input}"`);
            const h = new Hierarchy(input);
            for (const [key, val] of Object.entries(expectedFields)) {
                assert(key, h[key], val);
            }
        }

        // $location/$date — length=2, ends with number
        test("location/date", "MainStreet/20240101", {
            location: "MainStreet",
            date: 20240101,
            org: null,
            event: null,
            camera: null,
            file: null,
        });

        // $org/$file — length=2, both strings
        test("org/file", "AcmeCorp/game.mp4", {
            org: "AcmeCorp",
            file: "game.mp4",
            location: null,
            date: null,
            event: null,
            camera: null,
        });

        // $location/$date/$camera — length=3, ends with number
        test("location/date/camera", "MainStreet/20240101/2", {
            location: "MainStreet",
            date: 20240101,
            camera: 2,
            org: null,
            event: null,
            file: null,
        });

        // $org/$location/$date/$event — length=4, ends with string
        test("org/location/date/event", "AcmeCorp/MainStreet/20240101/Finals", {
            org: "AcmeCorp",
            location: "MainStreet",
            date: 20240101,
            event: "Finals",
            camera: null,
            file: null,
        });

        // $org/$location/$date/$camera — length=4, ends with number
        test("org/location/date/camera", "AcmeCorp/MainStreet/20240101/3", {
            org: "AcmeCorp",
            location: "MainStreet",
            date: 20240101,
            camera: 3,
            event: null,
            file: null,
        });

        // $org/$location/$date/$event/$camera — length=5, ends with number
        test(
            "org/location/date/event/camera",
            "AcmeCorp/MainStreet/20240101/Finals/2",
            {
                org: "AcmeCorp",
                location: "MainStreet",
                date: 20240101,
                event: "Finals",
                camera: 2,
                file: null,
            }
        );

        // $org/$location/$date/$event/$file — length=5, ends with string
        test(
            "org/location/date/event/file",
            "AcmeCorp/MainStreet/20240101/Finals/clip.mp4",
            {
                org: "AcmeCorp",
                location: "MainStreet",
                date: 20240101,
                event: "Finals",
                file: "clip.mp4",
                camera: null,
            }
        );

        // $key=$val/... — all parts contain equals
        test(
            "key=val pairs",
            "org=AcmeCorp/location=MainStreet/date=20240101",
            {
                org: "AcmeCorp",
                location: "MainStreet",
                date: "20240101",
            }
        );

        console.log(`\n${passed} passed, ${failed} failed`);
        return failed === 0;
    }
}

if (typeof window !== "undefined") {
    window.Hierarchy = Hierarchy;
}

class ConversationsData {
    constructor() {}

    async getById(id) {
        console.log("Getting conversation by ID:", id);
        return await database.get("conversations", id);
    }

    async getByConversationId(conversationId) {
        console.log("Getting conversation by conversation ID:", conversationId);
        const results = await database.query("conversations", {
            conversation: conversationId,
        });

        if (results.length === 0) return null;
        return results[0];
    }

    async getByUserId(userId) {
        console.log("Getting conversations for user ID:", userId);
        return await database.query("conversations", { uid: userId });
    }

    async listenByUserId(userId, callback) {
        console.log("Listening to conversations for user ID:", userId);
        return await database.listen("conversations", callback, {
            uid: userId,
        });
    }

    async getAllConversations() {
        console.log("Getting all conversations");
        return await database.query("conversations");
    }

    async create(uid, question, conversation) {
        const conversationData = {
            uid: uid,
            name: question,
            question: question,
            conversation: conversation,
            status: "active",
        };

        await database.set("conversations", conversationData);

        return conversationData;
    }

    async update(id, updates) {
        return await database.update("conversations", id, updates);
    }

    async delete(id) {
        return await database.delete("conversations", id);
    }

    async getByUid(uid) {
        console.log("Getting conversations for UID:", uid);
        const results = await database.query("conversations", { uid: uid });

        results.sort((a, b) => {
            return b.updated - a.updated;
        });
        console.log("Found conversations:", results);
        return results;
    }
}

class MessagesData {
    constructor(conversation) {
        this.conversation = conversation;
        this.history = [];
        this.lookup = {};
    }

    async getAll() {
        const results = await database.query("messages", {
            conversation: this.conversation,
        });

        results.sort((a, b) => {
            return a.created - b.created;
        });

        return results;
    }

    async getSince(timestamp) {
        const results = await this.getAll();

        if (timestamp)
            return results.filter((msg) => msg.created.toMillis() > timestamp);

        return results;
    }

    async getRecent(limit = 10) {
        const results = await this.getAll();
        return results.slice(-limit);
    }

    static async updateResponse(response_id, updates) {
        const messages = await database.query("messages", {
            response_id: response_id,
        });

        if (messages.length === 0) {
            throw new Error(
                `No message found with response_id: ${response_id}`
            );
        }

        const message = messages[0];
        return await database.update("messages", message.id, updates);
    }

    receive(messages) {
        const newMessages = [];

        for (const message of messages) {
            if (!this.lookup[message.id]) {
                this.history.push(message);
                this.lookup[message.id] = message;
                newMessages.push(message);
            }
        }

        if (newMessages.length > 0 && this.callback) {
            newMessages.sort((a, b) => a.created - b.created);
            this.callback(newMessages);
        }
    }

    async listen(callback) {
        this.callback = callback;
        this.listener = await database.listen(
            "messages",
            (messages) => this.receive(messages),
            {
                conversation: this.conversation,
            }
        );
    }

    stopListening() {
        if (this.listener) {
            database.stop(this.listener);
            this.listener = null;
        }
    }

    async add(messageData) {
        messageData.conversation = this.conversation;
        return await database.set("messages", messageData);
    }

    async update(id, updates) {
        return await database.update("messages", id, updates);
    }

    async deleteConversation(id) {
        let messages = await database.query("messages", { conversation: id });
        for (const message of messages) {
            await database.delete("messages", message.id);
        }
    }

    asText(messages) {
        return messages
            .map(
                (msg) =>
                    `${
                        msg.type == "tool_response"
                            ? "TOOL"
                            : msg.role.toUpperCase()
                    }: ${msg.content}`
            )
            .join("\n");
    }
}

const MODEL = "gpt-5.2";
const SUMMARIZATION_MODEL = "gpt-5-nano";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const openaiWebhookSecret = defineSecret("OPENAI_WEBHOOK_SECRET");
const openaiPromptId = defineSecret("OPENAI_PROMPT_ID");
const openaiPromptVersion = defineSecret("OPENAI_PROMPT_VERSION");
const weatherApiKey = defineSecret("WEATHER_API_KEY");

let openai;
const initializeOpenAI = () => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || openaiApiKey.value(),
            webhookSecret:
                process.env.OPENAI_WEBHOOK_SECRET ||
                openaiWebhookSecret.value(),
        });
    }
    return openai;
};

const isAuthenticated = async (req) => {
    try {
        // Get the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return {
                authenticated: false,
                error: "No valid authorization header",
            };
        }

        // Extract the ID token
        const idToken = authHeader.split("Bearer ")[1];

        // Verify the ID token
        const decodedToken = await getAuth().verifyIdToken(idToken);

        return {
            authenticated: true,
            uid: decodedToken.uid,
            user: decodedToken,
        };
    } catch (error) {
        console.error("Authentication error:", error);
        return {
            authenticated: false,
            error: "Invalid token",
        };
    }
};

const parseJsonBody = (body) => {
    if (Buffer.isBuffer(body)) {
        return JSON.parse(body.toString());
    } else if (typeof body === "object") {
        return body;
    } else if (typeof body === "string") {
        return JSON.parse(body);
    } else if (body) {
        return JSON.parse(body.toString());
    } else {
        return null;
    }
};

// Authentication middleware
const requireAuth = async (req, res, next) => {
    const authResult = await isAuthenticated(req);

    if (!authResult.authenticated) {
        console.warn("Unauthorized access attempt");
        return res.status(401).json({
            error: "Unauthorized",
            message: authResult.error,
        });
    }

    // Add user info to request object for use in route handlers
    req.user = authResult.user;
    req.uid = authResult.uid;

    next();
};

// Express app for development
const chatApp = express();

chatApp.use(express.raw({ type: "*/*" }));

// NOTE: Webhook endpoint is setup to receive raw body inputs upstream
// Define webhook route BEFORE authentication middleware
chatApp.post("/webhook", async (req, res) => {
    try {
        const client = initializeOpenAI();

        let rawBody;

        if (req.rawBody) {
            rawBody = Buffer.isBuffer(req.rawBody)
                ? req.rawBody.toString()
                : req.rawBody;
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString();
        } else if (typeof req.body === "string") {
            rawBody = req.body;
        } else {
            console.log("Invalid body format.");
            console.log("req.body:", req.body);
            console.log("typeof req.body:", typeof req.body);
            console.log("req.rawBody:", req.rawBody);
            console.log("typeof req.rawBody:", typeof req.rawBody);

            res.status(400).send("Invalid body format");
            return;
        }

        // Verify and unwrap the webhook event
        const event = await client.webhooks.unwrap(rawBody, req.headers);

        // Acknowledge receipt of the webhook
        res.status(200).send("Webhook received");

        // Handle the event asynchronously
        setImmediate(async () => await resolveWebhook(event));
    } catch (error) {
        console.error("Webhook processing error:", error);
        console.log("req.headers:", req.headers);
        console.log("req.body:", req.body);
        console.log(
            "dev secret length:",
            process.env.OPENAI_WEBHOOK_SECRET?.length
        );
        console.log("prod secret length:", openaiWebhookSecret.value()?.length);

        res.status(400).send("Webhook processing failed");
    }
});

const resolveWebhook = async (event) => {
    const key = event.data.id;
    const webhooks = new WebHooksData();
    try {
        return await webhooks.resolve(key, event);
    } catch (error) {
        console.error(`Error resolving webhook with key ${key}:`, error);
    }
};

chatApp.use(requireAuth);

chatApp.post("/start", async (req, res) => {
    try {
        const client = initializeOpenAI();

        console.log("Creating new conversation");
        const conversation = await client.conversations.create();
        console.log("Created new conversation:", conversation);

        res.json(conversation);
    } catch (error) {
        console.error("Error creating conversation:", error);
        console.log("Request body:", req.body);
        console.log("Request headers:", req.headers);
        console.log("Dev api key length:", process.env.OPENAI_API_KEY?.length);
        console.log("Prod api key length:", openaiApiKey.value()?.length);
        res.status(400).json({ error: "Failed to create conversation" });
    }
});

chatApp.post("/finish", async (req, res) => {
    try {
        const data = parseJsonBody(req.body);
        const client = initializeOpenAI();

        const conversationId = data.conversation;
        console.log(`Deleting conversation ${conversationId}`);
        const result = await client.conversations.delete(conversationId);
        console.log(`Deleted conversation ${conversationId}: `, result);

        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting conversation:", error);
        console.log("Request body:", req.body);
        console.log("Request raw body:", req.rawBody);
        console.log("Request headers:", req.headers);
        console.log("Dev api key length:", process.env.OPENAI_API_KEY?.length);
        console.log("Prod api key length:", openaiApiKey.value()?.length);
        res.status(400).json({ error: "Failed to delete conversation" });
    }
});

chatApp.post("/response", async (req, res) => {
    try {
        const data = parseJsonBody(req.body);
        const client = initializeOpenAI();

        const type = data.type || "message";
        const content = data.content;
        const conversation = data.conversation;

        let msgs = [];

        if (type === "message") {
            msgs.push({ role: "user", content: content });
        } else if (type === "tool_response") {
            msgs = data.output.map((output) => ({
                type: "function_call_output",
                output: output.output,
                call_id: output.call_id,
            }));
        }

        const promptId = process.env.OPENAI_PROMPT_ID || openaiPromptId.value();
        const promptVersion =
            process.env.OPENAI_PROMPT_VERSION || openaiPromptVersion.value();

        // TODO FIXME set up dev/prod split pmpt_68ff94173ef4819686db667303d9b8eb0be186025f5a95ae
        const args = {
            model: MODEL,
            conversation: conversation,
            prompt: {
                id: promptId,
                version: promptVersion,
            },
            input: msgs,
            background: true,
        };

        console.log("Calling Response API with", args);
        const response = await client.responses.create(args);
        console.log("Response API returned", response);

        res.json(response);
    } catch (error) {
        console.error("Error creating response:", error);
        console.log("Request body:", req.body);
        console.log("Request headers:", req.headers);
        console.log("Dev api key length:", process.env.OPENAI_API_KEY?.length);
        console.log("Prod api key length:", openaiApiKey.value()?.length);
        console.log("Dev prompt id:", process.env.OPENAI_PROMPT_ID);
        console.log("Prod prompt id:", openaiPromptId.value());
        console.log("Dev prompt version:", process.env.OPENAI_PROMPT_VERSION);
        console.log("Prod prompt version:", openaiPromptVersion.value());

        if (error.status === 404) {
            console.warn("Prompt or conversation not found");
            return res
                .status(404)
                .json({ error: "Prompt or conversation not found" });
        } else {
            res.status(400).json({ error: "Failed to create response" });
        }
    }
});

chatApp.get("/response/:responseId", async (req, res) => {
    const client = initializeOpenAI();
    const responseId = req.params.responseId;

    try {
        console.log(`Retrieving response ${responseId} from Response API`);
        const response = await client.responses.retrieve(responseId);
        console.log("Retrieved response:", response);
        res.json(response);
    } catch (error) {
        if (error.status === 404) {
            console.warn(`Response ${responseId} not found`);
            res.status(404).json({ error: "Response not found" });
        } else {
            console.error("Error retrieving response:", error);
            res.status(400).json({ error: "Failed to retrieve response" });
        }
    }
});

// TODO FIXME: This doesn't work because the conversation on OpenAIs side and ours
// are out of sync.
// The createItems call will allow us to add the messsages back into the new conversation
chatApp.post("/duplicate/:conversationId", async (req, res) => {
    const client = initializeOpenAI();
    const cid = req.params.conversationId;

    // Get the existing conversation
    console.log("Retrieving conversation to duplicate:", cid);
    const convos = new ConversationsData();
    let conversation = await convos.getByConversationId(cid);
    if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
    }

    // Create a new conversation
    console.log("Creating new conversation to duplicate from", cid);
    const newConversation = await client.conversations.create();
    console.log("Created new conversation:", newConversation);

    // Create a new conversation entry in the database
    await convos.create(
        req.uid,
        conversation.question || conversation.name || "Duplicated Conversation",
        newConversation.id
    );

    // Get all messages from the existing conversation
    const msgs = new MessagesData(cid);
    const messages = await msgs.getAll();

    // Add messages to the new conversation
    const newMsgs = new MessagesData(newConversation.id);
    for (const m of messages) {
        m.conversation = newConversation.id;
        await newMsgs.add(m);
    }

    res.json({
        conversation: newConversation,
    });
});

chatApp.post("/restart/:conversationId", async (req, res) => {
    const client = initializeOpenAI();
    const cid = req.params.conversationId;

    // Get the existing conversation
    const convos = new ConversationsData();
    let conversation = await convos.getByConversationId(cid);
    if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
    }

    /// If the conversation has a summary get the last few messages
    /// Otherwise get all the messages
    const msgs = new MessagesData(cid);
    let messages = conversation.summary
        ? await msgs.getRecent(3)
        : await msgs.getAll();

    // Create a new conversation by calling the /start endpoint
    console.log("Creating new conversation to restart from", cid);
    const newConversation = await client.conversations.create();
    console.log("Created new conversation:", newConversation);

    // Create an input array to re-establish context in the new conversation
    let input = [
        {
            role: "system",
            content: `You are continuing a previous conversation named "${conversation.name}" that was abandoned or had an error.`,
        },
    ];
    if (conversation.summary) {
        input.push({
            role: "system",
            content:
                "The following is a summary of your previous conversation:\n\n" +
                conversation.summary,
        });
        input.push({
            role: "system",
            content:
                "Here are the last few messages from that conversation to re-establish context:\n\n" +
                msgs.asText(messages),
        });
    } else {
        input.push({
            role: "system",
            content:
                "Here are the previous messages from that conversation to re-establish context:\n\n" +
                msgs.asText(messages),
        });
    }

    // Add messages to the new conversation
    const newMsgs = new MessagesData(newConversation.id);
    for (const m of input) {
        await newMsgs.add({
            role: m.role,
            content: m.content,
            type: "message",
        });
    }

    // Call the Responses API to create a response in the new conversation with the input array
    const promptId = process.env.OPENAI_PROMPT_ID || openaiPromptId.value();
    const promptVersion =
        process.env.OPENAI_PROMPT_VERSION || openaiPromptVersion.value();

    const args = {
        model: MODEL,
        conversation: newConversation.id,
        prompt: {
            id: promptId,
            version: promptVersion,
        },
        input: input,
        background: true,
    };

    console.log("Calling Response API with", args);
    const response = await client.responses.create(args);
    console.log("Response API returned", response);

    // Return the new conversation ID and response
    res.json({
        conversation: newConversation,
        response: response,
    });
});

chatApp.post("/summarize/:conversationId", async (req, res) => {
    const client = initializeOpenAI();
    const conversationId = req.params.conversationId;

    console.log(`Generating summary for conversation ${conversationId}`);

    // Get existing conversation and messages
    const conversationData = new ConversationsData();
    let conversation =
        await conversationData.getByConversationId(conversationId);
    if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
    }

    const messagesData = new MessagesData(conversationId);
    const messages = await messagesData.getSince(conversation.summarized);

    if (messages.length === 0) {
        res.json({ summary: conversation.summary || "" });
        return;
    }

    let newMessages = messagesData.asText(messages);

    // Construct prompt for summarization
    let msgs = [
        {
            role: "developer",
            content:
                "You are a system summarizer for Vy.\n" +
                "Your job is to maintain a concise running summary and title of an analysis session.\n" +
                "The summary should include:\n" +
                "   * User's goals/questions so far\n" +
                "   * Important events, decisions, and conclusions\n" +
                "   * IDs of key data objects (e.g., result_ids, session_ids) if present\n" +
                "The title should be a concise phrase summarizing the overall topic.\n" +
                "Keep the summary under ~400 words and the title under ~10 words. Be specific but not verbose.\n",
        },
        {
            role: "user",
            content:
                "Here is the existing summary of the conversation so far (may be empty):\n\n```" +
                conversation.summary +
                "```\n\n" +
                "Here are the messages since that summary:\n\n```" +
                newMessages +
                "```\n\n" +
                "Please produce an UPDATED summary and title that:\n" +
                "  * Preserves important information from the previous summary\n" +
                "  * Incorporates any new important information from the messages\n" +
                "  * Drops details that no longer seem important" +
                "Produce the UPDATED summary and title in the following JSON format:\n" +
                '{ "title": "<new title>", "summary": "<new summary>" }',
        },
    ];

    // Call the Responses API to generate the summary
    try {
        const args = {
            model: SUMMARIZATION_MODEL,
            input: msgs,
            background: false,
            max_output_tokens: 1000,
            reasoning: { effort: "minimal" },
        };
        const response = await client.responses.create(args);

        const output = response.output_text;

        if (!output || output.trim().length === 0) {
            res.status(400).json({ error: "Empty summary generated" });
            return;
        }

        console.log("Raw summary output:", output);

        // Parse the output JSON
        const summaryData = JSON.parse(output);
        const summary = summaryData.summary || "";
        const title = summaryData.title;

        // Update conversation summary, title, and timestamp
        await conversationData.update(conversation.id, {
            summary: summary,
            name: title,
            summarized: new Date(),
        });

        res.json({ summary: summary });
    } catch (error) {
        console.error("Error generating summary:", error);
        res.status(400).json({ error: "Failed to generate summary" });
    }
});

chatApp.post("/tool/weather", async (req, res) => {
    const data = parseJsonBody(req.body);
    const locationHierarchy = data.hierarchy;
    const hierarchy = new Hierarchy(locationHierarchy);
    let rows = await database.query("locations", {
        token: hierarchy.location,
    });
    if (rows.length === 0) {
        res.status(404).json({ error: "Location not found" });
        return;
    }

    const locationData = rows[0];

    hierarchy.camera = 1;
    rows = await database.query("events", {
        hierarchy: hierarchy.toString(),
    });

    if (rows.length === 0) {
        res.status(404).json({ error: "Event not found" });
        return;
    }

    if (!hierarchy.date) {
        res.status(400).json({ error: "Hierarchy must include a date" });
        return;
    }

    const eventData = rows[0];

    // Change YYYYMMDD to YYYY-MM-DD
    const date = hierarchy.date.toString();
    const dt = [
        date.substring(0, 4),
        date.substring(4, 6),
        date.substring(6, 8),
    ].join("-");

    const q = locationData.zip;

    const apikey = process.env.WEATHER_API_KEY || weatherApiKey.value();
    const url = `https://api.weatherapi.com/v1/history.json?key=${apikey}&q=${q}&dt=${dt}`;
    console.log("Fetching weather data from URL:", url);
    const response = await fetch(url);

    if (!response.ok) {
        console.error(
            `Weather API request failed with status ${response.status}`
        );
        res.status(400).json({ error: "Failed to fetch weather data" });
        return;
    }

    const weatherData = await response.json();

    const hourly = weatherData.forecast.forecastday[0].hour;
    hourly.forEach((hour) => {
        hour.time_until_event_start =
            eventData.begin.toMillis() / 1000 - hour.time_epoch;
        hour.time_until_event_end =
            eventData.end.toMillis() / 1000 - hour.time_epoch;
    });

    res.json(hourly);
});

const functionApp = express();
functionApp.use("/api/chat", chatApp);

console.log("Setting up Cloud Function export...");
// Export Cloud Function for production
const chat = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        secrets: [
            openaiApiKey,
            openaiWebhookSecret,
            openaiPromptId,
            openaiPromptVersion,
            weatherApiKey,
        ],
        invoker: "public",
    },
    functionApp
);

export { chat, chatApp };
//# sourceMappingURL=index.js.map
