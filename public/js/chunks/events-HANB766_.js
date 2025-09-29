import { v as van } from "./van-t8DywzvC.js";
import { d as database } from "./db-BXXpex-M.js";
import { e as eventBus } from "./eventbus-DzIYHcTJ.js";
import { a as app } from "./firebase-DTGT__LK.js";

// Initialize Firebase storage functions based on environment
let storageFunctions;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
    console.log("Using Admin Storage SDK...");
    storageFunctions = global._vy_storage_functions;
} else {
    console.log("Importing Client Storage SDK...");
    storageFunctions = await import("./index.esm-TgEmmvED.js");
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

if (typeof window !== "undefined") {
    window._vy_storage = storage;
}

// Quote all tag names so that they're not mangled by minifier
const {
    button: button,
    div: div,
    header: header,
    input: input,
    label: label,
    span: span,
    style: style,
} = van.tags;
const toStyleStr = (style) =>
    Object.entries(style)
        .map(([k, v]) => `${k}: ${v};`)
        .join("");
const Modal = (
    {
        closed,
        backgroundColor = "rgba(0,0,0,.5)",
        blurBackground = false,
        clickBackgroundToClose = false,
        backgroundClass = "",
        backgroundStyleOverrides = {},
        modalClass = "",
        modalStyleOverrides = {},
    },
    ...children
) => {
    const backgroundStyle = {
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        position: "fixed",
        "z-index": 10000,
        "background-color": backgroundColor,
        "backdrop-filter": blurBackground ? "blur(0.25rem)" : "none",
        ...backgroundStyleOverrides,
    };
    const modalStyle = {
        "border-radius": "0.5rem",
        padding: "1rem",
        display: "block",
        "background-color": "white",
        ...modalStyleOverrides,
    };
    document.activeElement instanceof HTMLElement &&
        document.activeElement.blur();
    return () => {
        if (closed.val) return null;
        const bgDom = div(
            { class: backgroundClass, style: toStyleStr(backgroundStyle) },
            div({ class: modalClass, style: toStyleStr(modalStyle) }, children)
        );
        clickBackgroundToClose &&
            bgDom.addEventListener(
                "click",
                (e) => e.target === bgDom && (closed.val = true)
            );
        return bgDom;
    };
};

class Progress {
    constructor() {}

    show(message = "Loading...") {
        const { h3, div, progress } = van.tags;
        let pct = van.state(0);
        let closed = van.state(false);
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
}

const progress = new Progress();

class Geometry {
    boxesAreSame(box1, box2, threshold = 0.4) {
        /**
         * Check if two boxes are the same within a threshold.
         * @param {Object} box1 - The first box object.
         * @param {Object} box2 - The second box object.
         * @param {number} threshold - The similarity threshold.
         * @returns {boolean} - True if boxes are similar, false otherwise.
         */
        const [x1, y1, w1, h1] = [box1.x, box1.y, box1.w, box1.h];
        const [x2, y2, w2, h2] = [box2.x, box2.y, box2.w, box2.h];

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

    isPointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
        const area = (x1, y1, x2, y2, x3, y3) =>
            0.5 * Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

        const A = area(x1, y1, x2, y2, x3, y3);
        const A1 = area(px, py, x2, y2, x3, y3);
        const A2 = area(x1, y1, px, py, x3, y3);
        const A3 = area(x1, y1, x2, y2, px, py);

        return A === A1 + A2 + A3;
    }

    findTriangleContainingPoint(x, y, triangles) {
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];
            const [x1, y1, x2, y2, x3, y3] = triangle;
            if (this.isPointInTriangle(x, y, x1, y1, x2, y2, x3, y3)) {
                return i + 1; // Return 1-based index
            }
        }
        return null; // No triangle found
    }
}

const geomUtil = new Geometry();

const EXPIRE_TIME = 5000;

class ActiveBoxManager {
    constructor() {
        this.activeBoxes = [];

        eventBus.addEventListener("scoring.timeUpdate", (e) => {
            this.expire(e.detail.elapsedMillis);
        });

        eventBus.addEventListener("scoring.timeSeek", (e) => {
            this.reset();
        });
    }

    reset() {
        /**
         * Resets the active boxes to an empty array.
         */
        this.activeBoxes = [];
    }

