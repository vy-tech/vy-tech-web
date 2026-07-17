import { activeBoxManager } from "./activeBoxManager.js";
import { profilesData } from "../data/profiles.js";
import { eventBus } from "../eventbus.js";
import { chunksData } from "../data/chunk.js";
import { demographics } from "./demographics.js";
import { Hierarchy } from "../util/hierarchy.js";
import { Tracker } from "./tracker.js";
import { StateFilter } from "./stateFilter.js";
import { DEFAULT_FILTER_CONFIG } from "./filterConfig.js";

// const Box = Object.freeze({
//     X: 0,
//     Y: 1,
//     W: 2,
//     H: 3,
//     SCORE: 4,
//     COUNT: 5,
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

        /** Original Recipe **/
        // this.softmaxAlpha = 0.01;
        // this.gainFactor = 0.05;  // was dampenAlpha
        // this.useRobustNormalization = false;
        // this.robustTargetStd = 350;
        // this.applyUISquash = false;
        // this.uiMid = 500;
        // this.uiSpread = 600;
        // this.uiClip = 2500;

        /** New Recipe */
        // Softmax alphas over signed scores spanning ~±2000 act as a near-MAX:
        // exp(alpha*|r|) lets the single most extreme face/emotion dominate the
        // window, which produced the wild up/down score spikes seen in the 2026
        // season (verified on raimondi:20260616). Lower per-face alpha (softer
        // peak) and a plain MEAN across faces (combineSoftmaxAlpha=0) cut score
        // SD ~8-14x. NOTE: this drops the score scale ~10x — recalibrate UI
        // ranges / highlight thresholds. (Bucket score still uses maxScore in
        // summarizer.js:151, an additional amplifier worth revisiting.)
        //this.softmaxAlpha = 0.003; // Per-emotion weighting within single detections
        this.softmaxAlpha = /*0.01;*/ 0.0065;
        this.combineSoftmaxAlpha = /*0.005;*/ 0.0005; // Per-row weighting across multiple detections (0 = mean)
        this.gainFactor = 0.05;
        this.useRobustNormalization = false;
        this.robustTargetStd = 350;
        this.applyUISquash = false;
        this.uiMid = 500;
        this.uiSpread = 600;
        this.uiClip = 2500;

        // Adaptive normalization parameters
        this.adaptiveNormalization = true;
        this.adaptiveBaselineSampleSize = 5000; // Baseline sample size for scaling
        this.adaptiveScalingFunction = "sqrt"; // 'sqrt', 'linear', or 'log'
        this.adaptiveMinMultiplier = 0.5; // Minimum scaling multiplier
        this.adaptiveMaxMultiplier = 1.5; // Maximum scaling multiplier

        // Duration-aware scoring parameters
        this.useDecayWeighting = false; // Enable/disable temporal decay weighting
        this.decayTimeConstant = 0.1; // How quickly reactions fade (relative to window size)

        // Active box volatility parameters
        this.boxVolatilityFactor = 0.0;
        this.newBoxVolatilityFactor = 0.0;
        this.lostBoxVolatilityFactor = 0.0;

        // Live-UI smoothing: causal rolling mean over the last N currentScore
        // values. Independent of the summarizer's bucket-level smoothing
        // (H017). At 0.25s ticks, liveSmoothWindow=40 ≈ 10s of lookback.
        // Set liveSmoothWindow <= 1 to disable. liveSmoothEnabled is gated
        // off by Summarizer.create() so the offline rebuild sees raw
        // post-volatility currentScore (the H017-validated math).
        this.liveSmoothWindow = 0;
        this.liveSmoothBuffer = [];
        this.liveSmoothEnabled = false;

        /** Last working recipe */
        // this.softmaxAlpha = 0.003;
        // //this.softmaxAlpha = 0.001875; // controls how spiky per-row scoring is

        // this.useRobustNormalization = false;
        // this.robustTargetStd = 500;
        // //this.useRobustNormalization = true; // set true to normalize each fragment’s scores
        // //this.robustTargetStd = 387.5; // target stddev of scores after robust normalization

        // // UI squashing to keep scores in -1000..1000
        // this.applyUiSquash = false;
        // this.uiMid = 0; // midpoint of the displayed scale
        // this.uiSpread = 1500; // controls steepness (larger => wider)
        // this.uiClip = 2500; // clip raw score before squash

        // this.gainFactor = 0.15;  // was dampenAlpha
        // //this.gainFactor = 0.1875;

        this.currentCamera = 0;
        this.enableWindowSplicing = true;

        // H019: per-(track, emotion) state filter. Off by default; flip on
        // via Score.setFilterEnabled(true) for A/B comparison in the UI.
        this.filterEnabled = true;
        this.tracker = new Tracker();
        this.stateFilter = new StateFilter(DEFAULT_FILTER_CONFIG);
    }

    setFilterEnabled(enabled, tauConfig = null) {
        this.filterEnabled = !!enabled;
        if (tauConfig !== null) this.stateFilter.setTau(tauConfig);
        this.tracker.reset();
        this.stateFilter.reset();
        if (this.filterEnabled) {
            console.log(
                "[H019] StateFilter enabled. tauDefault=",
                this.stateFilter.tauDefault,
                "tauPerEmotion=",
                this.stateFilter.tauPerEmotion
            );
        }
    }

    applyProfileToParams(profile) {
        if (!profile || !profile.params) return;

        for (const key in profile.params) {
            if (key in this) {
                this[key] = profile.params[key];
            } else {
                console.error("Unknown scoring parameter in profile:", key);
            }
        }
    }

    applyTime(rows, timeOffset = 0.0) {
        for (const row of rows) {
            row.time = row.frame / (this.fps || row.fps || 20.0) + timeOffset;
        }
        return rows;
    }

    ensureTracking(rows, chunkKey = null) {
        if (!this.filterEnabled) return rows;
        // The expressions URL uniquely identifies the chunk, so it doubles as
        // the key the tracker namespaces per-chunk person IDs against.
        this.tracker.assign(rows, null, chunkKey);
        return rows;
    }

    applyFilters(rows) {
        if (!this.filterEnabled) return rows;
        this.stateFilter.apply(rows);
        return rows;
    }

    applyProfile(rows, profile = null) {
        profile = profile || profilesData.profile;
        let emotions = profile.emotions;

        if (!emotions) {
            console.error(
                "Missing emotions from profiles.  All scores will be zero."
            );
        }

        for (const row of rows) {
            this.computeRowScore(row, emotions, this.softmaxAlpha);
        }

        if (this.useRobustNormalization) {
            this.normalizeRowScores(rows);
        }

        return rows;
    }

    async loadDetections(url) {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error loading ${url}: ${response.statusText}`);
            return [];
        }
        let rows;

        try {
            rows = await response.json();
        } catch (e) {
            console.error(`Error parsing JSON from ${url}: ${e}`);
            return [];
        }

        // Support both raw array and {results: []} formats for flexibility
        if (!Array.isArray(rows) && "results" in rows) {
            this.fps = rows.fps || (rows.video && rows.video.fps);
            eventBus.fire("scoring.capabilities", rows.capabilities || {});
            // `url` is the resolved expressions endpoint (/api/v1/fetch/{id}/{path}),
            // so listeners can derive sibling assets without knowing which storage
            // backend the chunk lives on. See syntheticView's background plate.
            eventBus.fire("scoring.video", { ...(rows.video || {}), url });
            return rows.results;
        }

        eventBus.fire("scoring.capabilities", {});

        if (!rows || rows.length == 0) {
            console.error(`Error ${url} is empty`);
            return [];
        }
        return rows;
    }

    async loadExpressions(url, timeOffset = 0.0) {
        /**
         * Load expressions from a given URL.
         * @param {string} url - The URL to fetch expressions from.
         */

        var rows = await this.loadDetections(url);

        this.applyTime(rows, timeOffset);
        this.ensureTracking(rows, url);
        this.linkSilhouetteChain(rows);
        this.applyFilters(rows);
        this.applyProfile(rows, profilesData.profile);

        return rows;
    }

    linkSilhouetteChain(rows) {
        /**
         * Link each row to the next row of the same person that carries a
         * silhouette, as `row.nextSilhouetteRow`.
         *
         * This is read-ahead for the renderer. Detections land at
         * extraction_fps and a given person isn't outlined every time, so
         * gaps between one person's silhouettes run from ~0.33s to well over
         * a second. A renderer that only knows the *latest* outline can't pace
         * a morph — it has no idea when the next one is due, so it either
         * finishes early and sits (visible lerp-pause-lerp) or has to lag the
         * video to wait. Knowing the next outline and its timestamp up front
         * lets it interpolate across exactly the real interval, at zero lag.
         *
         * Must run after ensureTracking (needs final `person`) and after
         * applyTime (needs `time` on the player clock). One O(n) pass at load,
         * walking backwards so each row sees what it points at. Chunk-local:
         * the last outline in a chunk links to nothing and the renderer holds.
         */
        const nextByPerson = new Map();
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            const person = row.person;
            if (person === undefined || person === null) continue;
            row.nextSilhouetteRow = nextByPerson.get(person) || null;
            // Set after linking, so a row is never its own "next".
            if (row.silhouette && row.silhouette.length) {
                nextByPerson.set(person, row);
            }
        }
        return rows;
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
            if (typeof weight !== "number") continue;

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

    normalizeRowScores(rows) {
        /**
         * Optional two-pass robust normalization per fragment.
         * Centers by the median and scales by MAD so fragments are comparable.
         * Enabled by setting this.useRobustNormalization = true.
         * Uses adaptive target std based on sample size if this.adaptiveNormalization = true.
         */
        const baseTargetStd = this.robustTargetStd;
        const values = rows
            .map((r) => r.score)
            .filter((v) => Number.isFinite(v));
        if (values.length === 0) return;

        // Calculate adaptive target std based on sample size
        let targetStd = baseTargetStd;
        if (this.adaptiveNormalization) {
            targetStd = this.calculateAdaptiveTargetStd(
                values.length,
                baseTargetStd
            );
        }

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

        // Debug logging
        console.log(
            `Camera normalization: ${
                values.length
            } scores, median=${median.toFixed(1)}, MAD=${mad.toFixed(
                1
            )}, baseStd=${baseTargetStd}, adaptiveStd=${targetStd.toFixed(
                1
            )}, k=${k.toFixed(2)}`
        );

        if (k > 10) {
            // Very high multiplier indicates problems
            console.warn(`High normalization multiplier detected: k=${k}`);
        }

        for (const r of rows) {
            // scales, then clamps to a sane range to avoid UI blowups
            r.score = this.clamp(median + (r.score - median) * k, -2500, 2500);
        }
    }

    calculateAdaptiveTargetStd(sampleSize, baseTargetStd) {
        /**
         * Calculate adaptive target standard deviation based on sample size.
         * Larger samples get higher target std (more aggressive normalization).
         * Smaller samples get lower target std (gentler normalization).
         */
        let sampleSizeMultiplier;

        switch (this.adaptiveScalingFunction) {
            case "sqrt":
                sampleSizeMultiplier = Math.sqrt(
                    sampleSize / this.adaptiveBaselineSampleSize
                );
                break;
            case "linear":
                sampleSizeMultiplier =
                    sampleSize / this.adaptiveBaselineSampleSize;
                break;
            case "log":
                sampleSizeMultiplier =
                    Math.log10(Math.max(100, sampleSize)) /
                    Math.log10(this.adaptiveBaselineSampleSize);
                break;
            default:
                sampleSizeMultiplier = Math.sqrt(
                    sampleSize / this.adaptiveBaselineSampleSize
                );
        }

        // Clamp the multiplier to reasonable bounds
        sampleSizeMultiplier = Math.max(
            this.adaptiveMinMultiplier,
            Math.min(this.adaptiveMaxMultiplier, sampleSizeMultiplier)
        );

        return baseTargetStd * sampleSizeMultiplier;
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
            const clientParams = frag.initSegment.url.split("#")[1];
            const urlParams = new URLSearchParams(clientParams);
            const exprUrl = urlParams.get("ex");
            const chunkId = urlParams.get("id");
            if (current?.url != exprUrl) {
                current = {
                    id: chunkId,
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

    appendToWindow(rows) {
        this.window.push(...rows);
    }

    getWindowEndTime() {
        if (this.window.length == 0) return 0;
        return this.window[this.window.length - 1].time;
    }

    async loadWindowAsNext(url) {
        return await this.loadWindow(url, this.getWindowEndTime());
    }

    async loadWindowFromSchedule(scheduleIndex) {
        if (scheduleIndex < this.loadSchedule.length) {
            this.loadScheduleIndex = scheduleIndex;
            const sched = this.loadSchedule[scheduleIndex];

            // console.log(
            //     `Loading from schedule ${scheduleIndex} ${sched.url} ${sched.start}`
            // );

            await this.loadWindow(sched.url, sched.start);
            await chunksData.getById(sched.id);
            await demographics.loadFromCurrentChunk(sched.start);
        }
    }

    rewindWindow() {
        this.currentScore = 0;
        this.currentTime = 0;
        this.windowStartIndex = 0;
        this.windowEndIndex = 0;
        this.windowScore = 0;
        this.windowBoxes = [];
    }

    resetWindow() {
        this.window = [];
        this.windowStartIndex = 0;
        this.windowEndIndex = 0;
        this.windowScore = 0;
        this.windowBoxes = [];
        this.liveSmoothBuffer = [];
        this.tracker.reset();
        this.stateFilter.reset();
    }

    async resetLoadSchedule(newTime) {
        if (!this.loadSchedule) return;

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

    updateTime(newTime) {
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
    }

    async handleTimeUpdate(newTime) {
        // Update the time and fire the time update event
        this.updateTime(newTime);

        // Ensure we're loaded (if using load schedule)
        if (this.loadSchedule) await this.ensureWindowLoaded();

        // Move the window to the current time
        let moved = this.moveWindow();

        // Update current score from the window
        this.updateCurrentFromWindow();

        // activeBoxManager does this from the event now
        //this.expireActiveBoxes();
        //activeBoxManager.expire((this.currentTime - this.lastTime) * 1000);

        return moved;
    }

    async handleTimeSeek(currentTime) {
        this.resetWindow();

        this.currentTime = null;
        this.currentSecond = null;
        this.currentScore = 0;
        this.currentCores = [0, 0, 0, 0, 0, 0, 0];
        this.liveSmoothBuffer = [];

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

        let result =
            loadLeadTime > sched.start &&
            loadLeadTime <= sched.start + sched.duration;

        // if (!result) {
        //     console.log(
        //         `${sched.start} > ${loadLeadTime} <= ${
        //             sched.start + sched.duration
        //         } on schedule.`
        //     );
        // }

        return result;
    }

    async ensureWindowLoaded() {
        if (!this.loadSchedule) return;

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
                // Detection time. ActiveBoxManager keeps the latest per track
                // so renderers can tell how stale a box is. `expires` can't
                // answer that: update() runs every tick over the whole
                // windowSize-second window, so it stays pinned at max until
                // the row falls out of the window entirely.
                time: row.time,
                // Threaded through for the synthetic-view renderer (x001).
                // Reference, not copy — these objects are read-only downstream.
                cores: row.cores,
                emotion: row.emotion,
                // Optional in older data; activeBoxManager prefers it for
                // matching when present (else falls back to spatial overlap).
                person: row.person,
                // 32-point head-and-shoulders outline (64 numbers, x/y
                // interleaved, source-pixel space). Only present in newer
                // pipeline output.
                silhouette: row.silhouette,
                // The row this outline came from — an entry point into the
                // chain linkSilhouetteChain() built. The renderer walks it
                // forward to whichever pair brackets the current video time.
                //
                // It has to walk, rather than be handed one pair: this box is
                // rebuilt on the ~4Hz timeupdate tick, but the renderer draws
                // at 60fps, so between ticks the pair goes stale. Handing over
                // a fixed pair made every shape reach its target and freeze
                // until the next tick caught up — and 250ms against the 333ms
                // detection cadence beats at exactly 1s, so the whole crowd
                // stuttered about once a second.
                silhouetteRow: row.silhouette ? row : undefined,
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

        if (this.enableWindowSplicing && this.windowStartIndex > 25000) {
            this.window.splice(0, 24000);
            this.windowStartIndex -= 24000;
            this.windowEndIndex -= 24000;

            console.log(
                `Spliced window. ${this.window.length} ` +
                    `${origStart}=>${this.windowStartIndex} ` +
                    `${origEnd}=>${this.windowEndIndex}`
            );
        }

        const moved =
            origStart != this.windowStartIndex ||
            origEnd != this.windowEndIndex;

        // console.log(
        //     `${origStart}->${this.windowStartIndex}, ${origEnd}->${
        //         this.windowEndIndex
        //     } ${origEnd - origStart}=>${
        //         this.windowEndIndex - this.windowStartIndex
        //     } ${moved}`
        // );

        return moved;
    }

    combineScores(scores) {
        if (scores.length == 0) {
            return 0;
        }

        // Softmax-weighted mean so spikes matter more than small reactions
        // Use separate alpha for combining rows vs emotions within a row
        const level = this.softmaxMeanSigned(scores, this.combineSoftmaxAlpha);

        // Sublinear crowd scaling: lets bigger crowds move the needle more
        const scaled =
            level * this.sqrtCrowdScale(scores.length, 0.5) * this.gainFactor;

        let result = scaled;
        if (this.applyUISquash) {
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
                let scoreToUse = row.score;

                // Apply decay weighting if enabled
                if (this.useDecayWeighting) {
                    const age = this.currentTime - row.time; // How long ago this detection was

                    // Scale time constant by window size so it's relative to window duration
                    const effectiveTimeConstant =
                        this.windowSize /
                        Math.max(0.001, this.decayTimeConstant);
                    const decayWeight = Math.exp(-age / effectiveTimeConstant);

                    scoreToUse = row.score * decayWeight;
                }

                scores.push(scoreToUse);

                for (let coreName in row.cores) {
                    let coreScoreToUse = row.cores[coreName].score;

                    // Apply same decay weighting to core scores
                    if (this.useDecayWeighting) {
                        const age = this.currentTime - row.time;

                        // Use same window-scaled time constant for consistency
                        const effectiveTimeConstant =
                            this.windowSize /
                            Math.max(0.001, this.decayTimeConstant);
                        const decayWeight = Math.exp(
                            -age / effectiveTimeConstant
                        );

                        coreScoreToUse =
                            row.cores[coreName].score * decayWeight;
                    }

                    cores[coreName].push(coreScoreToUse);
                }
            }

            this.currentScore = this.combineScores(scores);

            this.applyVolatilities();

            this.currentCoresBeforeCombined = cores;
            for (let i = 0; i < 7; i++) {
                this.currentCores[i] = this.combineScores(cores[CoreNames[i]]);
            }
        } else {
            this.currentScore = 0;
            this.currentCores.fill(0);
        }

        // Live-UI causal smoothing of currentScore. Buffer the raw
        // post-volatility score, then replace currentScore with the rolling
        // mean. Gated so the summarizer's offline rebuild path sees raw
        // currentScore (the H017-validated max-then-smooth math).
        if (this.liveSmoothEnabled && this.liveSmoothWindow > 1) {
            this.liveSmoothBuffer.push(this.currentScore);
            if (this.liveSmoothBuffer.length > this.liveSmoothWindow) {
                this.liveSmoothBuffer.shift();
            }
            let sum = 0;
            for (const v of this.liveSmoothBuffer) sum += v;
            this.currentScore = sum / this.liveSmoothBuffer.length;
        }

        // TODO Refactor, only call for new boxes in the window
        // TODO Refactor, make event based?
        activeBoxManager.update(this.windowBoxes);
        //this.updateActiveBoxes(this.windowBoxes);
        this.updatePercentiles();
    }

    applyVolatilities() {
        this.currentScore = this.applyBoxVolatility(
            this.currentScore,
            activeBoxManager.totalVolatility,
            this.boxVolatilityFactor
        );
        this.currentScore = this.applyBoxVolatility(
            this.currentScore,
            activeBoxManager.newVolatility,
            this.newBoxVolatilityFactor
        );
        this.currentScore = this.applyBoxVolatility(
            this.currentScore,
            activeBoxManager.lostVolatility,
            this.lostBoxVolatilityFactor
        );
    }

    applyBoxVolatility(baseScore, volatility, factor) {
        if (volatility == 0 || factor == 0) return baseScore;

        const bonus = volatility * factor * 1000;

        //console.log(`Volatility bonus: ${volatility.toFixed(3)} * ${factor} * 1000 = ${bonus.toFixed(1)}`);
        return baseScore + bonus;
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
        return this.clamp(Math.round(ui), -1000, 1000);
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
            let h = new Hierarchy(hierarchy);
            let playlistUrl = `/playlist/${h.toString("-")}-720p.m3u8`;
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
export default scoring;
export { scoring, Core, CoreNames, EmotionCoreMap, Score };
