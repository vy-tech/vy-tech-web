import { v as van } from './chunks/van-t8DywzvC.js';
import { e as eventBus } from './chunks/eventbus-DzIYHcTJ.js';
import { d as database } from './chunks/db-Byk5c9nh.js';
import { a as app } from './chunks/firebase-DTGT__LK.js';

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

class Profiler {
    constructor() {
        this.profile = null;
    }

    async loadFromFirestore(id) {
        /**
         * Load a profile by its ID.
         * @param {string} profileId - The ID of the profile to load.
         */

        let profileData = await database.get("profiles", id);
        if (profileData) {
            console.log("Profile loaded:", profileData);
            this.profile = profileData;
            return this.profile;
        } else {
            console.error("No profile found with ID:", id);
            return null;
        }
    }
}

const profiler = new Profiler();

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

        var profile = (profiler.profile && profiler.profile.emotions) || {};

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

// Initialize Firebase storage functions based on environment
let storageFunctions;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
    console.log("Using Admin Storage SDK...");
    storageFunctions = global._vy_storage_functions;
} else {
    console.log("Importing Client Storage SDK...");
    storageFunctions = await import('./chunks/index.esm-TgEmmvED.js');
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
const { "button": button, "div": div, "header": header, "input": input, "label": label, "span": span, "style": style } = van.tags;
const toStyleStr = (style) => Object.entries(style).map(([k, v]) => `${k}: ${v};`).join("");
const Modal = ({ closed, backgroundColor = "rgba(0,0,0,.5)", blurBackground = false, clickBackgroundToClose = false, backgroundClass = "", backgroundStyleOverrides = {}, modalClass = "", modalStyleOverrides = {}, }, ...children) => {
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
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
    return () => {
        if (closed.val)
            return null;
        const bgDom = div({ class: backgroundClass, style: toStyleStr(backgroundStyle) }, div({ class: modalClass, style: toStyleStr(modalStyle) }, children));
        clickBackgroundToClose &&
            bgDom.addEventListener("click", e => e.target === bgDom && (closed.val = true));
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

class Events {
    constructor() {
        this.current = null;
    }

    get() {
        return this.current;
    }

    async loadFromFirestore(hierarchy) {
        const events = await database.query("events", { hierarchy: hierarchy });

        if (events && events.length > 0) {
            this.current = events[0];
            return this.current;
        }

        this.current = null;
        return null;
        // const firestore = getFirestore(app);
        // const eventsRef = collection(firestore, "events");
        // const q = query(
        //     eventsRef,
        //     where("hierarchy", "==", hierarchy),
        //     limit(1)
        // );
        // const docs = await getDocs(q);

        // if (docs.empty) {
        //     this.current = null;
        //     return null;
        // } else {
        //     let eventData = null;
        //     docs.forEach((doc) => {
        //         eventData = { id: doc.id, ...doc.data() };
        //     });
        //     this.current = eventData;
        //     return eventData;
        // }
    }

    // async queryAvailableEvents() {
    //     const firestore = getFirestore(app);
    //     const eventsRef = collection(firestore, "events");
    //     const q = query(
    //         eventsRef,
    //         where("status", "==", "available"),
    //         orderBy("begin")
    //     );
    //     const docs = await getDocs(q);

    //     return docs;
    // }

    // async getAvailableEvents() {
    //     const docs = await this.queryAvailableEvents();
    //     const result = [];
    //     docs.forEach((doc) => {
    //         result.push({ id: doc.id, ...doc.data() });
    //     });

    //     return result;
    // }

    loadAvailableEvents(state) {
        database.query("events", { status: "available" }).then((events) => {
            events.sort((a, b) => {
                return a.begin - b.begin;
            });
            state.val = events;
        });

        // this.queryAvailableEvents().then((docs) => {
        //     const result = [];
        //     docs.forEach((doc) => {
        //         result.push({ id: doc.id, ...doc.data() });
        //     });

        //     state.val = result;
        // });
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
        this.loadAvailableEvents(eventListState);

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

class Time {
    constructor() {}

    format(seconds, includeSeconds = false) {
        let hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        let minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds - minutes * 60);

        let result =
            hours.toString().padStart(2, "0") +
            ":" +
            minutes.toString().padStart(2, "0");

        if (!includeSeconds) return result;

        return result + ":" + seconds.toString().padStart(2, "0");
    }

    toSeconds(time, isMMSS = false) {
        let parts = time.split(":");
        let seconds = 0;
        let i = 0;

        if (parts.length == 1) {
            return parseFloat(parts);
        } else if (parts.length == 2 && !isMMSS) {
            i = 1;
        } else if (parts.length > 3) {
            throw new Error(`Invalid time ${time}`);
        }

        while (parts.length) {
            let part = parts.pop();
            seconds += parseInt(part) * 60 ** i;
            i += 1;
        }

        return seconds;
    }
}

const timeUtil = new Time();

class Annotations {
    constructor() {
        eventBus.addEventListener("ui.addAnnotation", async (e) => {
            this.addAnnotation(e.detail.hierarchy, e.detail.currentTime);
        });

        eventBus.addEventListener("ui.importTranscript", async (e) => {
            const offset =
                (e.detail.event &&
                    e.detail.event.embed &&
                    e.detail.event.embed.offset * -1) ||
                0;

            this.importTranscript(e.detail.hierarchy, offset);
        });
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = {
            id: "report-annotations",
            class: "w-full h-auto mt-2",
            ...options,
        };

        this.container = div(merged);

        return this.container;
    }

    async addAnnotation(hierarchy, currentTime) {
        const annotation = await this.showAnnotationForm(currentTime);
        if (!annotation) return;
        await this.saveAnnotation(hierarchy, annotation);
        return annotation;
    }

    showAnnotationForm(defaultTime = 0) {
        return new Promise((resolve, reject) => {
            const { div, h3, form, label, input, select, button, option } =
                van.tags;

            let closed = van.state(false);
            let formEl = form(
                { class: "space-y-4" },

                // Time offset in seconds
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "time",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Time (seconds)"
                    ),
                    input({
                        name: "time",
                        value: timeUtil.format(defaultTime, true),
                        type: "text",
                        class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                    })
                ),

                // Type of annotation (transcript, action, event, note)
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "type",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Type"
                    ),
                    select(
                        {
                            name: "type",
                            class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white",
                        },
                        option({ value: "transcript" }, "Transcript"),
                        option({ value: "action" }, "Game Action"),
                        option({ value: "event" }, "Non-Game Event"),
                        option({ value: "note", selected: true }, "Note")
                    )
                ),

                // Importance (low, medium, high, critical)
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "importance",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Type"
                    ),
                    select(
                        {
                            name: "importance",
                            class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white",
                        },
                        option({ value: "low" }, "Low"),
                        option({ value: "medium", selected: true }, "Medium"),
                        option({ value: "high" }, "High"),
                        option({ value: "critical" }, "Critical")
                    )
                ),

                // Text content (string)
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "content",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Content"
                    ),
                    input({
                        name: "content",
                        class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                    })
                ),

                // Submit and Cancel buttons
                div(
                    { class: "flex space-x-3 pt-4" },
                    button(
                        {
                            type: "button",
                            class: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                            onclick: async () => {
                                try {
                                    const annotation =
                                        this.getAnnnotationData(formEl);
                                    closed.val = true;
                                    resolve(annotation);
                                } catch (error) {
                                    reject(error);
                                }
                            },
                        },
                        "Create Annotation"
                    ),
                    button(
                        {
                            type: "button",
                            class: "px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
                            onclick: () => {
                                closed.val = true;
                                resolve(null);
                            },
                        },
                        "Cancel"
                    )
                )
            );

            van.add(
                document.body,
                Modal(
                    {
                        closed,
                        backgroundStyleOverrides: {
                            "align-items": "flex-start", // Align to top instead of center
                            "padding-top": "15vh", // Add some padding from the top
                        },
                    },
                    div(
                        { class: "p-3 w-[500px] rounded-lg shadow-lg" },
                        h3(
                            {
                                class: "text-lg font-semibold text-gray-900 mb-4 border-b pb-2",
                            },
                            "Create Annotation"
                        ),
                        formEl
                    )
                )
            );
        });
    }

    getAnnnotationData(formEl) {
        const formData = new FormData(formEl);
        const time = timeUtil.toSeconds(formData.get("time")) || 0;
        const type = formData.get("type") || "note";
        const importance = formData.get("importance") || "medium";
        const content = formData.get("content") || "";

        const annotation = {
            time,
            type,
            importance,
            content,
        };
        return annotation;
    }

    async saveAnnotation(hierarchy, annotation) {
        console.log("Creating annotation:", annotation);

        // Split hierarchy on - or :, take first two parts, and rejoin with :
        annotation.hierarchy = hierarchy
            .split(/[\-\:]/)
            .slice(0, 2)
            .join(":");

        await database.set("annotations", annotation);

        return annotation;
    }

    async importTranscript(hierarchy, defaultOffset = 0) {
        // Show the import transcript form
        const annotations = await this.showImportTranscriptForm(defaultOffset);

        // If we get annotations back, save them
        if (annotations && annotations.length > 0) {
            await this.saveTranscript(hierarchy, annotations);
        }
    }

    async showImportTranscriptForm(defaultOffset = 0) {
        return new Promise((resolve, reject) => {
            const { div, h3, form, label, input, button, textarea } = van.tags;

            let closed = van.state(false);
            let formEl = form(
                { class: "space-y-4" },

                // Time offset in seconds
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "offset",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Offset Time (seconds)"
                    ),
                    input({
                        name: "offset",
                        value: timeUtil.format(defaultOffset, true),
                        type: "text",
                        class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                    })
                ),

                // Text content (string)
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "transcript",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Transcript"
                    ),
                    textarea({
                        name: "transcript",
                        class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                    })
                ),

                // Submit and Cancel buttons
                div(
                    { class: "flex space-x-3 pt-4" },
                    button(
                        {
                            type: "button",
                            class: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                            onclick: async () => {
                                try {
                                    const transcript =
                                        this.getTranscriptData(formEl);
                                    closed.val = true;
                                    resolve(transcript);
                                } catch (error) {
                                    reject(error);
                                }
                            },
                        },
                        "Import Transcript"
                    ),
                    button(
                        {
                            type: "button",
                            class: "px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
                            onclick: () => {
                                closed.val = true;
                                resolve(null);
                            },
                        },
                        "Cancel"
                    )
                )
            );

            van.add(
                document.body,
                Modal(
                    {
                        closed,
                        backgroundStyleOverrides: {
                            "align-items": "flex-start", // Align to top instead of center
                            "padding-top": "15vh", // Add some padding from the top
                        },
                    },
                    div(
                        { class: "p-3 w-[500px] rounded-lg shadow-lg" },
                        h3(
                            {
                                class: "text-lg font-semibold text-gray-900 mb-4 border-b pb-2",
                            },
                            "Create Annotation"
                        ),
                        formEl
                    )
                )
            );
        });
    }

    getTranscriptData(formEl) {
        const formData = new FormData(formEl);
        const offset = timeUtil.toSeconds(formData.get("offset")) || 0;
        const transcriptText = formData.get("transcript") || "";

        // Split transcriptText into lines, then parse each line for time and text
        const lines = transcriptText.split("\n");
        const annotations = [];
        let currentTime = offset;

        lines.forEach((line) => {
            // Match [mm:ss] or [hh:mm:ss] at start of line
            const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)$/);

            if (match) {
                const timeStr = match[1];
                currentTime = timeUtil.toSeconds(timeStr) + offset;
            } else {
                annotations.push({
                    time: currentTime,
                    type: "transcript",
                    importance: "medium",
                    content: line.trim(),
                });
            }
        });

        return annotations;
    }

    async saveTranscript(hierarchy, annotations) {
        const { closed, pct } = progress.show("Importing Transcript...");

        for (let i = 0; i < annotations.length; i++) {
            const annotation = annotations[i];
            await this.saveAnnotation(hierarchy, annotation);
            pct.val = Math.round(((i + 1) / annotations.length) * 100);
        }

        closed.val = true;
    }
}

