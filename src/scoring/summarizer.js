import { database } from "../data/db.js";
import { storage } from "../data/storage.js";
// import { app } from "../data/firebase.js";
// import {
//     getStorage,
//     ref,
//     uploadString,
//     getDownloadURL,
// } from "firebase/storage";

import { progress } from "../viz/progress.js";
import { eventBus } from "../eventbus.js";
import { Score } from "./scoring.js";
import { activeBoxManager } from "./activeBoxManager.js";
import { events } from "../data/events.js";

class Summarizer {
    constructor() {
        this.currentCamera = 1;
        this.summaries = [];

        eventBus.addEventListener("ui.requestSummaryRebuild", async (e) => {
            const { hierarchy } = e.detail;
            await this.rebuild(hierarchy);
        });

        eventBus.addEventListener("ui.requestSummaryRebuildAll", async (e) => {
            await this.rebuildAll();
        });

        eventBus.addEventListener("viz.cameraChanged", (e) => {
            this.currentCamera = e.detail.camera;
        });
    }

    getCurrent() {
        return this.summaries[this.currentCamera - 1];
    }

    getAll() {
        return this.summaries;
    }

    async rebuildAll() {
        const allEvents = await events.getAvailableEvents();
        for (const event of allEvents) {
            const { hierarchy } = event;
            const parts = hierarchy.split(":");

            for (let i = 1; i <= 5; i++) {
                const camera = i.toString().padStart(2, "0");
                const h = `${parts[0]}-${parts[1]}-${camera}`;
                await this.rebuild(h);
            }
        }
    }

    async rebuild(hierarchy) {
        let summary = await this.create(hierarchy);
        await this.saveToFirestore(hierarchy, summary);
        await this.saveToStorage(hierarchy, summary);
        return summary;
    }

    async create(hierarchy) {
        // Initialize a new scoring instance
        var scoring = new Score();

        // Load fragments and initalize the schedule
        let fragments = await scoring.getFragments(hierarchy);
        await scoring.initLoadSchedule(fragments);

        scoring.resetWindow();
        let scores = {};

        console.log("Creating summary...");
        var { closed, pct } = progress.show("Creating summary...");

        // Run through the fragments as if the video was playing 0.25 seconds
        // at a time.
        for (let i = 0; i < fragments.length; i++) {
            const fragment = fragments[i];
            pct.val = (i / fragments.length) * 100;

            for (let dt = 0; dt < fragment.duration; dt += 0.25) {
                // Update the scoring engine to this time
                const newTime = fragment.start + dt;
                const second = Math.floor(newTime);
                await scoring.handleTimeUpdate(newTime);

                // Get or initialize the score accumulator for this second
                const score = (scores[second] = scores[second] || {
                    startTime: 99999999,
                    endTime: 0,
                    score: 0,
                    count: 0,
                    people: 0,
                });

                // Accumulate the score
                score.startTime = Math.min(score.startTime, newTime);
                score.endTime = Math.max(score.endTime, newTime);
                score.score += scoring.currentScore;
                score.people += activeBoxManager.activeBoxes.length;
                score.count += 1;
            }
        }

        // Compute averages and format times
        for (const second in scores) {
            const score = scores[second];
            score.score = Math.round(score.score / score.count);
            score.people = Math.round(score.people / score.count);
            score.startTime = score.startTime.toFixed(2);
            score.endTime = score.endTime.toFixed(2);
        }

        closed.val = true;

        return Object.values(scores);
    }

    // checkPeople(summary) {
    //     let lastScore = summary[0];
    //     for (const score of summary) {
    //         const delta = Math.abs(lastScore.people - score.people);
    //         if (delta / lastScore.people > 0.5) {
    //             console.log(lastScore, score);
    //         }
    //         lastScore = score;
    //     }
    // }

    getUrl(token, date, camera) {
        const urlPrefix = "https://storage.roarscore.ai/production/play/";
        // Make sure camera is zero padded two digits
        camera = parseInt(camera).toString().padStart(2, "0");

        return (
            `${urlPrefix}${token}/${date}/${camera}/` +
            `summary-${token}-${date}-${camera}.json`
        );
    }