    expire(elapsedMillis) {
        /**
         * Expires boxes from activeBoxes that have not been updated in 10 seconds.
         */
        for (let i = this.activeBoxes.length - 1; i >= 0; i--) {
            const activeBox = this.activeBoxes[i];
            activeBox.expires -= elapsedMillis;
            if (activeBox.expires <= 0) {
                this.activeBoxes.splice(i, 1); // Remove expired box
            }
        }
    }

    update(boxes) {
        /**
         * Updates the active boxes based on the current second,
         * adds any non-overlapping boxes to activeBoxes.
         */

        for (const box of boxes) {
            // Check if the box is already active
            var activeBox = this.activeBoxes.find((activeBox) => {
                if (geomUtil.boxesAreSame(activeBox, box)) {
                    return activeBox;
                }
            });

            // If the box is already active, update it's position and reset
            // it's expire time.
            if (activeBox) {
                activeBox.x = box.x;
                activeBox.y = box.y;
                activeBox.w = box.w;
                activeBox.h = box.h;
                activeBox.score = box.score / box.count;
                activeBox.expires = EXPIRE_TIME;
                activeBox.index = box.index;
            }
            // If not active, create it and add it to activeBoxes
            // Ensure score is averaged because we're reusing the count
            else {
                activeBox = { ...box };
                activeBox.score = box.score / box.count;
                activeBox.expires = EXPIRE_TIME;
                activeBox.index = box.index;

                this.activeBoxes.push(activeBox);
            }
        }
    }

    getAt(x, y) {
        /**
         * Finds the first active box which contains the point (x, y).
         * @param {number} x - The x coordinate (scaled to original 4K).
         * @param {number} y - The y coordinate (scaled to original 4K).
         * @returns {Object|null}
         **/

        for (const box of this.activeBoxes) {
            if (
                x >= box.x &&
                x < box.x + box.w &&
                y >= box.y &&
                y < box.y + box.h
            ) {
                return box;
            }
        }

        return null;
    }

    get() {
        return this.activeBoxes;
    }
}

const activeBoxManager = new ActiveBoxManager();

const defaultProfileId = "BkBUQq4GiSfuwHN7YrK3";

class Profiles {
    constructor() {
        this.profile = null;
        this.getById(defaultProfileId);
    }

    async getById(id) {
        /**
         * Load a profile by its ID.
         * @param {string} profileId - The ID of the profile to load.
         */

        let profileData = await database.get("profiles", id);
        if (profileData) {
            this.profile = profileData;
            return this.profile;
        } else {
            console.error("No profile found with ID:", id);
            return null;
        }
    }
}

const profiles = new Profiles();

// const ActiveBox = Object.freeze({
//     X: 0,
//     Y: 1,
//     W: 2,
//     H: 3,
//     SCORE: 4,
//     EXPIRES: 5,
//     INDEX: 6, // Index in the original window array
// });

const Core = Object.freeze({
    ANGER: 0,
    DISGUST: 1,
    FEAR: 2,
    HAPPINESS: 3,
    SADNESS: 4,
    SURPRISE: 5,
    NEUTRAL: 6,
});