const annotations = new Annotations();

class Heatmap {
    constructor() {
        this.canvas = null;

        eventBus.addEventListener("viz.paint", (e) => {
            this.paint();
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        let merged = {
            id: "report-viz-heatmap",
            width: 1280,
            height: 720,
            ...options,
        };

        this.canvas = canvas(merged);

        this.canvas.addEventListener("click", (e) => {
            eventBus.fire("heatmap.click", {});
        });
        this.canvas.addEventListener("mousemove", (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Calculate the mouse position relative to the canvas
            // and scale it to the original video resolution (3840x2160)
            const x = Math.floor(((e.clientX - rect.left) / rect.width) * 3840);
            const y = Math.floor(((e.clientY - rect.top) / rect.height) * 2160);

            eventBus.fire("heatmap.mousemove", { x: x, y: y });
        });

        return this.canvas;
    }

    paint() {
        if (!this.canvas) {
            console.error("Canvas element not found");
            return;
        }
        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            console.error("Failed to get canvas context");
            return;
        }

        // Clear the canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const activeBoxes = activeBoxManager.get();
        for (const box of activeBoxes) {
            const ox = box.x;
            const oy = box.y;
            const ow = box.w;
            const oh = box.h;
            const score = Math.floor(box.score);
            const expires = box.expires;

            // Scale the box coordinates to the canvas size
            const x = (ox / 3840) * this.canvas.width;
            const y = (oy / 2160) * this.canvas.height;
            const w = (ow / 3840) * this.canvas.width;
            const h = (oh / 2160) * this.canvas.height;

            // Calculate center and radiuses for the radial gradient
            const cx = x + w / 2;
            const cy = y + h / 2;
            const rw = w * 5.0;
            const rh = h * 5.0;
            const rx = cx - rw / 2;
            const ry = cy - rh / 2;
            const innerR = 1;
            const outerR = rh * 0.25;

            // Create the hue based on the score
            var hueOffset = (score / 1000.0) * 64;
            if (hueOffset < 0) hueOffset = Math.max(hueOffset, -64);
            else hueOffset = Math.min(hueOffset, 64);
            const hue = 64 + hueOffset;
            const gradient = ctx.createRadialGradient(
                cx,
                cy,
                innerR,
                cx,
                cy,
                outerR
            );
            const alpha = Math.floor((expires / 3000.0) * 80);
            gradient.addColorStop(0, `hsl(${hue}, 100%, 50%, ${alpha}%)`);
            gradient.addColorStop(1, `hsl(${hue}, 100%, 50%, 0%)`);
            ctx.fillStyle = gradient;

            ctx.fillRect(rx, ry, rw, rh);
        }
    }
}

const heatmap = new Heatmap();

class CameraMap {
    constructor() {
        this.canvas = null;
        this.second = null;

        eventBus.addEventListener("viz.paint", (e) => {
            this.second = Math.floor(e.detail.currentTime);
            this.paint();
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        let merged = {
            id: "report-viz-cameramap",
            class: "w-full h-full",
            width: 500,
            height: 250,
            ...options,
        };

        this.canvas = canvas(merged);

        this.init();

        return this.canvas;
    }

    scoreToHue(score) {
        let hueOffset = (score / 1000.0) * 64;
        if (hueOffset < 0) hueOffset = Math.max(hueOffset, -64);
        else hueOffset = Math.min(hueOffset, 64);
        const hue = 64 + hueOffset;
        return hue;
    }

    findTrangleFromMouse(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        // Calculate the mouse position relative to the canvas
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Scale coordinates to match canvas internal dimensions
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const scaledX = Math.floor(x * scaleX);
        const scaledY = Math.floor(y * scaleY);

        // Find the triangle that contains the mouse position
        const point = geomUtil.findTriangleContainingPoint(
            scaledX,
            scaledY,
            this.triangles
        );

        return point;
    }

    init() {
        this.active = 1;
        this.hover = null;

        this.triangles = [
            [390, 84, 499, 7, 499, 125],
            [-20, -40, 107, 80, 0, 103],
            [303, 180, 376, 249, 279, 249],
            [195, 180, 172, 249, 250, 249],
            [479, 145, 407, 233, 360, 180],
        ];

        this.labels = [
            [408, 87, 1],
            [83, 79, 2],
            [301, 200, 3],
            [192, 202, 4],
            [452, 166, 5],
        ];

        this.summaryLabels = [
            [408, 87, 1],
            [83, 79, 2],
            [301, 200, 3],
            [192, 202, 4],
            [452, 166, 5],
        ];

        // Load /img/raimondi-seat-map.png
        this.img = new Image();
        this.img.src = "/img/raimondi-seat-map.png";
        this.img.onload = () => {
            this.paint();
        };
        this.img.onerror = () => {
            console.error("Failed to load the seat map image.");
        };

        this.canvas.addEventListener("mousemove", (event) => {
            const point = this.findTrangleFromMouse(
                event.clientX,
                event.clientY
            );
            this.hover = point;
            this.paint();

            // Set mouse pointer if hovering over a triangle
            this.canvas.style.cursor = point ? "pointer" : "default";
        });

        this.canvas.addEventListener("mouseout", () => {
            this.hover = null;
            this.paint();
        });

        this.canvas.addEventListener("click", (event) => {
            const point = this.findTrangleFromMouse(
                event.clientX,
                event.clientY
            );

            if (point) {
                this.active = point;
                this.paint();
                eventBus.fire("ui.requestCamera", { camera: point });
            }
        });
    }

    paint() {
        let second = this.second;
        let summaries = summarizer.getAll();

        var ctx = this.canvas.getContext("2d");
        ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.lineWidth = 2;
        for (let i = 0; i < this.triangles.length; i++) {
            let score =
                summaries &&
                summaries[i] &&
                summaries[i][second] &&
                summaries[i][second].score;

            if (this.hover === i + 1) {
                ctx.strokeStyle = "#00eeffff";
            } else if (this.active === i + 1) {
                ctx.strokeStyle = "#3fa7d7ff";
            } else {
                ctx.strokeStyle = "#999";
            }

            if (score) {
                const hue = this.scoreToHue(score);
                ctx.fillStyle = `hsl(${hue}, 100%, 50%, 0.5)`;
            } else {
                ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            }
            const triangle = this.triangles[i];
            const [x1, y1, x2, y2, x3, y3] = triangle;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            const label = this.labels[i];
            const [lx, ly, ltext] = label;
            ctx.font = "16px Arial";
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillText(ltext, lx, ly);
        }
    }
}

const cameramap = new CameraMap();

class Ekg {
    constructor() {
        this.canvas = null;
        this.container = null;
        this.score = null;

        eventBus.addEventListener("viz.paint", (e) => {
            this.paint();
        });

        eventBus.addEventListener("viz.pause", () => {
            this.smoothie.stop();
        });

        eventBus.addEventListener("viz.play", () => {
            this.smoothie.start();
        });

        eventBus.addEventListener("viz.timeSeek", () => {
            this.timeSeries.clear();
        });
    }

    createElement(options = {}) {
        const { canvas, div } = van.tags;

        let merged = { ...options };

        this.canvas = canvas({
            id: "report-viz-ekg",
            class: "w-full h-full",
            width: 500,
            height: 250,
        });
        this.label = div(
            {
                id: "report-viz-ekg-score",
                class: "absolute top-0 left-0 p-1 text-xl text-black",
            },
            "0"
        );
        this.container = div(merged, this.canvas, this.label);

        this.init();

        return this.container;
    }

    init() {
        this.smoothie = new SmoothieChart({
            responsive: true,
            interpolation: "bezier",
            minValue: -1e3,
            maxValue: 1000,
            grid: {
                strokeStyle: "rgb(200, 200, 200)",
                fillStyle: "rgb(255,255,255)",
                lineWidth: 1,
                millisPerLine: 1000,
                verticalSections: 4,
            },
            labels: {
                fillStyle: "rgb(0, 0, 0)",
                strokeStyle: "rgb(255, 255, 0)",
                fontFamily: "Arial",
                fontSize: 16,
                precision: 0,
                showIntermediateLabels: true,
            },
        });

        this.smoothie.streamTo(this.canvas, 1000);
        window.setTimeout(() => this.smoothie.stop(), 10);
        this.timeSeries = new TimeSeries();

        this.smoothie.addTimeSeries(this.timeSeries, {
            strokeStyle: "rgb(0, 0, 255)",
            fillStyle: "rgba(0,0,255, 0.4)",
            lineWidth: 3,
        });
    }

    paint() {
        let score = scoring.currentScore;
        this.timeSeries.append(Date.now(), score);
        this.label.innerText = score.toFixed(0);
    }
}

const ekg = new Ekg();

class Spider {
    constructor() {
        this.canvas = null;

        eventBus.addEventListener("viz.paint", (e) => {
            this.paint();
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        let merged = {
            id: "report-viz-spider",
            class: "w-full h-full",
            width: 500,
            height: 500,
            ...options,
        };

        this.canvas = canvas(merged);

        this.init();

        return this.canvas;
    }

    init() {
        var ctx = this.canvas.getContext("2d");

        var labels = [
            "Anger", //0
            "Disgust", //1
            "Fear", //2
            "Happiness", //3
            "Sadness", //4
            "Surprise", //5
            "Neutral", //6
        ];

        // GROSS TODO FIXME (this is a hack to reorder the labels)
        let d = labels.splice(3, 1);
        labels.splice(6, 0, ...d);
        d = labels.splice(4, 1);
        labels.splice(0, 0, ...d);
        d = labels.splice(4, 1);
        labels.splice(1, 0, ...d);
        d = labels.splice(5, 1);
        labels.splice(4, 0, ...d);

        this.spiderDataMap = {};
        for (var i = 0; i < labels.length; i++) {
            this.spiderDataMap[labels[i]] = i;
        }

        if (this.spiderChart) this.spiderChart.destroy();

        this.spiderChart = new Chart(ctx, {
            type: "radar",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "T=0",
                        data: labels.map(() => 0),
                        fill: true,
                        backgroundColor: "rgba(0, 0, 255, 0.2)",
                        borderColor: "rgb(0, 0, 255)",
                        pointBackgroundColor: "rgb(0, 0, 255)",
                        pointBorderColor: "#fff",
                        pointHoverBackgroundColor: "#fff",
                        pointHoverBorderColor: "rgb(0, 0, 255)",
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        suggestedMin: 0,
                        suggestedMax: 1000,
                        pointLabels: {
                            font: {
                                size: 16,
                                family: "Arial",
                            },
                        },
                    },
                },
            },
        });
        this.spiderChart.update();
    }

    paint() {
        if (!this.spiderChart) return;
        let cores = scoring.currentCores;
        let data = cores.map((c) => Math.min(1000, Math.abs(c)));

        let d = data.splice(3, 1);
        data.splice(6, 0, ...d);
        d = data.splice(4, 1);
        data.splice(0, 0, ...d);
        d = data.splice(4, 1);
        data.splice(1, 0, ...d);
        d = data.splice(5, 1);
        data.splice(4, 0, ...d);

        // Update the spider chart data
        this.spiderChart.data.datasets[0].data = data;
        this.spiderChart.update();
    }
}

const spider = new Spider();

class People {
    constructor() {
        this.canvas = null;
        this.isStale = true;

        eventBus.addEventListener("viz.paint", (e) => {
            if (this.isStale) this.paint();
            this.isStale = false;
        });

        eventBus.addEventListener("viz.cameraChanged", (e) => {
            this.isStale = true;
        });
    }