    async loadFromUrl(url) {
        console.log(`Loading summary ${url}..`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error loading ${url}: ${response.statusText}`);
            return [];
        }
        const rows = await response.json();

        for (const row of rows) {
            row.startTime = parseFloat(row.startTime);
            row.endTime = parseFloat(row.endTime);
        }

        return rows;
    }

    async loadAllFromUrl(hierarchy, cameras = 5) {
        console.log(`Loading summaries for ${hierarchy}...`);
        this.summaries = [];

        const [token, date] = hierarchy.split("-");
        for (let camera = 1; camera <= cameras; camera++) {
            const url = this.getSummaryUrl(token, date, camera);
            this.summaries.push(await this.loadSummary(url));
        }
    }

    async loadFromStorage(hierarchy) {
        let [token, date, camera] = hierarchy.split("-");
        let path = `summaries/${token}/${date}/summary-${token}-${date}-${camera}.json`;

        try {
            // let storage = getStorage(app);
            // let storageRef = ref(storage, path);
            // let url = await getDownloadURL(storageRef);
            console.log(`Loading summary from storage: ${hierarchy}...`);
            let url = await storage.getDownloadUrl(path);

            return await this.loadFromUrl(url);
        } catch (error) {
            console.error(`Error loading from storage: ${error}`);
            return null;
        }
    }

    async saveToStorage(hierarchy, summary) {
        let [token, date, camera] = hierarchy.split("-");
        let path = `summaries/${token}/${date}/summary-${token}-${date}-${camera}.json`;

        console.log(`Saving summary to storage: ${path}...`);

        //let storage = getStorage(app);
        // let storageRef = ref(storage, path);
        // await uploadString(storageRef, JSON.stringify(summary));

        await storage.uploadString(path, JSON.stringify(summary));

        console.log(`Saved summary to storage.`);
    }

    async saveToFirestore(hierarchy, summary) {
        var { closed, pct } = progress.show("Saving summary...");
        console.log(`Saving summary to firestore: ${hierarchy}...`);

        const batchSize = 1000;
        for (let i = 0; i < summary.length; i += batchSize) {
            pct.val = (i / summary.length) * 100;

            const key = `${hierarchy}-${i.toString().padStart(5, "0")}`;
            const rows = summary.slice(i, i + batchSize);
            const data = {
                id: key,
                hierarchy: hierarchy,
                offset: i,
                rows: rows,
            };

            console.log("Saving summary batch:", key, rows.length, "rows");
            await database.set("summaries", data);
            //const docRef = doc(firestore, "summaries", key);
            //await setDoc(docRef, data);
        }

        closed.val = true;
        console.log(`Saved summary to firestore.`);
    }

    async loadFromFirestore(hierarchy) {
        let result = [];
        let batches = [];

        // Get summaries by hierarchy
        //const summariesRef = collection(firestore, "summaries");
        //const q = query(summariesRef, where("hierarchy", "==", hierarchy));
        //const snap = await getDocs(q);
        console.log(`Loading summary from firestore: ${hierarchy}...`);
        const rows = await database.query("summaries", {
            hierarchy: hierarchy,
        });

        // Ensure they're sorted by offset
        rows.forEach((data) => {
            batches.push(data);
        });
        batches.sort((a, b) => a.offset - b.offset);

        // Splice into the result
        for (const batch of batches) {
            for (const row of batch.rows) {
                row.startTime = parseFloat(row.startTime);
                row.endTime = parseFloat(row.endTime);
            }
            result.splice(batch.offset, 0, ...batch.rows);
        }

        return result;
    }

    async ensure(hierarchy, cameras = 5) {
        const [token, date] = hierarchy.split("-");

        console.log(`Ensuring summaries for ${token}-${date}...`);

        var { closed, pct } = progress.show("Loading summaries..");

        this.summaries = [];
        for (let camera = 1; camera <= cameras; camera++) {
            camera = parseInt(camera).toString().padStart(2, "0");
            const h = `${token}-${date}-${camera}`;

            console.log(`Loading ${h} from storage...`);
            let summary = await this.loadFromStorage(h);

            if (!summary || !summary.length) {
                console.log(`Loading ${h} from firestore..`);
                summary = await this.loadFromFirestore(h);
                await this.saveToStorage(h, summary);
            }

            if (!summary || !summary.length) {
                console.warn(
                    `SUMMARY ${h} MISSING.  CREATING.  THIS WILL TAKE AWHILE...`
                );

                summary = await this.create(hierarchy);
                await this.saveToFirestore(h, summary);
                await this.saveToStorage(h, summary);
            }

            pct.val = (camera / cameras) * 100;
            this.summaries.push(summary);
        }

        closed.val = true;

        eventBus.fire("summarizer.ready");

        return this.summaries;
    }
}

const summarizer = new Summarizer();
export default summarizer;
export { summarizer, Summarizer };
