import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.5.min.js";
import { firestore, doc, getDoc } from "/js/rsdb.js";
import { Modal } from "https://cdn.jsdelivr.net/npm/vanjs-ui@0.11.12/+esm";

const Box = Object.freeze({
    X: 0,
    Y: 1,
    W: 2,
    H: 3,
    SCORE: 4,
    COUNT: 5,
});

const ActiveBox = Object.freeze({
    X: 0,
    Y: 1,
    W: 2,
    H: 3,
    SCORE: 4,
    EXPIRES: 5,
});

const Core = Object.freeze({
    ANGER: 0,
    DISGUST: 1,
    FEAR: 2,
    HAPPINESS: 3,
    SADNESS: 4,
    SURPRISE: 5,
    NEUTRAL: 6,
});

const EmotionCoreMap = Object.freeze({
    Anger: Core.ANGER,
    Guilt: Core.DISGUST,
    Annoyance: Core.DISGUST,
    Contempt: Core.DISGUST,
    Disapproval: Core.DISGUST,
    Disgust: Core.DISGUST,
    Shame: Core.DISGUST,
    Anxiety: Core.FEAR,
    Awkwardness: Core.FEAR,
    Distress: Core.FEAR,
    Doubt: Core.FEAR,
    Envy: Core.FEAR,
    Fear: Core.FEAR,
    Horror: Core.FEAR,
    Admiration: Core.HAPPINESS,
    Adoration: Core.HAPPINESS,
    "Aesthetic Appreciation": Core.HAPPINESS,
    Amusement: Core.HAPPINESS,
    Contentment: Core.HAPPINESS,
    Craving: Core.HAPPINESS,
    Desire: Core.HAPPINESS,
    Determination: Core.HAPPINESS,
    Ecstasy: Core.HAPPINESS,
    Enthusiasm: Core.HAPPINESS,
    Entrancement: Core.HAPPINESS,
    Excitement: Core.HAPPINESS,
    Gratitude: Core.HAPPINESS,
    Interest: Core.HAPPINESS,
    Joy: Core.HAPPINESS,
    Love: Core.HAPPINESS,
    Nostalgia: Core.HAPPINESS,
    Pride: Core.HAPPINESS,
    Romance: Core.HAPPINESS,
    Sarcasm: Core.HAPPINESS,
    Satisfaction: Core.HAPPINESS,
    Triumph: Core.HAPPINESS,
    Boredom: Core.NEUTRAL,
    Calmness: Core.NEUTRAL,
    Concentration: Core.HAPPINESS,
    Contemplation: Core.NEUTRAL,
    Tiredness: Core.NEUTRAL,
    Disappointment: Core.SADNESS,
    "Empathic Pain": Core.SADNESS,
    Pain: Core.SADNESS,
    Sadness: Core.SADNESS,
    Sympathy: Core.SADNESS,
    Awe: Core.SURPRISE,
    Confusion: Core.SURPRISE,
    Embarrassment: Core.SURPRISE,
    Realization: Core.SURPRISE,
    Relief: Core.SURPRISE,
    "Surprise (negative)": Core.SURPRISE,
    "Surprise (positive)": Core.SURPRISE,
});

class Score {
    constructor() {
        this.expressionsUrl = null;
        this.profile = {};

        this.windowSize = 10;
        this.window = [];
        this.windowStartIndex = 0;
        this.windowEndIndex = 0;
        this.windowScore = 0;
        this.windowCores = new Int32Array(7);
        this.windowBoxes = [];

        //this.seconds = {};
        //this.second = null;
        this.currentTime = null;
        this.lastTime = null;
        this.currentSecond = null;
        this.lastSecond = null;
        this.activeBoxes = [];
        this.currentScore = 0;
        this.currentCores = [0, 0, 0, 0, 0, 0, 0];
    }

    showProgress(message = "Loading...") {
        const { h3, div, button, progress } = van.tags;
        const pct = van.state(0);
        const closed = van.state(false);
        van.add(
            document.body,
            Modal(
                {
                    closed,
                    backgroundStyleOverrides: {
                        "align-items": "flex-start", // Align to top instead of center
                        "padding-top": "20vh", // Add some padding from the top
                    },
                },
                div(
                    { class: "p-4 w-80" },
                    h3({ class: "text-black" }, message),
                    progress({
                        id: "loading-progress",
                        class: "w-full h-4 mt-2",
                        value: pct,
                        max: 100,
                    })
                )
            )
        );
        return { closed, pct };
    }