    createElement(options = {}) {
        const { canvas } = van.tags;

        let merged = {
            id: "report-viz-ppl",
            class: "w-full h-auto aspect-[calc(16/4.5)] mt-2",
            width: 1280,
            height: 360,
            ...options,
        };

        this.canvas = canvas(merged);

        this.init();

        return this.canvas;
    }

    init() {
        const ctx = this.canvas.getContext("2d");

        const labels = [];
        const peopleColors = [];
        const scoreColors = [];

        for (let i = 0; i < 100; i++) {
            labels.push(`${i + 1}%`);
            peopleColors.push("#3fa7d7");
            scoreColors.push("#fdb080");
        }

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "People",
                        data: labels.map(() => 0),
                        fill: false,
                        borderColor: peopleColors,
                        borderWidth: 1,
                    },
                    {
                        label: "Score",
                        data: labels.map(() => 0),
                        fill: false,
                        borderColor: scoreColors,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                    },
                },
            },
        });
        this.chart.update();

        this.canvas.addEventListener("click", (evt) => {
            const points = this.chart.getElementsAtEventForMode(
                evt,
                "nearest",
                { intersect: true },
                true
            );

            if (points.length) {
                const firstPoint = points[0];
                const label = this.chart.data.labels[firstPoint.index];
                // const value =
                //     this.pplChart.data.datasets[firstPoint.datasetIndex].data[
                //         firstPoint.index
                //     ];
                eventBus.fire("ui.requestTimeSeek", { time: label });
            }
        });
    }

    paint() {
        let summary = summarizer.getCurrent();
        if (!this.chart) return;

        // // Only paint it when the summary changes..
        // if (this.lastSummary === summary) return;
        // this.lastSummary = summary;

        let peopleData = [];
        let scoreData = [];
        let labels = [];

        // for (let i = 0; i < 100; i++) {
        //     let idx = Math.floor(i * (summary.length / 100));
        //     labels.push(this.formatTime(summary[idx].startTime));
        //     data.push(summary[idx].people);
        // }

        let step = Math.floor(summary.length / 100);

        for (let i = 0; i < 100; i++) {
            let idx = i * step;
            let people = 0;
            let score = 0;
            let elapsedTime = 0;

            for (let j = 0; j < step; j++) {
                people += summary[idx + j].people;
                score += summary[idx + j].score;
                elapsedTime += parseInt(summary[idx + j].startTime);
            }

            peopleData.push(people / step);
            scoreData.push(score / step);
            labels.push(timeUtil.format(elapsedTime / step));
        }

        // Update the spider chart data
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = peopleData;
        this.chart.data.datasets[1].data = scoreData;
        this.chart.update();
    }
}

