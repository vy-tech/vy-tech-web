import { initializeApp, cert } from "firebase-admin/app";
import credential from "../firebase-svc-cred.json" with { type: "json" };
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { Timestamp } from 'firebase-admin/firestore'; 

const app = initializeApp({ 
    credential: cert(credential),
    storageBucket: credential.project_id + '.firebasestorage.app'  // Updated Firebase storage bucket format
});
const db = getFirestore(app);
const storage = getStorage(app);

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
                    q = q.where(
                        constraint.field,
                        constraint.op,
                        constraint.value
                    );
                } else if (constraint.type === "orderBy") {
                    q = q.orderBy(
                        constraint.field,
                        constraint.direction || "asc"
                    );
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
    };

let storageFunctions = {
    getStorage: () => storage,
    ref: (storageInstance, path) => storage.bucket().file(path),
    uploadString: async (fileRef, data) => {
        // Admin SDK uses different method - save buffer to file
        return await fileRef.save(Buffer.from(data, 'utf8'));
    },
    getDownloadURL: async (fileRef) => {
        // Admin SDK uses different method to get download URL
        const [url] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
        });
        return url;
    }
};

global._vy_firebase_admin_sdk = true;
global._vy_firebase_app = app;
global._vy_firebase_functions = firebaseFunctions;
global._vy_storage_functions = storageFunctions;
