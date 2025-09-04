import { v as van } from './chunks/van-t8DywzvC.js';
import { e as events } from './chunks/rsevents-BE9Wom91.js';
import { d as doc, f as firestore, g as getDoc, s as setDoc, c as collection, q as query, w as where, a as getDocs } from './chunks/rsdb-Dlec61Ym.js';
import './chunks/rsfirebase-B6bae4XU.js';

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

class Viz {
    scoreToHue(score) {
        let hueOffset = (score / 1000.0) * 64;
        if (hueOffset < 0) hueOffset = Math.max(hueOffset, -64);
        else hueOffset = Math.min(hueOffset, 64);
        const hue = 64 + hueOffset;
        return hue;
    }

    paintHeatmap(canvas, window, start, end, windowSize) {
        if (!canvas) {
            console.error("Canvas element not found");
            return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Failed to get canvas context");
            return;
        }

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!window[end]) return;

        let endTime = window[end].time;

        for (let i = end; i >= start; i--) {
            const row = window[i];
            if (!row) break;

            //if (row.frame != frame) break;

            const ox = row.box.x;
            const oy = row.box.y;
            const ow = row.box.w;
            const oh = row.box.h;
            const score = row.score;
            const age = (row.time - endTime) / windowSize;

            // Scale the box coordinates to the canvas size
            const x = (ox / 3840) * canvas.width;
            const y = (oy / 2160) * canvas.height;
            const w = (ow / 3840) * canvas.width;
            const h = (oh / 2160) * canvas.height;

            // Calculate center and radiuses for the radial gradient
            const cx = x + w / 2;
            const cy = y + h / 2;
            const rw = w * 2; //10.0;
            const rh = h * 2; //10.0;
            const rx = cx - rw / 2;
            const ry = cy - rh / 2;
            const innerR = 1;
            const outerR = rh / 2;

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
            const alpha = (windowSize - age) * 50;

            gradient.addColorStop(0, `hsl(${hue}, 100%, 50%, ${alpha}%)`);
            gradient.addColorStop(1, `hsl(${hue}, 100%, 50%, 0%)`);
            ctx.fillStyle = gradient;
            ctx.strokeStyle = `hsl(${hue}, 100%, 50%, ${alpha}%)`;
            ctx.lineWidth = 1;
            //ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);
        }
    }
    paintActiveHeatmap(canvas, activeBoxes) {
        if (!canvas) {
            console.error("Canvas element not found");
            return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Failed to get canvas context");
            return;
        }

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const box of activeBoxes) {
            // Use array destructuring for Int32Array
            const [ox, oy, ow, oh, score, expires] = box;

            // Scale the box coordinates to the canvas size
            const x = (ox / 3840) * canvas.width;
            const y = (oy / 2160) * canvas.height;
            const w = (ow / 3840) * canvas.width;
            const h = (oh / 2160) * canvas.height;

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

    initCameraMap(cameraMapCanvas) {
        this.cameraMapActive = 1;
        this.cameraMapHover = null;
        this.cameraMapCanvas = cameraMapCanvas;

        this.cameraMapTriangles = [
            [390, 84, 499, 7, 499, 125],
            [-20, -40, 107, 80, 0, 103],
            [303, 180, 376, 249, 279, 249],
            [195, 180, 172, 249, 250, 249],
            [479, 145, 407, 233, 360, 180],
        ];

        this.cameraMapLabels = [
            [408, 87, 1],
            [83, 79, 2],
            [301, 200, 3],
            [192, 202, 4],
            [452, 166, 5],
        ];

        this.cameraMapSummaryLabels = [
            [408, 87, 1],
            [83, 79, 2],
            [301, 200, 3],
            [192, 202, 4],
            [452, 166, 5],
        ];

        // Load /img/raimondi-seat-map.png
        this.cameraMapImg = new Image();
        this.cameraMapImg.src = "/img/raimondi-seat-map.png";
        this.cameraMapImg.onload = () => {
            this.paintCameraMap();
        };
        this.cameraMapImg.onerror = () => {
            console.error("Failed to load the seat map image.");
        };

        this.cameraMapCanvas.addEventListener("mousemove", (event) => {
            const rect = this.cameraMapCanvas.getBoundingClientRect();
            // Calculate the mouse position relative to the canvas
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Find the triangle that contains the mouse position
            const point = this.findTriangleContainingPoint(
                x,
                y,
                this.cameraMapTriangles
            );
            this.cameraMapHover = point;
            this.paintCameraMap();

            // Set mouse pointer if hovering over a triangle
            this.cameraMapCanvas.style.cursor = point ? "pointer" : "default";
        });

        this.cameraMapCanvas.addEventListener("mouseout", () => {
            this.cameraMapHover = null;
            this.paintCameraMap();
        });

        this.cameraMapCanvas.addEventListener("click", (event) => {
            const rect = this.cameraMapCanvas.getBoundingClientRect();
            // Calculate the mouse position relative to the canvas
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // Find the triangle that contains the mouse position
            const point = this.findTriangleContainingPoint(
                x,
                y,
                this.cameraMapTriangles
            );
            if (point) {
                this.cameraMapActive = point;
                this.paintCameraMap();
                events.dispatchEvent(
                    new CustomEvent("cameraChangeRequest", {
                        detail: { camera: point },
                    })
                );
            }
        });
    }

    initEkg(ekg, label) {
        this.ekgLabel = label;
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

        this.smoothie.streamTo(ekg, 1000);
        window.setTimeout(() => this.smoothie.stop(), 10);
        this.timeSeries = new TimeSeries();

        this.smoothie.addTimeSeries(this.timeSeries, {
            strokeStyle: "rgb(0, 0, 255)",
            fillStyle: "rgba(0,0,255, 0.4)",
            lineWidth: 3,
        });

        // this.smoothie.addTimeSeries(this.posTimeSeries, {
        //     strokeStyle: "rgb(0, 255, 0, 0.4)",
        //     fillStyle: "rgba(0, 255, 0, 0.0)",
        //     lineWidth: 3,
        // });
        // this.smoothie.addTimeSeries(this.negTimeSeries, {
        //     strokeStyle: "rgb(255, 0, 0, 0.4)",
        //     fillStyle: "rgba(255, 0, 0, 0.0)",
        //     lineWidth: 3,
        // });
    }

    paintCameraMap(summaries, second) {
        // Save summaries and second for mousemove events.  Please refactor.
        summaries = this.pcmSummaries = summaries || this.pcmSummaries;
        second = this.pcmSecond = second || this.pcmSecond;

        var ctx = this.cameraMapCanvas.getContext("2d");
        ctx.drawImage(
            this.cameraMapImg,
            0,
            0,
            this.cameraMapCanvas.width,
            this.cameraMapCanvas.height
        );

        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ctx.fillRect(
            0,
            0,
            this.cameraMapCanvas.width,
            this.cameraMapCanvas.height
        );

        ctx.lineWidth = 2;
        for (let i = 0; i < this.cameraMapTriangles.length; i++) {
            let score =
                summaries &&
                summaries[i] &&
                summaries[i][second] &&
                summaries[i][second].score;

            if (this.cameraMapHover === i + 1) {
                ctx.strokeStyle = "#6d0098ff";
                ctx.fillStyle = "#6d00987F";
            } else if (this.cameraMapActive === i + 1) {
                ctx.strokeStyle = "#3fa7d7ff";
                ctx.fillStyle = "#3fa7d77f";
            } else if (score) {
                const hue = this.scoreToHue(score);
                ctx.strokeStyle = `hsl(${hue}, 100%, 50%, 1)`;
                ctx.fillStyle = `hsl(${hue}, 100%, 50%, 0.5)`;
            } else {
                ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            }
            const triangle = this.cameraMapTriangles[i];
            const [x1, y1, x2, y2, x3, y3] = triangle;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            const label = this.cameraMapLabels[i];
            const [lx, ly, ltext] = label;
            ctx.font = "16px Arial";
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillText(ltext, lx, ly);
        }
    }

    paintEkg(score) {
        this.timeSeries.append(Date.now(), score);
        this.ekgLabel.innerText = score.toFixed(0);
    }

    initSpider(spider) {
        var ctx = spider.getContext("2d");

        var labels = [
            "Anger", //0
            "Disgust", //1
            "Fear", //2
            "Happiness", //3
            "Sadness", //4
            "Surprise", //5
            "Neutral", //6
        ];

        // GROSS TODO FIXME
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

    paintSpider(cores) {
        if (!this.spiderChart) return;

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

    initPpl(canvas) {
        const ctx = canvas.getContext("2d");

        const labels = [];
        const borderColors = [];

        for (let i = 0; i < 100; i++) {
            labels.push(`${i + 1}%`);
            borderColors.push("#3fa7d7");
        }

        if (this.pplChart) this.pplChart.destroy();

        this.pplChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "People",
                        data: labels.map(() => 0),
                        fill: false,
                        borderColor: borderColors,
                        borderWidth: 1,
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
            },
        });
        this.pplChart.update();

        canvas.addEventListener("click", (evt) => {
            const points = this.pplChart.getElementsAtEventForMode(
                evt,
                "nearest",
                { intersect: true },
                true
            );

            if (points.length) {
                const firstPoint = points[0];
                const label = this.pplChart.data.labels[firstPoint.index];
                // const value =
                //     this.pplChart.data.datasets[firstPoint.datasetIndex].data[
                //         firstPoint.index
                //     ];
                events.dispatchEvent(
                    new CustomEvent("playerSeekRequest", {
                        detail: { time: label },
                    })
                );
            }
        });
    }

    initDemo(canvas, title, labels, data) {
        const ctx = canvas.getContext("2d");

        var demoChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [title],
                datasets: [
                    {
                        label: labels[0],
                        data: [data[0]],
                        fill: true,
                        borderWidth: 1,
                        borderColor: ["#d94d507f"],
                        backgroundColor: ["#d94d50"],
                    },

                    {
                        label: labels[1],
                        data: [data[1]],
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

    formatTime(seconds) {
        let hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        let minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds - minutes * 60);

        return (
            hours.toString().padStart(2, "0") +
            ":" +
            minutes.toString().padStart(2, "0")
        );
    }

    paintPpl(summary) {
        if (!this.pplChart) return;

        // Only paint it when the summary changes..
        if (this.pplChartSummary === summary) return;
        this.pplChartSummary = summary;

        let data = [];
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
            let time = 0;

            for (let j = 0; j < step; j++) {
                people += summary[idx + j].people;
                time += parseInt(summary[idx + j].startTime);
            }

            data.push(people / step);
            labels.push(this.formatTime(time / step));
        }

        // Update the spider chart data
        this.pplChart.data.labels = labels;
        this.pplChart.data.datasets[0].data = data;
        this.pplChart.update();
    }

    reset() {
        this.timeSeries.clear();
    }

    play() {
        this.smoothie.start();
    }

    pause() {
        this.smoothie.stop();
    }
}