const people = new People();

class Demographics {
    constructor(title, labels, data) {
        this.canvas = null;
        this.title = title;
        this.labels = labels;
        this.data = data;
    }

    createElement(options = {}) {
        const { canvas } = van.tags;
        let merged = {
            id: "report-viz-demo",
            width: 448,
            height: 126,
            ...options,
        };

        this.canvas = canvas(merged);

        this.init();

        return this.canvas;
    }

    init() {
        const ctx = this.canvas.getContext("2d");

        var demoChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [this.title],
                datasets: [
                    {
                        label: this.labels[0],
                        data: [this.data[0]],
                        fill: true,
                        borderWidth: 1,
                        borderColor: ["#d94d507f"],
                        backgroundColor: ["#d94d50"],
                    },

                    {
                        label: this.labels[1],
                        data: [this.data[1]],
                        fill: true,
                        borderWidth: 1,
                        borderColor: ["#3fa7d77f"],
                        backgroundColor: ["#3fa7d7"],
                    },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scale: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true,
                    },
                },
            },
        });
        demoChart.update();
    }
}

const genderDemo = new Demographics("Gender", ["male", "female"], [60, 40]);
const ageDemo = new Demographics("Age", ["adult", "child"], [80, 20]);

class MomentFinder {
    constructor() {
        this.moments = null;

        eventBus.addEventListener("summarizer.ready", () => {
            this.find();
        });

        eventBus.addEventListener("viz.cameraChanged", () => {
            this.find();
        });
    }