const CoreNames = Object.freeze([
    "Anger",
    "Disgust",
    "Fear",
    "Happiness",
    "Sadness",
    "Surprise",
    "Neutral",
]);

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

        this.windowSize = 3.0;
        this.window = [];
        this.windowStartIndex = 0;
        this.windowEndIndex = 0;
        this.windowScore = 0;
        this.windowBoxes = [];

        //this.seconds = {};
        //this.second = null;
        this.currentTime = null;
        this.lastTime = null;
        this.currentSecond = null;
        this.lastSecond = null;
        //this.activeBoxes = [];
        this.currentScore = 0;
        this.currentCores = [0, 0, 0, 0, 0, 0, 0];
        this.softmaxAlpha = 0.01; // controls how spiky per-row scoring is
        this.useRobustNormalization = false; // set true to normalize each fragment’s scores

        // UI squashing to keep scores in 0..1000
        this.applyUiSquash = false;
        this.uiMid = 500; // midpoint of the displayed scale
        this.uiSpread = 600; // controls steepness (larger => wider)
        this.uiClip = 2500; // clip raw score before squash

        this.dampenAlpha = 0.05;

        this.currentCamera = 0;
    }

    async loadExpressions(url, timeOffset = 0.0) {
        /**
         * Load expressions from a given URL.
         * @param {string} url - The URL to fetch expressions from.
         */

        var profile = (profiles.profile && profiles.profile.emotions) || {};

        //console.log(`Loading ${url} with time offset ${timeOffset}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error loading ${url}: ${response.statusText}`);
            return [];
        }
        const rows = await response.json();

        if (!rows || rows.length == 0) {
            console.error(`Error ${url} is empty`);
            return [];
        }

        for (const row of rows) {
            // row.cores = this.convertEmotionsToCores(row.emotions);
            //row.time += timeOffset;
            // TODO FIXME The times coming back from Hume are not correct
            // we're assuming 20 FPS video here, but that may not be the case.
            row.time = row.frame / 20 + timeOffset;

            this.computeRowScore(row, profile, this.softmaxAlpha);
        }

        if (this.useRobustNormalization) {
            this.normalizeRowScores(rows);
        }

        return rows;
        //return this.expressions;
    }

    computeRowScore(row, profile, alpha = 0.003) {
        /**
         * Softmax-weighted mean of signed emotion reactions for this row.
         * Higher-magnitude reactions get up-weighted smoothly.
         * Returns {score, count} where score is in roughly [-2000, 2000].
         */
        let acc = 0;
        let wsum = 0;
        let count = 0;

        row.cores = {};
        for (const emotion of row.emotions) {
            const weight = profile[emotion.name];
            if (typeof weight !== "number" || weight === 0) continue;

            // Signed reaction: detector score (0..1) times profile weight (can be ±) and scaled to ~0..±2000
            const r = emotion.score * weight * 1000;

            // Softmax weight by magnitude: raises the influence of stronger reactions
            const w = Math.exp(alpha * Math.abs(r));

            acc += w * r;
            wsum += w;
            count += 1;
            emotion.score = r;
            emotion.weight = w;

            emotion.coreName = CoreNames[EmotionCoreMap[emotion.name]];
            if (!(emotion.coreName in row.cores)) {
                row.cores[emotion.coreName] = {
                    score: 0,
                    count: 0,
                    wsum: 0,
                    acc: 0,
                };
            }

            const core = row.cores[emotion.coreName];
            core.acc += w * r;
            core.wsum += w;
            core.count += 1;
            core.score = core.acc / core.wsum;
        }

        const score = count ? acc / wsum : 0;
        row.score = score;
        row.count = count;
    }

    normalizeRowScores(rows, opts = {}) {
        /**
         * Optional two-pass robust normalization per fragment.
         * Centers by the median and scales by MAD so fragments are comparable.
         * Enabled by setting this.useRobustNormalization = true.
         */
        const targetStd = opts.targetStd ?? 350; // choose how wide typical rows should be after scaling
        const values = rows
            .map((r) => r.score)
            .filter((v) => Number.isFinite(v));
        if (values.length === 0) return;

        // median
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median =
            sorted.length % 2
                ? sorted[mid]
                : (sorted[mid - 1] + sorted[mid]) / 2;

        // MAD (median absolute deviation) -> robust sigma estimate ~ 1.4826*MAD
        const absdev = sorted
            .map((v) => Math.abs(v - median))
            .sort((a, b) => a - b);
        const mad = absdev[Math.floor(absdev.length / 2)] || 1;
        const sigma = 1.4826 * mad || 1;

        const k = targetStd / sigma;

        for (const r of rows) {
            // recenters to 0 and scales, then clamps to a sane range to avoid UI blowups
            r.score = this.clamp((r.score - median) * k, -2500, 2500);
        }
    }

    clamp(x, lo, hi) {
        return Math.min(hi, Math.max(lo, x));
    }

    async initLoadSchedule(fragments) {
        this.createLoadSchedule(fragments);
        this.loadScheduleIndex = 0;
        await this.loadWindowFromSchedule(this.loadScheduleIndex);
    }

    createLoadSchedule(fragments) {
        let current = null;

        this.loadSchedule = [];

        for (const frag of fragments) {
            const exprUrl = frag.initSegment.url.split("#")[1];
            if (current?.url != exprUrl) {
                current = {
                    url: exprUrl,
                    start: frag.start,
                    duration: frag.duration,
                };
                this.loadSchedule.push(current);
            } else {
                current.duration += frag.duration;
            }
        }
    }

    async checkLoadSchedule(fragments) {
        for (const sched of this.loadSchedule) {
            let expr = await this.loadExpressions(sched.url, sched.start);
            if (!expr || expr.length == 0) continue;

            let exprStartTime = expr[0].time;
            let exprOrigTime = expr[0].time - sched.start;
            let exprEndTime = expr[expr.length - 1].time;
            let exprDuration = exprEndTime - exprStartTime;

            if (Math.abs(exprStartTime - sched.start) > 1) {
                console.error(
                    `Schedule start ${
                        sched.start
                    }, Expressions start ${exprStartTime} ${exprOrigTime} (${
                        sched.start / 3600
                    })!`
                );
            }

            if (Math.abs(exprDuration - sched.duration) > 1) {
                console.error(
                    `Schedule duration ${sched.duration}, Expressions duration ${exprDuration}!`
                );
            }
        }
    }

    async loadWindow(url, timeOffset = 0.0) {
        var rows = await this.loadExpressions(url, timeOffset);
        this.window.push(...rows);
    }

    async loadWindowFromSchedule(scheduleIndex) {
        if (scheduleIndex < this.loadSchedule.length) {
            this.loadScheduleIndex = scheduleIndex;
            const sched = this.loadSchedule[scheduleIndex];

            console.log(
                `Loading from schedule ${scheduleIndex} ${sched.url} ${sched.start}`
            );

            await this.loadWindow(sched.url, sched.start);
        }
    }

    resetWindow() {
        this.window = [];
        this.windowStartIndex = 0;
        this.windowEndIndex = 0;
        this.windowScore = 0;
        this.windowBoxes = [];
    }

    async resetLoadSchedule(newTime) {
        for (let i = 0; i < this.loadSchedule.length; i++) {
            const sched = this.loadSchedule[i];

            if (
                newTime > sched.start &&
                newTime <= sched.start + sched.duration
            ) {
                console.log(`Schedule reset to ${i} for ${newTime}`);
                await this.loadWindowFromSchedule(i);

                return i;
            }
        }

        console.warning(`Schedule reset failed.`);
    }

    async handleTimeUpdate(newTime) {
        this.lastTime = this.currentTime;
        this.currentTime = newTime;
        this.lastSecond = this.currentSecond;
        this.currentSecond = Math.floor(this.currentTime);

        eventBus.fire("scoring.timeUpdate", {
            lastTime: this.lastTime,
            currentTime: this.currentTime,
            elapsed: this.currentTime - this.lastTime,
            elapsedMillis: (this.currentTime - this.lastTime) * 1000,
        });

        await this.ensureWindowLoaded();
        this.moveWindow();
        this.updateCurrentFromWindow();

        // TODO Move to event
        //this.expireActiveBoxes();
        //activeBoxManager.expire((this.currentTime - this.lastTime) * 1000);
    }

    async handleTimeSeek(currentTime) {
        this.resetWindow();

        this.currentTime = null;
        this.currentSecond = null;
        this.currentScore = 0;
        this.currentCores = [0, 0, 0, 0, 0, 0, 0];

        eventBus.fire("scoring.timeSeek", { currentTime: currentTime });

        await this.resetLoadSchedule(currentTime + 5);
        await this.handleTimeUpdate(currentTime);

        // TODO Move to event
        //activeBoxManager.reset();
        //this.resetActiveBoxes();
    }

    boxesAreSame(box1, box2, threshold = 0.4) {
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

    updatePercentiles() {
        const slice = this.window.slice(
            this.windowStartIndex,
            this.windowEndIndex
        );
        const sorted = slice.sort((a, b) => a.score - b.score);
        const pctWidth = sorted.length / 10.0;

        this.percentiles = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < sorted.length; i++) {
            let pct = Math.floor(i / pctWidth);
            this.percentiles[pct] += sorted[i].score;
            sorted[i].pct = pct;
        }

        for (let i = 0; i < 10; i++) {
            this.percentiles[i] /= pctWidth;
        }
    }

    checkWindowOnSchedule() {
        if (this.loadScheduleIndex >= this.loadSchedule.length) {
            return true; // We're out of schedule entries..
        }

        const loadLeadTime = this.currentTime + 5;
        const sched = this.loadSchedule[this.loadScheduleIndex];

        return (
            loadLeadTime > sched.start &&
            loadLeadTime <= sched.start + sched.duration
        );
    }

    async ensureWindowLoaded() {
        if (!this.checkWindowOnSchedule()) {
            this.loadScheduleIndex += 1;
            console.log(
                `Loading next window from schedule ${this.loadScheduleIndex}`
            );

            // We aren't awaiting this, fire and forget.
            await this.loadWindowFromSchedule(this.loadScheduleIndex);
        }
    }

    moveWindow() {
        /** Moves windowStartIndex and windowEndIndex such that
         * the windowEndIndex is at the current time and the windowStartIndex
         * is at the current time minus the window size.
         */

        let origStart = this.windowStartIndex;
        let origEnd = this.windowEndIndex;

        while (
            this.windowEndIndex < this.window.length &&
            this.window[this.windowEndIndex].time <= this.currentTime
        ) {
            const row = this.window[this.windowEndIndex];
            this.windowScore += row.score;
            // this.windowBoxes.push(
            //     new Int32Array([
            //         row.box.x,
            //         row.box.y,
            //         row.box.w,
            //         row.box.h,
            //         row.score,
            //         1,
            //         this.windowEndIndex,
            //     ])
            // );

            this.windowBoxes.push({
                x: row.box.x,
                y: row.box.y,
                w: row.box.w,
                h: row.box.h,
                score: row.score,
                count: 1,
                index: this.windowEndIndex,
            });

            this.windowEndIndex++;
        }
        while (
            this.windowStartIndex < this.windowEndIndex &&
            this.window[this.windowStartIndex].time <
                this.currentTime - this.windowSize
        ) {
            const row = this.window[this.windowStartIndex];
            this.windowScore -= row.score;
            this.windowBoxes.shift(); // Remove the first box in the window
            this.windowStartIndex++;
        }

        if (this.windowStartIndex > 25000) {
            this.window.splice(0, 24000);
            this.windowStartIndex -= 24000;
            this.windowEndIndex -= 24000;

            console.log(
                `Spliced window. ${this.window.length} ` +
                    `${origStart}=>${this.windowStartIndex} ` +
                    `${origEnd}=>${this.windowEndIndex}`
            );
        }

        // console.log(
        //     `${origStart}->${this.windowStartIndex}, ${origEnd}->${
        //         this.windowEndIndex
        //     } ${origEnd - origStart}=>${
        //         this.windowEndIndex - this.windowStartIndex
        //     }`
        // );
    }

    combineScores(scores) {
        if (scores.length == 0) {
            return 0;
        }

        // Softmax-weighted mean so spikes matter more than small reactions
        // Use a slightly lower alpha than per-row to avoid over-spikiness across many rows
        const level = this.softmaxMeanSigned(
            scores,
            Math.max(0.0005, this.softmaxAlpha * 0.5)
        );

        // Sublinear crowd scaling: lets bigger crowds move the needle more
        const scaled =
            level * this.sqrtCrowdScale(scores.length, 0.5) * this.dampenAlpha;

        let result = scaled;
        if (this.applyUiSquash) {
            result = this.squashToUi(result);
        }

        return result;
    }

    updateCurrentFromWindow() {
        const count = this.windowEndIndex - this.windowStartIndex;
        if (count > 0) {
            // Collect per-detection scores from the active window slice
            const scores = [];
            const cores = {
                Anger: [],
                Disgust: [],
                Fear: [],
                Happiness: [],
                Sadness: [],
                Surprise: [],
                Neutral: [],
            };

            for (let i = this.windowStartIndex; i < this.windowEndIndex; i++) {
                const row = this.window[i];
                scores.push(row.score);

                for (let coreName in row.cores) {
                    cores[coreName].push(row.cores[coreName].score);
                }
            }

            this.currentScore = this.combineScores(scores);

            this.currentCoresBeforeCombined = cores;
            for (let i = 0; i < 7; i++) {
                this.currentCores[i] = this.combineScores(cores[CoreNames[i]]);
            }
        } else {
            this.currentScore = 0;
            this.currentCores.fill(0);
        }

        // TODO Refactor, only call for new boxes in the window
        // TODO Refactor, make event based?
        activeBoxManager.update(this.windowBoxes);
        //this.updateActiveBoxes(this.windowBoxes);
        this.updatePercentiles();
    }

    softmaxMeanSigned(arr, alpha = 0.0015) {
        /**
         * Smooth "top-k" style mean: larger |v| get exponentially more weight,
         * but sign is preserved via weighting the signed values.
         */
        if (!arr || arr.length === 0) return 0;
        let acc = 0;
        let wsum = 0;
        for (const v of arr) {
            const w = Math.exp(alpha * Math.abs(v));
            acc += w * v;
            wsum += w;
        }
        return acc / (wsum || 1);
    }

    sqrtCrowdScale(n, exponent = 0.5) {
        /**
         * Sublinear scaling by crowd size. exponent=0.5 -> √N.
         * Prevents large crowds from being too sluggish (pure mean) or too explosive (pure sum).
         */
        return Math.pow(Math.max(1, n), exponent);
    }

    squashToUi(score) {
        /**
         * Map an unbounded-ish raw score (roughly ± a few thousand) into [0, 1000]
         * using a smooth tanh squash around a midpoint.
         */
        const clipped = this.clamp(score, -this.uiClip, this.uiClip);
        const ui = this.uiMid + this.uiSpread * Math.tanh(clipped / 1200);
        return this.clamp(Math.round(ui), 0, 1000);
    }

    boxAt(x, y) {
        /**
         * Finds the first active box which contains the point (x, y).
         * @param {number} x - The x coordinate (scaled to original 4K).
         * @param {number} y - The y coordinate (scaled to original 4K).
         * @returns {Object|null}
         **/

        let box = activeBoxManager.getAt(x, y);

        if (box) {
            const row = this.window[box.index];

            return {
                activeBox: box,
                row: row,
            };
        }

        return null;
    }

    getFragments(hierarchy) {
        return new Promise((resolve, reject) => {
            let playlistUrl = `/playlist/${hierarchy}-720p.m3u8`;
            console.log(`Getting fragments from ${playlistUrl}...`);
            let hls = new Hls();
            hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
                const fragments = data.details.fragments;
                console.log("returning fragments..");
                resolve(fragments);
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                reject(new Error(`HLS Error: ${data.type} - ${data.details}`));
            });

            hls.loadSource(playlistUrl);
        });
    }
}

