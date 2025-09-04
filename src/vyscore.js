import van from "vanjs-core";
import {
    firestore,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    collection,
    where,
} from "./rsdb.js";

import { Modal } from "vanjs-ui";

const Box = Object.freeze({
    X: 0,
    Y: 1,
    W: 2,
    H: 3,
    SCORE: 4,
    COUNT: 5,
    INDEX: 6, // Index in the original window array
});

const ActiveBox = Object.freeze({
    X: 0,
    Y: 1,
    W: 2,
    H: 3,
    SCORE: 4,
    EXPIRES: 5,
    INDEX: 6, // Index in the original window array
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
        this.profile = {};

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
        this.activeBoxes = [];
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

        this.summaries = [];
        this.currentCamera = 0;
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

    //
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

        await this.ensureWindowLoaded();
        this.moveWindow();
        this.updateCurrentFromWindow();
        this.expireActiveBoxes();
    }

    async handleTimeSeek(currentTime) {
        this.resetWindow();
        this.resetActiveBoxes();

        this.currentTime = null;
        this.currentSecond = null;
        this.currentScore = 0;
        this.currentCores = [0, 0, 0, 0, 0, 0, 0];

        await this.resetLoadSchedule(currentTime + 5);
        await this.handleTimeUpdate(currentTime);
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
            this.windowBoxes.push(
                new Int32Array([
                    row.box.x,
                    row.box.y,
                    row.box.w,
                    row.box.h,
                    row.score,
                    1,
                    this.windowEndIndex,
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

        this.updateActiveBoxes(this.windowBoxes);
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
                activeBox[ActiveBox.X] = box[Box.X];
                activeBox[ActiveBox.Y] = box[Box.Y];
                activeBox[ActiveBox.W] = box[Box.W];
                activeBox[ActiveBox.H] = box[Box.H];
                activeBox[ActiveBox.SCORE] = box[Box.SCORE] / box[Box.COUNT];
                activeBox[ActiveBox.EXPIRES] = Math.floor(
                    this.windowSize * 1000
                ); // Update the expiration time
                activeBox[ActiveBox.INDEX] = box[Box.INDEX];
            } else {
                // If not active, create it and add it to activeBoxes
                // Ensure score is averaged because we're reusing the count
                activeBox = new Int32Array(box);
                activeBox[ActiveBox.SCORE] = box[Box.SCORE] / box[Box.COUNT];
                activeBox[ActiveBox.EXPIRES] = Math.floor(
                    this.windowSize * 1000
                );
                activeBox[ActiveBox.INDEX] = box[Box.INDEX];

                this.activeBoxes.push(activeBox);
            }
        }
    }

    boxAt(x, y) {
        /**
         * Finds the first active box which contains the point (x, y).
         * @param {number} x - The x coordinate (scaled to original 4K).
         * @param {number} y - The y coordinate (scaled to original 4K).
         * @returns {Object|null}
         **/

        for (const box of this.activeBoxes) {
            if (
                x >= box[ActiveBox.X] &&
                x < box[ActiveBox.X] + box[ActiveBox.W] &&
                y >= box[ActiveBox.Y] &&
                y < box[ActiveBox.Y] + box[ActiveBox.H]
            ) {
                const row = this.window[box[ActiveBox.INDEX]];

                return {
                    activeBox: box,
                    row: row,
                };
            }
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

    async createSummary(fragments) {
        this.resetWindow();
        let scores = {};

        console.log("Creating summary...");
        var { closed, pct } = this.showProgress("Creating summary...");

        for (let i = 0; i < fragments.length; i++) {
            const fragment = fragments[i];
            pct.val = (i / fragments.length) * 100;

            for (let dt = 0; dt < fragment.duration; dt += 0.25) {
                const newTime = fragment.start + dt;
                const second = Math.floor(newTime);

                await this.handleTimeUpdate(newTime);
                const score = (scores[second] = scores[second] || {
                    startTime: 99999999,
                    endTime: 0,
                    score: 0,
                    count: 0,
                    people: 0,
                });
                score.startTime = Math.min(score.startTime, newTime);
                score.endTime = Math.max(score.endTime, newTime);
                score.score += this.currentScore;
                score.people += this.activeBoxes.length;
                score.count += 1;
            }
        }

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

    checkPeople(summary) {
        let lastScore = summary[0];
        for (const score of summary) {
            const delta = Math.abs(lastScore.people - score.people);
            if (delta / lastScore.people > 0.5) {
                console.log(lastScore, score);
            }
            lastScore = score;
        }
    }

    getSummaryUrl(token, date, camera) {
        const urlPrefix = "https://storage.roarscore.ai/production/play/";
        // Make sure camera is zero padded two digits
        camera = parseInt(camera).toString().padStart(2, "0");

        return (
            `${urlPrefix}${token}/${date}/${camera}/` +
            `summary-${token}-${date}-${camera}.json`
        );
    }

    async loadSummary(url) {
        console.log(`Loading summary ${url}..`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error loaindg ${url}: ${response.statusText}`);
            return [];
        }
        const rows = await response.json();

        for (const row of rows) {
            row.startTime = parseFloat(row.startTime);
            row.endTime = parseFloat(row.endTime);
        }

        return rows;
    }

    async loadSummaries(hierarchy, cameras = 5) {
        console.log(`Loading sumamries for ${hierarchy}...`);
        this.summaries = [];

        const [token, date] = hierarchy.split("-");
        for (let camera = 1; camera <= cameras; camera++) {
            const url = this.getSummaryUrl(token, date, camera);
            this.summaries.push(await this.loadSummary(url));
        }
    }

    async storeSummary(hierarchy, summary) {
        var { closed, pct } = this.showProgress("Saving summary...");

        const batchSize = 1000;
        for (let i = 0; i < summary.length; i += batchSize) {
            pct.val = (i / summary.length) * 100;

            const key = `${hierarchy}-${i.toString().padStart(5, "0")}`;
            const rows = summary.slice(i, i + batchSize);
            const data = {
                hierarchy: hierarchy,
                offset: i,
                rows: rows,
            };

            const docRef = doc(firestore, "summaries", key);
            await setDoc(docRef, data);
        }

        closed.val = true;
    }

    async restoreSummary(hierarchy) {
        let result = [];
        let batches = [];

        // Get summaries by hierarchy
        const summariesRef = collection(firestore, "summaries");
        const q = query(summariesRef, where("hierarchy", "==", hierarchy));
        const snap = await getDocs(q);

        // Ensure they're sorted by offset
        snap.forEach((doc) => {
            batches.push(doc.data());
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

    async ensureSummaries(hierarchy, cameras = 5) {
        const [token, date] = hierarchy.split("-");

        console.log(`Ensuring summaries for ${token}-${date}...`);

        var { closed, pct } = this.showProgress("Loading summaries..");

        for (let camera = 1; camera <= cameras; camera++) {
            camera = parseInt(camera).toString().padStart(2, "0");
            const h = `${token}-${date}-${camera}`;

            console.log(`Restoring ${h}..`);
            let summary = await this.restoreSummary(h);

            if (!summary || !summary.length) {
                console.warn(
                    `SUMMARY ${h} MISSING.  CREATING.  THIS WILL TAKE AWHILE...`
                );

                var score = new Score();
                score.profile = this.profile;
                const fragments = await score.getFragments(h);
                await score.initLoadSchedule(fragments);
                summary = await score.createSummary(fragments);

                await this.storeSummary(h, summary);
            }

            pct.val = (camera / cameras) * 100;
            this.summaries.push(summary);
        }

        closed.val = true;
    }

    isSameMoment(s1, s2) {
        const buffer = 180;
        return (
            (s2.startTime >= s1.startTime - buffer &&
                s2.startTime <= s1.endTime + buffer) ||
            (s2.endTime >= s1.startTime - buffer &&
                s2.endTime <= s1.endTime + buffer)
        );
    }

    // TODO REFACTOR move to Util
    formatTime(seconds, includeSeconds = false) {
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

    findMoments(summary) {
        summary = summary || this.summaries[0];
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
            let merge = moments.find((a) => this.isSameMoment(a, moment));
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
        moments.forEach((a) => (a.label = this.formatTime(a.startTime)));

        this.moments = moments;

        return moments;
    }
}

export default Score;
export { Box, ActiveBox, Core, CoreNames, EmotionCoreMap, Score };