    get() {
        return this.moments;
    }

    isSame(s1, s2) {
        const buffer = 180;
        return (
            (s2.startTime >= s1.startTime - buffer &&
                s2.startTime <= s1.endTime + buffer) ||
            (s2.endTime >= s1.startTime - buffer &&
                s2.endTime <= s1.endTime + buffer)
        );
    }

    find() {
        let summary = summarizer.getCurrent();
        let sorted = [...summary];
        let moments = [];

        // Sort by score and limit to top 100
        sorted.sort((a, b) => b.score - a.score);
        sorted.splice(100, sorted.length - 100);

        // Top score is our first moment
        moments.push(sorted.shift());

        while (moments.length < 10 && sorted.length > 0) {
            let moment = sorted.shift();

            // Find any same moment and merge them, or add a new one
            let merge = moments.find((a) => this.isSame(a, moment));
            if (merge) {
                merge.startTime = Math.min(moment.startTime, merge.startTime);
                merge.endTime = Math.max(moment.endTime, merge.endTime);
            } else {
                console.log("Adding..", moment);
                moments.push(moment);
            }
        }

        // Sort moments by time and add time label
        moments.sort((a, b) => a.startTime - b.startTime);
        moments.forEach((a) => (a.label = timeUtil.format(a.startTime)));

        this.moments = moments;

        eventBus.fire("momentFinder.changed");

        return moments;
    }
}