class Reports {
    constructor() {
        this.hierarchy = this.getHierarchyFromPath() || "raimondi-20250711-01";
        this.currentCamera = 1;
        this.startTimeOffset = this.getTimeOffsetFromHash() || 0;
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;

        this.score = new Score();
        this.viz = new Viz();

        this.transcript = [];
        this.tsIndex = 0;

        this.embedVideos = {
            20250711: { id: "AadogpCu63M", offset: -1 * 25 * 60 - 1 },
            20250712: { id: "2xYgquM67sk", offset: -1 * 26 * 60 + 2 },
        };
        this.embedPlayer = null;
        this.embedVideoId = null;
        this.embedOffset = null;

        events.addEventListener("cameraChangeRequest", (e) => {
            const camera = e.detail.camera;
            console.log("Camera change requested:", camera);

            this.currentCamera = camera;
            let newHierarchy = this.hierarchy.split("-").slice(0, 2).join("-");
            newHierarchy += `-${camera.toString().padStart(2, "0")}`;
            this.hierarchy = newHierarchy;
            this.startTimeOffset = this.player.currentTime();
            console.log("Time offset set to:", this.startTimeOffset);
            this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;
            this.score.resetActiveBoxes();
            this.score.resetWindow();
            this.hls.loadSource(this.playlistUrl);
            this.player.play();
        });

        events.addEventListener("playerSeekRequest", (e) => {
            const time = e.detail.time;

            const seconds = this.timeToSeconds(time);
            this.player.currentTime(seconds);
        });
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
                    offset = this.timeToSeconds(line.substr(1), true);
                    if (line[0] == "-") offset = -offset;
                }