const scoring = new Score();

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

        eventBus.addEventListener("playback.cameraChanged", (e) => {
            this.currentCamera = e.detail.camera;
        });
    }

    getCurrent() {
        return this.summaries[this.currentCamera - 1];
    }

    getAll() {
        return this.summaries;
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

class Events {
    constructor() {
        this.current = null;
    }

    get() {
        return this.current;
    }

    async getByHierarchy(hierarchy) {
        const events = await database.query("events", { hierarchy: hierarchy });

        if (events && events.length > 0) {
            this.current = events[0];
            return this.current;
        }

        this.current = null;
        return null;
    }

    async getAvailable() {
        const events = await database.query(
            "events",
            { status: "available" },
            "begin"
        );
        return events;
    }

    setStateToAvailable(state) {
        this.getAvailable().then((events) => {
            state.val = events;
        });
    }

    createOptionElement(eventData, selected) {
        const { option } = van.tags;

        const displayDate = eventData.begin.toDate().toLocaleDateString();
        const displayDescription = eventData.description.replace(
            /\(Baseball\) /,
            ""
        );
        const displayText = `${displayDate} - ${displayDescription}`;
        return option(
            {
                value: eventData.hierarchy,
                selected: eventData.hierarchy == selected,
            },
            displayText
        );
    }

    createSelectorElement(selected) {
        const { div, select } = van.tags;
        const eventListState = van.state([]);
        this.setStateToAvailable(eventListState);

        const container = div({ class: "vyevents-selector" }, () => {
            const sel = select({
                id: "report-event-select",
                class: "w-full text-black p-1",
            });

            eventListState.val.forEach((eventData) =>
                van.add(sel, this.createOptionElement(eventData, selected))
            );

            sel.addEventListener("change", (e) => {
                eventBus.dispatchEvent(
                    new CustomEvent("ui.requestEvent", {
                        detail: e.target.value,
                    })
                );
            });

            return sel;
        });

        return container;
    }
}

const events = new Events();

export {
    Modal as M,
    activeBoxManager as a,
    scoring as b,
    profiles as c,
    events as e,
    geomUtil as g,
    progress as p,
    summarizer as s,
};
//# sourceMappingURL=events-HANB766_.js.map