const momentFinder = new MomentFinder();

class MomentList {
    constructor() {
        this.count = 10;
        this.container = null;

        eventBus.addEventListener("momentFinder.changed", () => {
            this.update();
        });
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = { ...options };
        this.container = div(merged);

        for (let i = 0; i < this.count; i++) {
            let moment = div(
                {
                    id: `report-moment-${i + 1}`,
                    class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                    onclick: () => {
                        this.seekTo(i + 1);
                    },
                },
                div({ class: "text-2xl mb-1" }, "▶"),
                div({ class: "text-sm" }, "0")
            );
            van.add(this.container, moment);
        }

        return this.container;
    }

    update() {
        let moments = momentFinder.get();

        for (let i = 0; i < this.count; i++) {
            const moment = moments[i];
            const momentDiv = document.getElementById(`report-moment-${i + 1}`);

            if (!momentDiv) continue;

            if (moment) {
                momentDiv.querySelector(
                    "div.text-sm"
                ).textContent = `${moment.label}`;
                momentDiv.style.display = "block";
            } else {
                momentDiv.style.display = "none";
            }
        }
    }

    seekTo(number) {
        let moments = momentFinder.get();
        const moment = moments[number - 1];
        if (moment) {
            eventBus.fire("ui.requestTimeSeek", {
                seconds: moment.startTime - 15,
            });
        }
    }
}

new MomentList();

class LinkedPlayer {
    constructor() {
        this.container = null;

        eventBus.addEventListener("viz.play", () => {
            if (this.embedPlayer) {
                console.log(this.embedPlayer);
                this.embedPlayer.playVideo();
            }
        });

        eventBus.addEventListener("viz.pause", () => {
            if (this.embedPlayer) {
                this.embedPlayer.pauseVideo();
            }
        });

        eventBus.addEventListener("viz.paint", (e) => {
            this.sync(e.detail.currentTime);
        });
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = { ...options };

        this.container = div(merged);

        return this.container;
    }

    init() {
        const event = events.get();
        const embedVideo = event.embed;

        if (!embedVideo) {
            console.error("No embed available");
            return;
        }

        this.embedVideoId = embedVideo.id;
        this.embedOffset = embedVideo.offset;

        const videoId = this.embedVideoId;
        const origin = window.location.origin;
        this.container.innerHTML =
            '<iframe id="report-embed-player" width="500" height="281" ' +
            'class="w-full h-auto aspect-video" ' +
            `src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${origin}"` +
            ' title="YouTube video player" frameborder="0" allow="web-share"' +
            ' referrerpolicy="strict-origin-when-cross-origin" ' +
            "allowfullscreen></iframe>";
        this.embedPlayer = new YT.Player("report-embed-player");
    }

    sync(currentTime) {
        if (this.embedPlayer) {
            let embedTime = this.embedPlayer.getCurrentTime();
            let embedState = this.embedPlayer.getPlayerState();
            let duration = this.embedPlayer.getDuration();
            let targetTime = currentTime + this.embedOffset;

            if (targetTime < 0 || targetTime > duration) {
                if (embedState == 1) {
                    console.log(
                        `Target time is ${targetTime}, pausing embed..`
                    );
                    this.embedPlayer.pauseVideo();
                    this.embedPlayer.mute();
                }
            } else {
                if (Math.abs(targetTime - embedTime) > 1) {
                    console.log(`Seeking embed to ${targetTime}..`);
                    this.embedPlayer.seekTo(targetTime, true);
                }
                if (embedState != 1) {
                    console.log(`Playing embedded video..`);
                    this.embedPlayer.playVideo();
                }
                if (this.embedPlayer.isMuted()) {
                    this.embedPlayer.unMute();
                }
            }
        }
    }
}

const linkedPlayer = new LinkedPlayer();

class Reports {
    constructor() {
        this.hierarchy = this.getHierarchyFromPath() || "raimondi-20250711-01";
        this.currentCamera = 1;
        this.startTimeOffset = this.getTimeOffsetFromHash() || 0;
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;

        this.score = scoring;

        this.transcript = [];
        this.tsIndex = 0;

        this.event = null;
    }

    async loadTranscript() {
        const [token, date] = this.hierarchy.split("-");

        const url = `https://storage.roarscore.ai/production/play/${token}/${date}/transcript-${token}-${date}.txt`;

        try {
            let response = await fetch(url);

            if (response.ok) {
                let lines = await response.text();
                lines = lines.split(/\s*[\r\n]+\s*/);

                let offset = 0;
                let result = [];
                if (/^[\+\-]/.test(lines[0])) {
                    let line = lines.shift();
                    offset = timeUtil.toSeconds(line.substr(1), true);
                    if (line[0] == "-") offset = -offset;
                }

                while (lines.length) {
                    let t = lines.shift();
                    let msg = lines.shift();
                    t = timeUtil.toSeconds(t, true) + offset;
                    result.push({ time: t, msg: msg });
                }

                return result;
            }
        } catch (e) {
            console.log(`While fetching transcript: ${e}`);
        }

        return [];
    }

    async init() {
        this.initListeners();

        await profiler.loadFromFirestore(this.profileId);

        this.event = await events.loadFromFirestore(
            this.hierarchy.replaceAll("-", ":")
        );

        this.addElements();

        await summarizer.ensure(this.hierarchy);

        //momentlist.update();

        this.transcript = await this.loadTranscript();
    }

