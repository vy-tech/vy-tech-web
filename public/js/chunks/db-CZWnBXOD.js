import { r as rsv, e as eventBus } from './eventbus-DzIYHcTJ.js';
import { a as app } from './firebase-DZfJhUTE.js';
import { v as van } from './van-t8DywzvC.js';

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) ; else {
    const {
        getFirestore,
        doc,
        collection,
        addDoc,
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
    } = await import('./index.esm-CZAaSGHK.js');
}

class Database {
    constructor() {
        this.db = getFirestore(app);
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
        const docRef = doc(this.db, collectionName, docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return null;
        }

        const data = docSnap.data();
        data.id = docSnap.id;
        return data;
    }

    async query(collectionName, filters = null, order = null) {
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
                q = query(q, orderBy(order));
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
        const docRef = doc(this.db, collectionName, docId);
        await deleteDoc(docRef);
        return true;
    }

    async update(collectionName, docId, updates) {
        const docRef = doc(this.db, collectionName, docId);
        updates.updated = serverTimestamp();
        await updateDoc(docRef, updates);
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

    listen(collectionName, callback, filters = null) {
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

    watch(collectionName, docId, callback) {
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

class Form {
    constructor(collection, fields) {
        this.collection = collection;
        this.fields = fields;
        this.db = new Database();
        eventBus.addEventListener(`${this.collection}FormSubmitClick`, (e) => {
            this.handleSubmit();
        });
    }

    async handleSubmit() {
        const formData = Object.fromEntries(
            Array.from(this.fields).map((field) => {
                const fieldName = field.name;
                const fieldId = field.id || `${fieldName}Input`;
                const fieldValue = document.getElementById(fieldId).value;
                return [fieldName, fieldValue];
            })
        );

        console.log("Form data:", formData);
        try {
            const docId = await this.db.set(this.collection, formData);
            console.log("Document written with ID: ", docId);
        } catch (error) {
            console.error("Error adding document: ", error);
        }
    }

    getElementsForField(field) {
        const { label, input, div } = van.tags;

        const fieldName = field.name;
        const fieldId = field.id || `${fieldName}Input`;
        const fieldDisplayName = field.displayName || fieldName;
        const isRequired = field.required || false;
        const fieldType = field.type || "text";
        const containerClass = field.containerClass || "w-full";

        return div(
            { class: containerClass },
            label(
                {
                    for: fieldId,
                    class: "block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2",
                },
                fieldDisplayName
            ),
            input({
                id: fieldId,
                name: fieldName,
                type: fieldType,
                placeholder: fieldDisplayName,
                required: isRequired,
                class: "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline",
            })
        );
    }

    addElements(parentElement) {
        const { div } = van.tags;
        const { button } = rsv.tags;

        parentElement =
            parentElement ||
            document.getElementById("form-container") ||
            document.body;

        var rows = [];

        for (var i = 0; i < this.fields.length; i++) {
            const field = this.fields[i];
            const fieldRow = field.row || i;
            const fieldElements = this.getElementsForField(field);

            if (!rows[fieldRow])
                rows[fieldRow] = div({ class: "mb-4 flex space-x-4" });

            van.add(rows[fieldRow], fieldElements);
        }

        rows.push(
            div(
                { class: "flex justify-center items-center mt-8" },
                button({ name: `${this.collection}FormSubmit` }, "Submit")
            )
        );

        van.add(
            parentElement,
            div(
                { class: "flex justify-center items-center mt-8" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
                    },
                    rows
                )
            )
        );
    }
}

class List {
    constructor(collection, fields) {
        this.collection = collection;
        this.fields = fields;
        this.db = new Database();
    }

    getElementsForField(field) {
        const { label, span, div } = van.tags;

        const fieldName = field.name;
        const fieldId = field.id || `${fieldName}Text`;
        const fieldDisplayName = field.displayName || fieldName;
        const containerClass = field.containerClass || "w-full";

        return div(
            { class: containerClass },
            label(
                {
                    for: fieldId,
                    class: "block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2",
                },
                fieldDisplayName
            ),
            span({
                id: fieldId,
                class: "w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 leading-tight",
            })
        );
    }

    addElements(parentElement) {
        const { div } = van.tags;
        const { button } = rsv.tags;

        parentElement =
            parentElement ||
            document.getElementById("list-container") ||
            document.body;

        var rows = [];

        for (var i = 0; i < this.fields.length; i++) {
            const field = this.fields[i];
            const fieldRow = field.row || i;
            const fieldElements = this.getElementsForField(field);

            if (!rows[fieldRow])
                rows[fieldRow] = div({ class: "mb-4 flex space-x-4" });

            van.add(rows[fieldRow], fieldElements);
        }

        rows.push(
            div(
                { class: "flex justify-center items-center mt-8" },
                button({ name: `${this.collection}Add` }, "Add")
            )
        );

        van.add(
            parentElement,
            div(
                { class: "flex justify-center items-center mt-8" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
                    },
                    rows
                )
            )
        );
    }

    async getItems() {
        return await this.db.query(this.collection);
    }
}

let database = new Database();

// let firestore = getFirestore(app);

if (typeof window !== "undefined") {
    window._vy_database = database;
}

export { Form as F, List as L, database as d };
//# sourceMappingURL=db-CZWnBXOD.js.map
