import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore as getFirestore$1, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';

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

    async set(collectionName, docData) {
        console.log("Setting", collectionName, docData);
        await this.ensureFirestore();

        if (!docData.id) {
            docData.id = this.pushid();
            docData.created = serverTimestamp();
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

/**
 * OrganizationsData class manages organization-related data operations.
 *
 * Organizations are represented in a single collection as follows:
 * - id: Record identifier (auto-generated)
 * - name: Name of the organization
 * - owners: Array of user IDs who are owners
 * - members: Array of user IDs who are members (including owners)
 * - invites: Array of outstanding invitation tokens
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION = "organizations";

class OrganizationsData {
    constructor() {}

    // =========================================================================
    // Query Methods
    // =========================================================================

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByUser(userId) {
        return await database.query(COLLECTION, {
            members: { op: "array-contains", value: userId },
        });
    }

    async getByOwner(userId) {
        return await database.query(COLLECTION, {
            owners: { op: "array-contains", value: userId },
        });
    }

    // =========================================================================
    // CRUD Methods
    // =========================================================================

    async create(name, ownerUserId) {
        const org = {
            name,
            owners: [ownerUserId],
            members: [ownerUserId],
            invites: [],
        };
        const id = await database.set(COLLECTION, org);
        return id;
    }

    async update(id, updates) {
        const allowedFields = ["name"];
        const filteredUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        if (Object.keys(filteredUpdates).length === 0) {
            return false;
        }
        return await database.update(COLLECTION, id, filteredUpdates);
    }

    async delete(id) {
        const org = await this.getById(id);
        if (org?.isPersonal) {
            throw new Error("Cannot delete personal organization");
        }
        return await database.delete(COLLECTION, id);
    }

    async ensurePersonalOrg(userId, displayName) {
        const id = `personal_${userId}`;
        const orgName = displayName ? `${displayName}'s Personal` : "Personal";
        let existing = null;
        try {
            existing = await database.get(COLLECTION, id);
        } catch (error) {
            console.error("Error checking for personal organization:", error);
        }

        if (existing) {
            return existing;
        }

        const org = {
            id: id,
            name: orgName,
            isPersonal: true,
            owners: [userId],
            members: [userId],
            invites: [],
        };
        await database.set(COLLECTION, org);
        return await this.getById(org.id);
    }

    // =========================================================================
    // Membership Methods
    // =========================================================================

    async addMember(orgId, userId) {
        return await database.update(COLLECTION, orgId, {
            members: { op: "arrayUnion", value: userId },
        });
    }

    async removeMember(orgId, userId) {
        // Remove from both members and owners
        return await database.update(COLLECTION, orgId, {
            members: { op: "arrayRemove", value: userId },
            owners: { op: "arrayRemove", value: userId },
        });
    }

    async addOwner(orgId, userId) {
        // Add to both owners and members (in case not already a member)
        return await database.update(COLLECTION, orgId, {
            owners: { op: "arrayUnion", value: userId },
            members: { op: "arrayUnion", value: userId },
        });
    }

    async removeOwner(orgId, userId) {
        // Remove from owners only, keep as member
        return await database.update(COLLECTION, orgId, {
            owners: { op: "arrayRemove", value: userId },
        });
    }

    // =========================================================================
    // Invitation Methods
    // =========================================================================

    async createInvite(orgId) {
        const token = database.pushid();
        await database.update(COLLECTION, orgId, {
            invites: { op: "arrayUnion", value: token },
        });
        return token;
    }

    async getByInvite(token) {
        const orgs = await database.query(COLLECTION, {
            invites: { op: "array-contains", value: token },
        });

        if (!orgs || orgs.length === 0) {
            return null;
        }

        if (orgs.length > 1) {
            console.warn(
                "Multiple organizations found with the same invite token:",
                token
            );
        }

        return orgs[0];
    }

    async acceptInvite(token, userId, role = "member") {
        const org = await this.getByInvite(token);
        if (!org) {
            return null;
        }

        // Remove the invite token
        await database.update(COLLECTION, org.id, {
            invites: { op: "arrayRemove", value: token },
        });

        // Add user based on role
        if (role === "owner") {
            await this.addOwner(org.id, userId);
        } else {
            await this.addMember(org.id, userId);
        }

        return org.id;
    }

    async revokeInvite(orgId, token) {
        return await database.update(COLLECTION, orgId, {
            invites: { op: "arrayRemove", value: token },
        });
    }
}

// Helper to sync a user's org memberships to their custom claims
async function syncUserOrgClaims(userId) {
    const orgsData = new OrganizationsData();
    const orgs = await orgsData.getByUser(userId);
    const orgIds = orgs.map((org) => org.id);

    await getAuth().setCustomUserClaims(userId, { orgIds });
    console.log(`Updated claims for user ${userId}: orgIds = [${orgIds.join(", ")}]`);
    return orgIds;
}

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
const orgApp = express();

orgApp.use(express.json());
orgApp.use(requireAuth);

// Accept an invite token and join organization
orgApp.post("/accept/:token", async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Invite token is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const orgId = await orgsData.acceptInvite(token, req.uid);

        if (!orgId) {
            return res.status(404).json({
                error: "Not Found",
                message: "Invalid or expired invite token",
            });
        }

        // Sync user's org claims
        await syncUserOrgClaims(req.uid);

        const org = await orgsData.getById(orgId);

        return res.status(200).json({
            success: true,
            message: "Successfully joined organization",
            organization: {
                id: org.id,
                name: org.name,
            },
        });
    } catch (error) {
        console.error("Error accepting invite:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to accept invite",
        });
    }
});

// Create a new organization
orgApp.post("/create", async (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Organization name is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const orgId = await orgsData.create(name.trim(), req.uid);

        // Sync user's org claims
        await syncUserOrgClaims(req.uid);

        const org = await orgsData.getById(orgId);

        return res.status(201).json({
            success: true,
            message: "Organization created",
            organization: {
                id: org.id,
                name: org.name,
            },
        });
    } catch (error) {
        console.error("Error creating organization:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to create organization",
        });
    }
});

// Delete an organization (owner only)
orgApp.delete("/:orgId", async (req, res) => {
    const { orgId } = req.params;

    if (!orgId) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Organization ID is required",
        });
    }

    try {
        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(orgId);

        if (!org) {
            return res.status(404).json({
                error: "Not Found",
                message: "Organization not found",
            });
        }

        // Check if user is an owner
        if (!org.owners.includes(req.uid)) {
            return res.status(403).json({
                error: "Forbidden",
                message: "Only owners can delete an organization",
            });
        }

        // Get all members before deletion to update their claims
        const memberIds = [...org.members];

        // Delete the organization
        await orgsData.delete(orgId);

        // Sync claims for all affected members
        for (const memberId of memberIds) {
            await syncUserOrgClaims(memberId);
        }

        return res.status(200).json({
            success: true,
            message: "Organization deleted",
        });
    } catch (error) {
        console.error("Error deleting organization:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to delete organization",
        });
    }
});

const functionApp = express();
functionApp.use("/api/org", orgApp);

console.log("Setting up Cloud Function export...");
// Export Cloud Function for production
const org = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        invoker: "public",
    },
    functionApp
);

export { org, orgApp };
//# sourceMappingURL=index.js.map