    changeCamera(camera) {
        console.log("Camera change requested:", camera);

        this.currentCamera = camera;
        let newHierarchy = this.hierarchy.split("-").slice(0, 2).join("-");
        newHierarchy += `-${camera.toString().padStart(2, "0")}`;
        this.hierarchy = newHierarchy;
        this.startTimeOffset = this.player.currentTime();
        console.log("Time offset set to:", this.startTimeOffset);
        this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;
        activeBoxManager.reset();
        this.score.resetWindow();
        this.hls.loadSource(this.playlistUrl);
        this.player.play();

        eventBus.fire("viz.cameraChanged", { camera: camera });
    }

    initListeners() {
        eventBus.addEventListener("ui.requestTimeSeek", (e) => {
            let seconds = e.detail.seconds;

            if (!seconds) {
                const requestedTime = e.detail.time;
                seconds = timeUtil.toSeconds(requestedTime);
            }

            this.player.currentTime(seconds);
        });

        eventBus.addEventListener("ui.requestEvent", (e) => {
            const hierarchy = e.detail;
            console.log("Event selected:", hierarchy);

            const pathname = `/reports/${hierarchy.replaceAll(":", "/")}`;
            window.location.pathname = pathname;
        });
    }

    getHierarchyFromPath() {
        /**
         * Get the hierarchy from the URL path, if present.
         */
        const path = window.location.pathname;
        const parts = path.split("/");
        return parts.length > 4 ? parts.slice(2, 5).join("-") : null; // returns the hierarchy if present, otherwise null
    }

    getTimeOffsetFromHash() {
        if (window.location.hash) {
            const hash = window.location.hash.substring(1); // Remove the '#'
            const parts = hash.split(":");
            let result = 0;
            let multiplier = 1;

            for (let i = parts.length - 1; i >= 0; i--) {
                const value = parseInt(parts[i], 10);
                if (!isNaN(value)) {
                    result += value * multiplier;
                    multiplier *= 60;

                    if (multiplier > 3600) {
                        break; // Limit to 1 hour
                    }
                }
            }
            return result;
        }

        return 0;
    }