    async loadProfile(profileId) {
        /**
         * Load a profile by its ID.
         * @param {string} profileId - The ID of the profile to load.
         */

        var docRef = doc(firestore, "profiles", profileId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log("Profile loaded:", docSnap.data());
            this.profile = docSnap.data();
            return this.profile;
        } else {
            console.error("No profile found with ID:", profileId);
            return null;
        }
    }

    async loadExpressions(url, timeOffset = 0.0) {
        /**
         * Load expressions from a given URL.
         * @param {string} url - The URL to fetch expressions from.
         */

        var profile = (this.profile && this.profile.emotions) || {};

        //console.log(`Loading ${url} with time offset ${timeOffset}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error loaindg ${url}: ${response.statusText}`);
            return [];
        }
        const rows = await response.json();

        if (!rows || rows.length == 0) {
            console.error(`Error ${url} is empty`);
            return [];
        }

        for (const row of rows) {
            row.score = 0;
            row.cores = this.convertEmotionsToCores(row.emotions);
            row.score = row.cores.reduce((sum, c) => sum + c, 0) / 7;
            row.time += timeOffset;

            // for (var emotion of row.emotions) {
            //     if (emotion.name in profile) {
            //         row.score += emotion.score * profile[emotion.name];
            //     } else {
            //         console.warn(`Emotion ${emotion.name} not in profile`);
            //         row.score += emotion.score;
            //     }
            // }

            // row.score = row.score / row.emotions.length;
            // row.vyScore = Math.floor(row.score * 1000);
            // row.time += timeOffset;

            //this.expressions.push(row);
            //this.groupData(row);
        }