                while (lines.length) {
                    let time = lines.shift();
                    let msg = lines.shift();
                    time = this.timeToSeconds(time, true) + offset;
                    result.push({ time: time, msg: msg });
                }

                return result;
            }
        } catch (e) {
            console.log(`While fetching transcript: ${e}`);
        }

        return [];
    }

    timeToSeconds(time, isMMSS = false) {
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

        //console.log(`${time} => ${seconds}`);
        return seconds;
    }

    async init() {
        await this.score.loadProfile(this.profileId);

        this.addElements();

        await this.score.ensureSummaries(this.hierarchy);
        this.score.findMoments();

        this.addMoments();

        this.transcript = await this.loadTranscript();
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
        const { div, span, a, main, video, canvas, select, option } = van.tags;
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
                            class: "w-full md:w-auto md:flex-grow min-w-[50px] max-w-[60px]",
                        },

                        div(
                            {
                                id: "report-moment-1",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(1);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-2",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(2);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-3",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(3);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-4",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(4);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-5",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(5);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-6",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(6);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-7",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(7);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-8",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(8);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-9",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(9);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-10",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(10);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        )
                    ),

                    // Video plus bottom metadata
                    div(
                        {
                            id: "report-center",
                            class: "w-full max-w-4xl flex flex-col",
                        },
                        div(
                            {},
                            select(
                                {
                                    id: "report-event-select",
                                    class: "w-full text-black p-1",
                                    onchange: (e) => {
                                        let path = e.target.value.replaceAll(
                                            "-",
                                            "/"
                                        );
                                        window.location.href = `/reports/${path}`;
                                    },
                                },
                                option(
                                    { value: "raimondi-20250711-01" },
                                    "Fri Jul 11 - Oakland Ballers vs. Rocky Mountain Vibes"
                                ),
                                option(
                                    { value: "raimondi-20250712-01" },
                                    "Sat Jul 12 - Oakland Ballers vs. Rocky Mountain Vibes"
                                )
                            )
                        ),
                        div(
                            { class: "relative w-full pt-[62.8125%] mt-4" },
                            video({
                                id: "report-video",
                                class: "absolute top-0 left-0 w-full h-auto aspect-video video-js video-js-default-skin",

                                controls: true,
                                muted: true,
                            }),
                            canvas({
                                id: "report-overlay",
                                class: "absolute top-0 left-0 w-full h-auto aspect-video z-10",
                                width: 1280,
                                height: 720,
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
                            // div(
                            //     { class: "" },
                            //     canvas({
                            //         id: "report-pct",
                            //         class: "w-full h-auto aspect-[calc(16/4.5)] mt-2",
                            //         width: 1280,
                            //         height: 360,
                            //     })
                            // )

                            div(
                                { class: "" },
                                canvas({
                                    id: "report-ppl",
                                    class: "w-full h-auto aspect-[calc(16/4.5)] mt-2",
                                    width: 1280,
                                    height: 360,
                                })
                            ),

                            div(
                                {
                                    class: "w-full h-auto aspect-[calc(16/2.5)] mt-2",
                                },
                                div(
                                    {
                                        class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                                    },
                                    canvas({
                                        id: "report-demo-gender",
                                        width: 448,
                                        height: 126,
                                    })
                                ),

                                div(
                                    {
                                        class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                                    },

                                    canvas({
                                        id: "report-demo-age",
                                        width: 448,
                                        height: 126,
                                    })
                                )
                            )
                        )
                    ),

                    // Right column
                    div(
                        {
                            id: "report-right",
                            class: "w-full md:w-auto md:flex-grow min-w-[300px] max-w-[500px]",
                        },

                        // Camera map section
                        div(
                            {
                                class: "w-full h-auto aspect-[2] relative bg-white",
                            },
                            canvas({
                                id: "report-camera-map",
                                class: "w-full h-full",
                                width: 500,
                                height: 250,
                            })
                        ),
                        // EKG section
                        div(
                            {
                                class: "w-full h-auto aspect-[2] mt-4 relative",
                            },
                            canvas({
                                id: "report-ekg",
                                class: "w-full h-full",
                                width: 500,
                                height: 250,
                            }),
                            div(
                                {
                                    id: "report-ekg-score",
                                    class: "absolute top-0 left-0 p-1 text-xl text-black",
                                },
                                "0"
                            )
                        ),

                        // Spider chart section
                        div(
                            {
                                class: "w-full h-auto aspect-square mt-4 relative bg-white",
                            },
                            canvas({
                                id: "report-spider",
                                class: "w-full h-full",
                                width: 500,
                                height: 500,
                            })
                        ),

                        div({
                            id: "report-embed",
                            class: "w-full h-auto aspect-video mt-4 relative",
                        })
                    )
                )
            )
        );

        console.log(this.hierarchy);
        document.getElementById("report-event-select").value = this.hierarchy;
        this.addPlayer();
        this.addOverlay();
        this.addCameraMap();
        this.addEkg();
        this.addSpider();
        this.addPpl();
        //this.addPct();
        //this.addMoments();
        this.addDemos();
        this.addEmbed();
    }

    addMoments() {
        let i = 1;
        for (const moment of this.score.moments) {
            const momentDiv = document.getElementById(`report-moment-${i}`);
            momentDiv.querySelector(
                "div.text-sm"
            ).textContent = `${moment.label}`;
            i += 1;
        }
    }

    seekMoment(number) {
        const moment = this.score.moments[number - 1];
        if (moment) {
            this.player.currentTime(moment.startTime - 15);
        }
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
                this.viz.play();
                if (this.startTimeOffset > 0) {
                    window.setTimeout(() => {
                        this.player.currentTime(this.startTimeOffset);
                        this.startTimeOffset = 0; // Reset after applying
                    }, 10);
                }

                if (this.embedPlayer) {
                    this.embedPlayer.playVideo();
                }
            });

            // Optional: Hide overlay when video is paused
            this.player.on("pause", () => {
                console.log("Video paused");
                this.viz.pause();

                if (this.embedPlayer) {
                    this.embedPlayer.pauseVideo();
                }
            });

            // Video.js time events
            this.player.on("timeupdate", async () => {
                if (this.isSeeking) return;

                const currentTime = this.player.currentTime();

                await this.score.handleTimeUpdate(currentTime);
                this.viz.paintCameraMap(
                    this.score.summaries,
                    Math.floor(currentTime)
                );
                this.viz.paintActiveHeatmap(
                    this.overlay,
                    this.score.activeBoxes
                );
                // this.viz.paintHeatmap(
                //     this.overlay,
                //     this.score.window,
                //     this.score.windowStartIndex,
                //     this.score.windowEndIndex,
                //     this.score.windowSize
                // );
                this.viz.paintEkg(this.score.currentScore);
                this.viz.paintSpider(this.score.currentCores);
                this.viz.paintPpl(this.score.summaries[this.currentCamera - 1]);
                //this.viz.paintPct(this.score.percentiles);

                this.updateTranscript();
                this.player.userActive(true); // Ensure active state
                this.player.controlBar.show(); // Force control bar to show

                // console.log(
                //     `Current time: ${currentTime} score: ${this.score.currentScore} cores: ${this.score.currentCores}`
                // );

                this.syncEmbed(currentTime);
            });

            // Alternative: seeked event (when user seeks to a new position)
            this.player.on("seeked", async () => {
                this.isSeeking = false;
                const currentTime = this.player.currentTime();
                console.log("Seeked to time:", currentTime);
                await this.score.handleTimeSeek(currentTime);
                this.viz.reset();
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
                "⚾️ " + this.score.formatTime(ts.time, true) + " - " + ts.msg;
        }
    }
    addOverlay() {
        this.overlay = document.getElementById("report-overlay");

        this.overlay.addEventListener("click", (e) => {
            if (this.player.paused()) {
                this.player.play();
            } else {
                this.player.pause();
            }
        });

        this.overlay.addEventListener("mousemove", (event) => {
            const rect = this.overlay.getBoundingClientRect();
            // Calculate the mouse position relative to the canvas
            // and scale it to the original video resolution (3840x2160)
            const x = Math.floor(
                ((event.clientX - rect.left) / rect.width) * 3840
            );
            const y = Math.floor(
                ((event.clientY - rect.top) / rect.height) * 2160
            );

            const box = this.score.boxAt(x, y);

            if (box) {
                // Highlight the box or perform any action
                this.showBoxDebug(box);
            } else {
                this.hideBoxDebug();
            }
        });
    }

    addCameraMap() {
        this.cameraMap = document.getElementById("report-camera-map");
        this.viz.initCameraMap(this.cameraMap);
    }

    addEkg() {
        var ekg = document.getElementById("report-ekg");
        var label = document.getElementById("report-ekg-score");
        this.viz.initEkg(ekg, label);
    }

    addSpider() {
        var spider = document.getElementById("report-spider");
        this.viz.initSpider(spider);
    }

    //addPct() {
    //    var pct = document.getElementById("report-pct");
    //    this.viz.initPct(pct);
    //}

    addPpl() {
        var ppl = document.getElementById("report-ppl");
        this.viz.initPpl(ppl);
    }

    addDemos() {
        var gender = document.getElementById("report-demo-gender");
        this.viz.initDemo(gender, "Gender", ["male", "female"], [60, 40]);

        var age = document.getElementById("report-demo-age");
        this.viz.initDemo(age, "Age", ["adult", "child"], [80, 20]);
    }

    addEmbed() {
        const [token, date, camera] = this.hierarchy.split("-");
        const embedVideo = this.embedVideos[date];

        if (!embedVideo) {
            console.error(`No embed found for ${date}`);
            return;
        }

        this.embedVideoId = embedVideo.id;
        this.embedOffset = embedVideo.offset;

        const videoId = this.embedVideoId;
        document.getElementById("report-embed").innerHTML =
            '<iframe id="report-embed-player" width="500" height="281" ' +
            `src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=https://dev.roarscore.ai"` +
            ' title="YouTube video player" frameborder="0" allow="accelerometer; ' +
            "autoplay; clipboard-write; encrypted-media; gyroscope; " +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            "allowfullscreen></iframe>";
        this.embedPlayer = new YT.Player("report-embed-player");
    }

    syncEmbed(currentTime) {
        if (this.embedPlayer) {
            let embedTime = this.embedPlayer.getCurrentTime();
            let embedState = this.embedPlayer.getPlayerState();
            let targetTime = currentTime + this.embedOffset;

            if (targetTime < 0) {
                if (embedState == 1) {
                    console.log(
                        `Target time is ${targetTime}, pausing embed..`
                    );
                    this.embedPlayer.pauseVideo();
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
            }
        }
    }

    showBoxDebug(box) {
        const debugDiv = document.getElementById("report-box-debug");
        debugDiv.classList.remove("hidden");

        const profile = this.score.profile.emotions;

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
window.reports = reports;

export { Reports, reports };
//# sourceMappingURL=rsreports.js.map