    addElements(parentElement) {
        const { div, main, video, canvas, button } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                div(
                    {
                        id: "report-container",
                        class: "flex flex-col md:flex-row gap-4 items-start",
                    },

                    // Left column
                    div(
                        {
                            id: "report-left",
                            class: "w-full md:w-auto md:flex-grow min-w-[150px] max-w-[250px]",
                        },

                        annotations.createElement()
                        //momentlist.createElement()
                    ),

                    // Video plus bottom metadata
                    div(
                        {
                            id: "report-center",
                            class: "w-full max-w-4xl flex flex-col",
                        },

                        // Event selector
                        events.createSelectorElement(
                            this.hierarchy.replaceAll("-", ":")
                        ),

                        // Video section
                        div(
                            { class: "relative w-full pt-[62.8125%] mt-4" },
                            video({
                                id: "report-video",
                                class: "absolute top-0 left-0 w-full h-auto aspect-video video-js video-js-default-skin",

                                controls: true,
                                muted: true,
                            }),

                            // HEATMAP
                            heatmap.createElement({
                                class: "absolute top-0 left-0 w-full h-auto aspect-video z-10",
                            }),

                            div({
                                id: "video-controls",
                                class: "absolute bottom-0 left-0 w-full h-[30px]",
                            })
                        ),
                        div(
                            {
                                class: "text-sm text-gray-700",
                            },
                            div(
                                {
                                    id: "report-current-play",
                                    class: "text-sm text-gray-700 bg-white border mt-[-15px] p-2",
                                },
                                "⚾️ [No Transcript Available]"
                            ),

                            div({
                                id: "report-box-debug",
                                class: "hidden text-sm text-gray-700 bg-white p-2 border",
                            }),

                            div({ class: "" }, people.createElement()),

                            div(
                                {
                                    class: "w-full h-auto aspect-[calc(16/2.5)] mt-2",
                                },
                                div(
                                    {
                                        class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                                    },

                                    genderDemo.createElement({
                                        id: "report-viz-demo-gender ",
                                    })
                                ),

                                div(
                                    {
                                        class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                                    },

                                    ageDemo.createElement({
                                        id: "report-viz-demo-age",
                                    })
                                )
                            )
                        ),

                        div(
                            {
                                class: "text-sm text-gray-700",
                            },
                            button(
                                {
                                    type: "button",
                                    class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600",
                                    onclick: () => {
                                        eventBus.fire(
                                            "ui.requestSummaryRebuild",
                                            {
                                                hierarchy: this.hierarchy,
                                            }
                                        );
                                    },
                                },
                                "Rebuild Summary"
                            ),

                            button(
                                {
                                    type: "button",
                                    class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 ml-4",
                                    onclick: () => {
                                        console.log("Add annotation");
                                        eventBus.fire("ui.addAnnotation", {
                                            currentTime:
                                                this.player.currentTime(),
                                            hierarchy: this.hierarchy,
                                        });
                                    },
                                },
                                "Add Annotation"
                            ),

                            button(
                                {
                                    type: "button",
                                    class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 ml-4",
                                    onclick: () => {
                                        console.log("Import Transcript");
                                        eventBus.fire("ui.importTranscript", {
                                            hierarchy: this.hierarchy,
                                            event: this.event,
                                        });
                                    },
                                },
                                "Import Transcript"
                            )
                        )
                    ),

                    // Right column
                    div(
                        {
                            id: "report-right",
                            class: "w-full md:w-auto md:flex-grow min-w-[250px] max-w-[350px]",
                        },

                        // Camera map section
                        div(
                            {
                                class: "w-full h-auto aspect-[2] relative bg-white",
                            },

                            // CAMERA MAP
                            cameramap.createElement()
                        ),
                        // EKG section
                        div(
                            {
                                class: "w-full h-auto aspect-[2] mt-4 relative",
                            },

                            ekg.createElement()
                        ),

                        // Spider chart section
                        div(
                            {
                                class: "w-full h-auto aspect-square mt-4 relative bg-white",
                            },

                            spider.createElement()
                        ),

                        // Linked player
                        div(
                            {
                                id: "report-embed",
                                class: "w-full h-auto aspect-video mt-4 relative",
                            },
                            linkedPlayer.createElement()
                        )
                    )
                )
            )
        );

        console.log(this.hierarchy);
        document.getElementById("report-event-select").value = this.hierarchy;
        this.addPlayer();
        this.addHeatmapListeners();
        this.addCameraMapListeners();

        // TODO Move to event (DOM needs to be added before initializing YT)
        linkedPlayer.init();
    }

    addPlayer() {
        this.player = videojs("report-video");
        this.player.ready(() => {
            this.video = this.player.tech_.el_;

            this.hls = new Hls();
            this.hls.attachMedia(this.player.tech_.el_);
            this.hls.loadSource(this.playlistUrl);

            this.hls.on(Hls.Events.LEVEL_LOADED, async (event, data) => {
                const fragments = data.details.fragments;
                this.fragments = fragments;

                await this.score.initLoadSchedule(fragments);
            });

            // Correct Video.js event for when video starts playing
            this.player.on("play", () => {
                console.log("Video started playing");
                eventBus.fire("viz.play");

                if (this.startTimeOffset > 0) {
                    window.setTimeout(() => {
                        this.player.currentTime(this.startTimeOffset);
                        this.startTimeOffset = 0; // Reset after applying
                    }, 10);
                }
            });

            // Optional: Hide overlay when video is paused
            this.player.on("pause", () => {
                console.log("Video paused");
                eventBus.fire("viz.pause");
            });

            // Video.js time events
            this.player.on("timeupdate", async () => {
                if (this.isSeeking) return;

                const currentTime = this.player.currentTime();

                eventBus.fire("viz.paint", { currentTime: currentTime });

                await this.score.handleTimeUpdate(currentTime);

                this.updateTranscript();
                this.player.userActive(true); // Ensure active state
                this.player.controlBar.show(); // Force control bar to show

                // console.log(
                //     `Current time: ${currentTime} score: ${this.score.currentScore} cores: ${this.score.currentCores}`
                // );
            });

            // Alternative: seeked event (when user seeks to a new position)
            this.player.on("seeked", async () => {
                this.isSeeking = false;
                const currentTime = this.player.currentTime();
                console.log("Seeked to time:", currentTime);
                await this.score.handleTimeSeek(currentTime);
                eventBus.fire("viz.timeSeek", { currentTime: currentTime });
            });

            // Alternative: seeking event (while user is seeking)
            this.player.on("seeking", () => {
                this.isSeeking = true;
                const currentTime = this.player.currentTime();
                console.log("Seeking to time:", currentTime);
            });

            this.player.userActive(true); // Ensure active state
            this.player.controlBar.show(); // Force control bar to show
        });
    }

    updateTranscript() {
        const currentTime = this.player.currentTime();
        if (!this.transcript || !this.transcript.length) return;

        if (
            this.transcript &&
            this.transcript[this.tsIndex].time > currentTime
        ) {
            this.tsIndex = 0;
        }

        while (
            this.transcript &&
            this.tsIndex < this.transcript.length - 1 &&
            this.transcript[this.tsIndex].time <= currentTime
        ) {
            this.tsIndex += 1;
        }

        if (
            this.transcript &&
            this.transcript[this.tsIndex] &&
            this.tsIndex > 0
        ) {
            const ts = this.transcript[this.tsIndex - 1];
            document.getElementById("report-current-play").innerText =
                "⚾️ " + timeUtil.format(ts.time, true) + " - " + ts.msg;
        }
    }

    addHeatmapListeners() {
        eventBus.addEventListener("heatmap.click", (e) => {
            if (this.player.paused()) {
                this.player.play();
            } else {
                this.player.pause();
            }
        });

        eventBus.addEventListener("heatmap.mousemove", (e) => {
            const box = this.score.boxAt(e.detail.x, e.detail.y);

            if (box) {
                // Highlight the box or perform any action
                this.showBoxDebug(box);
            } else {
                this.hideBoxDebug();
            }
        });
    }

    addCameraMapListeners() {
        eventBus.addEventListener("ui.requestCamera", (e) => {
            this.changeCamera(e.detail.camera);
        });
    }

    showBoxDebug(box) {
        const debugDiv = document.getElementById("report-box-debug");
        debugDiv.classList.remove("hidden");

        const profile = profiler.profile.emotions;

        let html =
            '<table class="w-full"><tr><th>Emotion</th><th>Core</th><th>Confidence</th><th>Profile</th><th>Score</th></tr>';

        for (const emotion of box.row.emotions) {
            const score = emotion.score || 0;

            if (!emotion.coreName) continue;

            html +=
                `<tr><td>${emotion.name}</td>` +
                `<td>${emotion.coreName}</td>` +
                `<td>${emotion.confidence.toFixed(4)}</td>` +
                `<td>${profile[emotion.name]}</td>` +
                `<td>${score.toFixed(0)}</td></tr>`;
        }
        html +=
            `<tr><td colspan="4">t=${box.row.time.toFixed(4)}s</td>` +
            `<td><b>${box.row.score.toFixed(0)}</b></td></tr>`;
        html += "</table>";

        html += `<table class="w-full mt-2"><tr><th>Core</th><th>Score</th></tr>`;
        for (let coreName in box.row.cores) {
            const coreScore = box.row.cores[coreName].score.toFixed(0);
            html += `<tr><td>${coreName}</td><td>${coreScore}</td></tr>`;
        }
        html += "</table>";

        debugDiv.innerHTML = html;
    }

    hideBoxDebug() {
        const debugDiv = document.getElementById("report-box-debug");
        debugDiv.classList.add("hidden");
    }
}

const reports = new Reports();

if (typeof window !== "undefined") {
    window._vy_reports = reports;
}

export { Reports, reports };
//# sourceMappingURL=rsreports.js.map