        return rows;
        //return this.expressions;
    }

    async loadWindow(url, timeOffset = 0.0) {
        this.window = await this.loadExpressions(url, timeOffset);
        this.windowStartIndex = 0;
        this.windowEndIndex = 0;
        this.windowScore = 0;
        this.windowCores.fill(0);
        this.windowBoxes = [];
    }

    async handleFragChanged(url, initUrl, timeOffset) {
        const expressionsUrl = initUrl
            .replace(/playback-/, "expressions-")
            .replace(/-\w+-init.mp4$/, ".json");

        console.log(`${expressionsUrl} ${timeOffset}`);

        if (this.expressionsUrl !== expressionsUrl) {
            this.expressionsUrl = expressionsUrl;
            console.log(`Loading window for time offset ${timeOffset}`);
            await this.loadWindow(this.expressionsUrl, timeOffset);
        }
    }

    async loadExpressionsFromFragments(fragments) {
        /**
         * Load expressions from HLS fragments.
         * @param {Array} fragments - The array of HLS fragments.
         */
        this.seconds = {};
        var initUrl = null;
        var promises = [];
        var { closed, pct } = this.showProgress("Loading expressions...");
        var done = 0;

        var initSegments = new Set();
        fragments.forEach((fragment) => {
            initSegments.add(fragment.initSegment?.url);
        });
        var total = initSegments.size;

        for (const fragment of fragments) {
            if (fragment.initSegment?.url != initUrl) {
                initUrl = fragment.initSegment.url;
                const expressionsUrl = initUrl
                    .replace(/playback-/, "expressions-")
                    .replace(/-\w+-init.mp4$/, ".json");

                promises.push(
                    this.loadExpressions(
                        expressionsUrl,
                        fragment.playlistOffset
                    )
                );

                if (promises.length > 5) {
                    await Promise.all(promises);
                    done += promises.length;
                    pct.val = Math.floor((done / total) * 100);
                    promises = [];
                }
            }
        }

        await Promise.all(promises);
        closed.val = true;
    }

    boxesAreSame(box1, box2, threshold = 0.6) {
        /**
         * Check if two boxes are the same within a threshold.
         * @param {Object} box1 - The first box object.
         * @param {Object} box2 - The second box object.
         * @param {number} threshold - The similarity threshold.
         * @returns {boolean} - True if boxes are similar, false otherwise.
         */
        //const [x1, y1, w1, h1] = [box1.x, box1.y, box1.w, box1.h];
        //const [x2, y2, w2, h2] = [box2.x, box2.y, box2.w, box2.h];
        const [x1, y1, w1, h1] = box1;
        const [x2, y2, w2, h2] = box2;

        // Calculate intersection coordinates
        const xi1 = Math.max(x1, x2);
        const yi1 = Math.max(y1, y2);
        const xi2 = Math.min(x1 + w1, x2 + w2);
        const yi2 = Math.min(y1 + h1, y2 + h2);
        const interWidth = Math.max(0, xi2 - xi1);
        const interHeight = Math.max(0, yi2 - yi1);
        const intersectionArea = interWidth * interHeight;

        const area1 = w1 * h1;
        const area2 = w2 * h2;
        const smallerArea = Math.min(area1, area2);

        // Avoid division by zero
        if (smallerArea === 0) return false;

        const overlapRatio = intersectionArea / smallerArea;
        return overlapRatio >= threshold;
    }

    convertEmotionsToCores(emotions) {
        var cores = new Int32Array(7);
        var counts = new Int32Array(7);

        for (var emotion of emotions) {
            var core = EmotionCoreMap[emotion.name];
            cores[core] += Math.floor(
                emotion.score * this.profile.emotions[emotion.name] * 1000
            );
            counts[core] += 1;
        }

        for (var i = 0; i < cores.length; i++) {
            if (counts[i] > 0) {
                cores[i] /= counts[i];
            }
        }

        return cores;
    }

    // groupData(row) {
    //     var cores = this.convertEmotionsToCores(row.emotions);
    //     var s = Math.round(row.time);

    //     // Initialize the second if needed
    //     if (!(s in this.seconds)) {
    //         this.seconds[s] = {
    //             score: 0,
    //             count: 0,
    //             cores: new Int32Array(7),
    //             boxes: [],
    //         };
    //     }
    //     var second = this.seconds[s];

    //     // Add the score
    //     second.score += row.vyScore;
    //     second.count++;

    //     // Add the cores
    //     for (var i = 0; i < 7; i++) {
    //         second.cores[i] += cores[i];
    //     }

    //     // Create the box from the row
    //     var box = new Int32Array([
    //         Math.floor(row.box.x),
    //         Math.floor(row.box.y),
    //         Math.floor(row.box.w),
    //         Math.floor(row.box.h),
    //         row.vyScore,
    //         1,
    //     ]);

    //     // If it's the same box update it, otherwise add it
    //     var targetBox = second.boxes.find((b) => this.boxesAreSame(b, box));

    //     // Update it
    //     if (targetBox) {
    //         // Update x,y,w,h to latest values
    //         // (assuming we're moving forward in time)
    //         targetBox.set(box.subarray(0, 4), 0);
    //         targetBox[4] += box[4];
    //         targetBox[5] += 1;
    //     }
    //     // Add it
    //     else {
    //         second.boxes.push(box);
    //     }
    // }

    // async persistData(dbName) {
    //     /**
    //      * Saves the grouped data in this.seconds to IndexedDB
    //      */
    //     try {
    //         const db = await this.openDatabase(dbName);
    //         const records = this.convertSecondsToRecords();
    //         await this.saveRecordsToDatabase(db, records);
    //         db.close();
    //         console.log(
    //             `Persisted ${records.length} seconds of data to ${dbName}`
    //         );
    //     } catch (error) {
    //         console.error("Error persisting data:", error);
    //         throw error;
    //     }
    // }

    // async clearPersistedData(dbName) {
    //     try {
    //         const db = await this.openDatabase(dbName);
    //         await this.clearRecordsInDatabase(db);
    //         console.log(`Cleared database ${dbName}.`);
    //     } catch (error) {
    //         console.error("Error persisting data:", error);
    //         throw error;
    //     }
    // }

    // openDatabase(dbName) {
    //     /**
    //      * Opens IndexedDB database and sets up object store if needed
    //      */
    //     return new Promise((resolve, reject) => {
    //         const request = indexedDB.open(dbName, 1);

    //         request.onerror = () => reject(request.error);

    //         request.onupgradeneeded = (event) => {
    //             const db = event.target.result;
    //             this.setupObjectStore(db);
    //         };

    //         request.onsuccess = (event) => {
    //             resolve(event.target.result);
    //         };
    //     });
    // }

    // setupObjectStore(db) {
    //     /**
    //      * Creates object store and indexes if they don't exist
    //      */
    //     if (!db.objectStoreNames.contains("scores")) {
    //         const store = db.createObjectStore("scores", { keyPath: "time" });
    //         store.createIndex("timeIndex", "time", { unique: true });
    //         store.createIndex("scoreIndex", "score", { unique: false });
    //     }
    // }

    // convertSecondsToRecords() {
    //     /**
    //      * Converts this.seconds data structure to IndexedDB-friendly records
    //      */
    //     return Object.entries(this.seconds).map(([time, data]) => ({
    //         time: parseInt(time),
    //         score: data.score,
    //         count: data.count,
    //         cores: Array.from(data.cores),
    //         boxes: data.boxes.map((box) => Array.from(box)),
    //     }));
    // }

    // clearRecordsInDatabase(db) {
    //     return new Promise((resolve, reject) => {
    //         const transaction = db.transaction(["scores"], "readwrite");
    //         const store = transaction.objectStore("scores");

    //         // Clear existing data first
    //         const clearRequest = store.clear();

    //         clearRequest.onsuccess = () => {
    //             resolve();
    //         };

    //         clearRequest.onerror = () => {
    //             reject(clearRequest.error);
    //         };
    //     });
    // }

    // saveRecordsToDatabase(db, records) {
    //     /**
    //      * Saves records to the database after clearing existing data
    //      */
    //     return new Promise((resolve, reject) => {
    //         const transaction = db.transaction(["scores"], "readwrite");
    //         const store = transaction.objectStore("scores");

    //         // Clear existing data first
    //         const clearRequest = store.clear();

    //         clearRequest.onsuccess = () => {
    //             this.addRecordsToStore(store, records, resolve, reject);
    //         };

    //         clearRequest.onerror = () => {
    //             reject(clearRequest.error);
    //         };
    //     });
    // }

    // addRecordsToStore(store, records, resolve, reject) {
    //     /**
    //      * Adds all records to the object store
    //      */
    //     if (records.length === 0) {
    //         resolve();
    //         return;
    //     }

    //     let completed = 0;
    //     const total = records.length;

    //     records.forEach((record) => {
    //         const addRequest = store.add(record);

    //         addRequest.onsuccess = () => {
    //             completed++;
    //             if (completed === total) {
    //                 resolve();
    //             }
    //         };

    //         addRequest.onerror = () => {
    //             reject(addRequest.error);
    //         };
    //     });
    // }

    // async databaseExists(dbName) {
    //     /**
    //      * Check if a specific IndexedDB database exists
    //      */
    //     try {
    //         const databases = await indexedDB.databases();
    //         return databases.some((db) => db.name === dbName);
    //     } catch (error) {
    //         console.error("Error checking database existence:", error);
    //         return false;
    //     }
    // }

    // // Companion method to load data back
    // async loadPersistedData(dbName) {
    //     /**
    //      * Loads grouped data from IndexedDB back into this.seconds
    //      */
    //     try {
    //         if (!(await this.databaseExists(dbName))) {
    //             console.log(`Database ${dbName} does not exist.`);
    //             return false;
    //         }
    //         const db = await this.openDatabase(dbName);
    //         const records = await this.loadRecordsFromDatabase(db);
    //         this.convertRecordsToSeconds(records);
    //         db.close();
    //         console.log(
    //             `Loaded ${records.length} seconds of data from ${dbName}`
    //         );
    //         return records.length;
    //     } catch (error) {
    //         console.error("Error loading data:", error);
    //         throw error;
    //     }
    // }

    // loadRecordsFromDatabase(db) {
    //     /**
    //      * Loads all records from the database
    //      */
    //     return new Promise((resolve, reject) => {
    //         if (!db.objectStoreNames.contains("scores")) {
    //             resolve([]);
    //             return;
    //         }

    //         const transaction = db.transaction(["scores"], "readonly");
    //         const store = transaction.objectStore("scores");
    //         const getAllRequest = store.getAll();

    //         getAllRequest.onsuccess = () => resolve(getAllRequest.result);
    //         getAllRequest.onerror = () => reject(getAllRequest.error);
    //     });
    // }

    // convertRecordsToSeconds(records) {
    //     /**
    //      * Converts records back to this.seconds format
    //      */
    //     this.seconds = {};

    //     records.forEach((record) => {
    //         this.seconds[record.time] = {
    //             score: record.score, // Convert back to sum
    //             count: record.count,
    //             cores: new Int32Array(record.cores),
    //             boxes: record.boxes.map((box) => new Int32Array(box)),
    //         };
    //     });
    // }

    // checkForGaps() {
    //     var lastTime = 0;
    //     var gaps = 0;
    //     var seconds = Object.keys(this.seconds).map((k) => parseInt(k));
    //     seconds.sort((a, b) => a - b);

    //     var first = seconds[0];
    //     var last = seconds[seconds.length - 1];

    //     var time = (last - first) / 3600.0;

    //     console.log(`Seconds ${first}-${last} = ${time}h.`);

    //     for (var s of seconds) {
    //         if (s - lastTime > 1) {
    //             gaps += 1;
    //             console.warn(
    //                 `Gap of ${s - lastTime} from t=${lastTime}-${s} (${
    //                     lastTime / 3600.0
    //                 }h)`
    //             );
    //         }
    //         lastTime = s;
    //     }

    //     if (gaps > 0) {
    //         console.error(`There are ${gaps} gaps in the data.`);
    //     }
    // }

    moveWindow() {
        /** Moves windowStartIndex and windowEndIndex such that
         * the windowEndIndex is at the current time and the windowStartIndex
         * is at the current time minus the window size.
         */
        while (
            this.windowEndIndex < this.window.length &&
            this.window[this.windowEndIndex].time <= this.currentTime
        ) {
            const row = this.window[this.windowEndIndex];
            this.windowScore += row.score;
            for (let i = 0; i < 7; i++) {
                this.windowCores[i] += row.cores[i];
            }
            this.windowBoxes.push(
                new Int32Array([
                    row.box.x,
                    row.box.y,
                    row.box.w,
                    row.box.h,
                    row.score,
                    1,
                ])
            );

            this.windowEndIndex++;
        }
        while (
            this.windowStartIndex < this.windowEndIndex &&
            this.window[this.windowStartIndex].time <
                this.currentTime - this.windowSize
        ) {
            const row = this.window[this.windowStartIndex];
            this.windowScore -= row.score;
            for (let i = 0; i < 7; i++) {
                this.windowCores[i] -= row.cores[i];
            }
            this.windowBoxes.shift(); // Remove the first box in the window
            this.windowStartIndex++;
        }

        console.log(
            `Window moved to ${this.windowStartIndex}-${this.windowEndIndex}/${this.window.length} for time ${this.currentTime}`
        );
    }

    updateCurrentFromWindow() {
        this.moveWindow();

        const count = this.windowEndIndex - this.windowStartIndex;
        if (count > 0) {
            this.currentScore = this.windowScore / count;
            this.currentCores = Array.from(this.windowCores).map(
                (c) => c / count
            );
        } else {
            this.currentScore = 0;
            this.currentCores.fill(0);
        }

        this.updateActiveBoxes(this.windowBoxes);
    }

    updateCurrentFromSeconds() {
        this.second = this.seconds[this.currentSecond];
        if (this.second) {
            this.currentScore = this.second.score / this.second.count;
            this.currentCores = this.second.cores.map((c) =>
                this.second.count > 0 ? c / this.second.count : 0
            );
        }

        if (this.currentSecond !== this.lastSecond) {
            this.second = this.seconds[this.currentSecond];
            this.updateActiveBoxes(this.second.boxes);
        }
    }

    handleTimeUpdate(newTime) {
        this.lastTime = this.currentTime;
        this.currentTime = newTime;
        this.lastSecond = this.currentSecond;
        this.currentSecond = Math.floor(this.currentTime);

        this.updateCurrentFromWindow();

        this.expireActiveBoxes();
    }

    handleTimeSeek(currentTime) {
        this.resetActiveBoxes();
        this.currentTime = null;
        this.currentSecond = null;
        this.currentScore = 0;
        this.currentCores = [0, 0, 0, 0, 0, 0, 0];
        this.handleTimeUpdate(currentTime);
    }

    resetActiveBoxes() {
        /**
         * Resets the active boxes to an empty array.
         */
        this.activeBoxes = [];
    }

    expireActiveBoxes() {
        /**
         * Expires boxes from activeBoxes that have not been updated in 10 seconds.
         */
        for (let i = this.activeBoxes.length - 1; i >= 0; i--) {
            const activeBox = this.activeBoxes[i];
            const dt = Math.floor((this.currentTime - this.lastTime) * 1000);
            activeBox[ActiveBox.EXPIRES] -= dt;
            if (activeBox[ActiveBox.EXPIRES] <= 0) {
                this.activeBoxes.splice(i, 1); // Remove expired box
            }
        }
    }

    updateActiveBoxes(boxes) {
        /**
         * Updates the active boxes based on the current second,
         * adds any non-overlapping boxes to activeBoxes.
         */

        for (const box of boxes) {
            // Check if the box is already active
            var activeBox = this.activeBoxes.find((activeBox) => {
                if (this.boxesAreSame(activeBox, box)) {
                    return activeBox;
                }
            });

            if (activeBox) {
                activeBox[ActiveBox.SCORE] = box[Box.SCORE] / box[Box.COUNT];
                activeBox[ActiveBox.EXPIRES] = 10000; // Update the expiration time
            } else {
                // If not active, create it and add it to activeBoxes
                // Ensure score is averaged because we're reusing the count
                activeBox = new Int32Array(box);
                activeBox[ActiveBox.SCORE] = box[Box.SCORE] / box[Box.COUNT];
                activeBox[ActiveBox.EXPIRES] = 10000;

                this.activeBoxes.push(activeBox);
            }
        }
    }
}

export default Score;
