import { d as database } from './apiUtil-CDq4WBQY.js';
import { f as firebaseStorage } from './storage-Dh8pfopK.js';
import { e as eventBus, v as van } from './eventbus-c5hoJhOF.js';
import { M as Modal } from './van-ui-D8yynE9H.js';
import { H as Hierarchy } from './hierarchy-HD-XXbBO.js';
import { e as eventsData } from './events-gMoU96vh.js';

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

    boxHash(box) {
        /** Returns a hash based on the center of the box,
         * the size of the box, and a grid appropriate for
         * that size.
         */
        const sizeBins = [45, 80, 115];
        const centerGridSizes = [40, 50, 60];
        const [x, y, w, h] = Array.isArray(box)
            ? box
            : [box.x, box.y, box.w, box.h];

        let avgDim = (w + h) / 2;
        let sizeBin = 0;

        for (let i = 0; i < sizeBins.length; i++) {
            if (avgDim > sizeBins[i]) {
                sizeBin = i + 1;
            }
        }

        const gridSize = centerGridSizes[sizeBin];
        let centerX = Math.floor((x + w / 2) / gridSize);
        let centerY = Math.floor((y + h / 2) / gridSize);

        return `${gridSize}*${centerX},${centerY}`;
    }

    boxesAreSameHash(box1, box2) {
        return this.boxHash(box1) === this.boxHash(box2);
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

        this.volatilityPeriod = 0;
        this.newBoxCount = 0;
        this.lostBoxCount = 0;

        this.newVolatility = 0;
        this.lostVolatility = 0;
        this.totalVolatility = 0;

        eventBus.addEventListener("scoring.timeUpdate", (e) => {
            this.expire(e.detail.elapsedMillis);
            this.calculateVolatility(e.detail.elapsedMillis);
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
        this.volatilityPeriod = -1e3;
        this.newBoxCount = 0;
        this.lostBoxCount = 0;
        this.newVolatility = 0;
        this.lostVolatility = 0;
        this.totalVolatility = 0;
    }

    calculateVolatility(millis) {
        this.volatilityPeriod += millis;

        // On seek all the boxes are new so we'll need
        // some time to stabilize before calculating volatility
        // again.
        if (this.volatilityPeriod < 0) {
            this.newBoxCount = 0;
            this.lostBoxCount = 0;
        }
        // Calulate new, lost and total volatility
        else if (this.volatilityPeriod >= 1000) {
            this.newVolatility = this.newBoxCount / this.activeBoxes.length;
            this.lostVolatility = this.lostBoxCount / this.activeBoxes.length;
            this.totalVolatility =
                (this.newBoxCount + this.lostBoxCount) /
                this.activeBoxes.length;

            // console.log(
            //     `Volatility (new, lost, total): (${this.newVolatility.toFixed(
            //         2
            //     )}, ${this.lostVolatility.toFixed(
            //         2
            //     )}, ${this.totalVolatility.toFixed(2)}) over ${
            //         this.volatilityPeriod
            //     }ms`
            // );
            // Reset counts and period
            this.newBoxCount = 0;
            this.lostBoxCount = 0;
            this.volatilityPeriod = 0;
        }
    }

    expire(elapsedMillis) {
        /**
         * Expires boxes from activeBoxes that have not been updated in 10 seconds.
         */

        for (let i = this.activeBoxes.length - 1; i >= 0; i--) {
            const activeBox = this.activeBoxes[i];

            // If the box has just entered its expiration period
            // count it as lost for volatility calculations
            if (
                !activeBox.markedAsLost &&
                activeBox.expires < EXPIRE_TIME - 1000
            ) {
                this.lostBoxCount += 1;
                activeBox.markedAsLost = true;
            }

            activeBox.expires -= elapsedMillis;

            if (activeBox.expires <= 0) {
                this.activeBoxes.splice(i, 1); // Remove expired box
            }
        }
    }

    // report() {
    //     console.log(`Active boxes: ${this.activeBoxes.length}`);
    //     // Calculate average size of each box
    //     let totalAreas = {
    //         all: 0,
    //         small: 0,
    //         medium: 0,
    //         large: 0,
    //     };
    //     let counts = {
    //         all: 0,
    //         small: 0,
    //         medium: 0,
    //         large: 0,
    //     };

    //     for (const box of this.activeBoxes) {
    //         const area = box.w * box.h;
    //         totalAreas.all += area;
    //         counts.all += 1;

    //         if (box.w <= 50) {
    //             totalAreas.small += area;
    //             counts.small += 1;
    //         } else if (box.w <= 100) {
    //             totalAreas.medium += area;
    //             counts.medium += 1;
    //         } else {
    //             totalAreas.large += area;
    //             counts.large += 1;
    //         }
    //     }

    //     console.log(
    //         `  Average area: ${(totalAreas.all / counts.all).toFixed(
    //             2
    //         )} * (count: ${counts.all})`
    //     );
    //     console.log(
    //         `  Average small area: ${(totalAreas.small / counts.small).toFixed(
    //             2
    //         )} * (count: ${counts.small})`
    //     );
    //     console.log(
    //         `  Average medium area: ${(
    //             totalAreas.medium / counts.medium
    //         ).toFixed(2)} * (count: ${counts.medium})`
    //     );
    //     console.log(
    //         `  Average large area: ${(totalAreas.large / counts.large).toFixed(
    //             2
    //         )} * (count: ${counts.large})`
    //     );
    // }

    matches(a, b) {
        /**
         * Returns true if two boxes are considered the same person.
         *
         * When both boxes carry a `person` ID (newer pipeline data), that
         * is the authoritative signal — two distinct IDs mean two distinct
         * people even if the boxes happen to spatially overlap. When at
         * least one side is missing the ID, fall back to spatial overlap
         * via geomUtil.boxesAreSame (legacy + mixed-data path).
         */
        const aHas = a.person !== undefined && a.person !== null;
        const bHas = b.person !== undefined && b.person !== null;
        if (aHas && bHas) return a.person === b.person;
        return geomUtil.boxesAreSame(a, b);
    }

    update(boxes) {
        /**
         * Updates the active boxes based on the current second,
         * adds any non-overlapping boxes to activeBoxes.
         */

        for (const box of boxes) {
            // Check if the box is already active
            var activeBox = this.activeBoxes.find((activeBox) => {
                if (this.matches(activeBox, box)) {
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
                // Keep the active box's person ID consistent with the
                // latest detection. If the new detection has no ID, retain
                // whatever the active box already had.
                if (box.person !== undefined && box.person !== null) {
                    activeBox.person = box.person;
                }
                // Refresh per-frame semantic fields from the new detection.
                // The `undefined` guard preserves the previous value when a
                // single frame drops the field (sticky last-known behavior),
                // important for `silhouette` which the synthetic view reads
                // every paint and which only some pipeline runs emit.
                if (box.cores !== undefined) {
                    activeBox.cores = box.cores;
                }
                if (box.emotion !== undefined) {
                    activeBox.emotion = box.emotion;
                }
                if (box.silhouette !== undefined) {
                    activeBox.silhouette = box.silhouette;
                }
            }
            // If not active, create it and add it to activeBoxes
            // Ensure score is averaged because we're reusing the count
            else {
                activeBox = { ...box };
                activeBox.score = box.score / box.count;
                activeBox.expires = EXPIRE_TIME;
                activeBox.index = box.index;
                this.newBoxCount += 1;

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

// Default scoring parameters based on rssettings.js
const defaultScoringParams = {
    // See scoring.js constructor: softmax alphas act as a near-MAX over ±2000
    // signed scores; lowered to de-spike the score (mean combine). Recalibrate
    // score-scale-dependent thresholds when changing these.
    softmaxAlpha: 0.003,
    combineSoftmaxAlpha: 0.0,
    gainFactor: 0.05,
    useRobustNormalization: false,
    robustTargetStd: 350,
    applyUISquash: false,
    uiMid: 500,
    uiSpread: 600,
    uiClip: 2500,
    adaptiveNormalization: true,
    adaptiveBaselineSampleSize: 5000,
    adaptiveScalingFunction: "sqrt",
    adaptiveMinMultiplier: 0.5,
    adaptiveMaxMultiplier: 1.5,
    useDecayWeighting: false, // Enable temporal decay weighting
    decayTimeConstant: 1.0, // Time constant for decay weighting (seconds)
    boxVolatilityFactor: 0.0,
    newBoxVolatilityFactor: 0.0,
    lostBoxVolatilityFactor: 0.0,
};

const defaultEmotionWeights = {
    Admiration: 1,
    Adoration: 1,
    "Aesthetic Appreciation": 1.25,
    Amusement: 1.5,
    Anger: 0,
    Annoyance: 1,
    Anxiety: 0,
    Awe: 1.5,
    Awkwardness: 0,
    Boredom: -2,
    Calmness: 0,
    Concentration: 0,
    Confusion: 0,
    Contemplation: 0,
    Contempt: 0,
    Contentment: 0,
    Craving: 0,
    Desire: 0,
    Determination: 0,
    Disappointment: 0,
    Disapproval: 0,
    Disgust: 0,
    Distress: 0,
    Doubt: 0,
    Ecstasy: 1.5,
    Embarrassment: 0,
    "Empathic Pain": 0,
    Enthusiasm: 2,
    Entrancement: 2,
    Envy: 0,
    Excitement: 2,
    Fear: 0,
    Gratitude: 1,
    Guilt: 0,
    Horror: 0,
    Interest: 1,
    Joy: 1.5,
    Love: 1.5,
    Nostalgia: 0,
    Pain: 0,
    Pride: 1,
    Realization: 1,
    Relief: 1,
    Romance: 1,
    Sadness: 0,
    Sarcasm: 0,
    Satisfaction: 1.5,
    Shame: 0,
    "Surprise (negative)": 0,
    "Surprise (positive)": 2,
    Sympathy: 0,
    Tiredness: -0.5,
    Triumph: 2,
};

class ProfilesData {
    constructor() {
        this.profile = null;
        this.getById(defaultProfileId);
    }

    async getById(id) {
        /**
         * Load a profile by its ID.
         * @param {string} id - The ID of the profile to load.
         */
        let profileData = await database.get("profiles", id);
        if (profileData) {
            // Ensure scoring parameters exist with defaults
            if (!profileData.params) {
                profileData.params = { ...defaultScoringParams };
            } else {
                // Merge with defaults to ensure all parameters exist
                profileData.params = {
                    ...defaultScoringParams,
                    ...profileData.params,
                };
            }

            // Ensure emotion weights exist with defaults
            if (!profileData.emotions) {
                profileData.emotions = { ...defaultEmotionWeights };
            } else {
                // Merge with defaults to ensure all emotions exist
                profileData.emotions = {
                    ...defaultEmotionWeights,
                    ...profileData.emotions,
                };
            }

            this.profile = profileData;

            return this.profile;
        } else {
            console.error("No profile found with ID:", id);
            return null;
        }
    }

    async getAll() {
        /**
         * Get all profiles.
         * @returns {Array} Array of all profiles
         */
        return await database.query("profiles");
    }

    async clone(sourceId, updates = {}) {
        const sourceProfile = await this.getById(sourceId);
        if (!sourceProfile) {
            console.error(
                "Cannot duplicate non-existent profile ID:",
                sourceId
            );
            return null;
        }

        // Apply any updates, merging nested objects properly
        const duplicateData = {
            ...sourceProfile,
            ...updates,
        };

        // Remove the ID so we don't overwrite the original
        delete duplicateData.id;
        delete duplicateData.created;

        // Handle nested merging for emotions and params if they exist in updates
        if (updates.emotions) {
            duplicateData.emotions = {
                ...duplicateData.emotions,
                ...updates.emotions,
            };
        }
        if (updates.params) {
            duplicateData.params = {
                ...duplicateData.params,
                ...updates.params,
            };
        }

        return duplicateData;
    }

    async duplicate(sourceId, updates = {}) {
        /**
         * Duplicate an existing profile with optional updates.
         * @param {string} sourceId - The source profile ID
         * @param {Object} [updates={}] - Optional data to override in the duplicated profile
         * @returns {string|null} The new profile ID or null if failed
         */

        const duplicateData = await this.clone(sourceId, updates);
        if (!duplicateData) {
            return null;
        }

        return await database.set("profiles", duplicateData);
    }

    async create(profileData) {
        /**
         * Create a new profile based on the default profile with overrides.
         * @param {Object} profileData - The profile data
         * @param {string} profileData.name - Profile name
         * @param {string} [profileData.description] - Profile description
         * @param {Object} [profileData.emotions] - Emotion weights map (will override defaults)
         * @param {Object} [profileData.params] - Scoring parameters (will override defaults)
         * @returns {string|null} The created profile ID or null if failed
         */
        return await this.duplicate(defaultProfileId, profileData);
    }

    async update(id, updates) {
        /**
         * Update an existing profile.
         * @param {string} id - The profile ID
         * @param {Object} updates - Fields to update
         * @returns {boolean} Success status
         */

        // If updating scoring parameters, merge with existing
        if (
            updates &&
            updates.params &&
            this.profile &&
            this.profile.id === id
        ) {
            updates.params = { ...this.profile.params, ...updates.params };
        }

        // If updating emotions, merge with existing
        if (
            updates &&
            updates.emotions &&
            this.profile &&
            this.profile.id === id
        ) {
            updates.emotions = {
                ...this.profile.emotions,
                ...updates.emotions,
            };
        }

        const success = await database.update("profiles", id, updates);

        // Refresh current profile if it was updated
        if (success && this.profile && this.profile.id === id) {
            await this.getById(id);
        }

        return success;
    }

    async delete(id) {
        /**
         * Delete a profile.
         * @param {string} id - The profile ID
         * @returns {boolean} Success status
         */

        if (id === defaultProfileId) {
            console.error("Cannot delete the default profile");
            return false;
        }

        const success = await database.delete("profiles", id);

        // Clear current profile if it was deleted
        if (success && this.profile && this.profile.id === id) {
            this.profile = null;
            // Load default profile
            await this.getById(defaultProfileId);
        }

        return success;
    }

    async setActive(id) {
        /**
         * Set the active profile.
         * @param {string} id - The profile ID to make active
         * @returns {Object|null} The active profile or null if failed
         */
        return await this.getById(id);
    }

    getScoringParams() {
        /**
         * Get scoring parameters from the current profile.
         * @returns {Object} Scoring parameters
         */
        return this.profile?.params || { ...defaultScoringParams };
    }

    async updateScoringParams(params) {
        /**
         * Update scoring parameters for the current profile.
         * @param {Object} params - Scoring parameters to update
         * @returns {boolean} Success status
         */
        if (!this.profile) {
            console.error("No active profile to update");
            return false;
        }

        return await this.update(this.profile.id, { params });
    }

    getEmotionWeight(emotionName) {
        /**
         * Get the weight for a specific emotion.
         * @param {string} emotionName - The emotion name
         * @returns {number} The emotion weight (default 0)
         */
        return this.profile?.emotions?.[emotionName] || 0;
    }

    async updateEmotionWeight(emotionName, weight) {
        /**
         * Update the weight for a specific emotion.
         * @param {string} emotionName - The emotion name
         * @param {number} weight - The new weight
         * @returns {boolean} Success status
         */
        if (!this.profile) {
            console.error("No active profile to update");
            return false;
        }

        const emotions = { ...this.profile.emotions };
        emotions[emotionName] = weight;

        return await this.update(this.profile.id, { emotions });
    }

    async updateEmotionWeights(emotionWeights) {
        /**
         * Update multiple emotion weights at once.
         * @param {Object} emotionWeights - Map of emotion names to weights
         * @returns {boolean} Success status
         */
        if (!this.profile) {
            console.error("No active profile to update");
            return false;
        }

        const emotions = { ...this.profile.emotions, ...emotionWeights };
        return await this.update(this.profile.id, { emotions });
    }
}

const profilesData = new ProfilesData();

class Chunk {
    getPublicUrl(path) {
        if (this.storage == "firebase") {
            return `https://firebasestorage.googleapis.com/v0/b/roarscore-1ddf5.firebasestorage.app/o/${path}?alt=media`;
        } else if (this.storage == "minio") {
            return `https://storage.roarscore.ai/production/${path}`;
        } else if (this.storage == "seaweed") {
            return `https://s.vy.vision/${path}`;
        }

        return null;
    }

    getExpressionsUrl() {
        if (!this.expressionsPath) return null;

        return this.getPublicUrl(this.expressionsPath);
    }

    getDemographicsUrl() {
        if (!this.demographicsPath) return null;

        return this.getPublicUrl(this.demographicsPath);
    }
}

class ChunksData {
    constructor() {
        this.current = null;
    }

    get() {
        return this.current;
    }

    async getById(id) {
        if (this.current && this.current.id === id) {
            return this.current;
        }
        let chunk = await database.get("chunks", id);
        if (chunk) {
            this.current = Object.setPrototypeOf(chunk, Chunk.prototype);
            return this.current;
        }
        return null;
    }

    async getByHierarchy(hierarchy) {
        // Make sure hierarchy is a Hierarchy instance
        if (!(hierarchy instanceof Hierarchy)) {
            hierarchy = new Hierarchy(hierarchy);
        }

        const chunks = await database.query("chunks", {
            hierarchy: hierarchy.toString(),
        });
        return chunks.map((chunk) =>
            Object.setPrototypeOf(chunk, Chunk.prototype)
        );
    }
}

const chunksData = new ChunksData();

class Demographics {
    constructor() {
        this.data = null;
        this.summary = null;
        this.current = {
            male: 0,
            female: 0,
            adult: 0,
            child: 0,
            person: 0,
        };

        eventBus.on("playback.timeupdate", (e) => {
            const second = Math.floor(e.detail.currentTime);
            if (this.summary && second in this.summary) {
                const entry = this.summary[second];

                if (entry.person) this.current.person = entry.person;
                if (entry.adult) {
                    this.current.adult = entry.adult;

                    // Child detection is currently not populating correctly
                    if (this.current.person) {
                        this.current.child = Math.max(
                            this.current.person - this.current.adult,
                            0
                        );
                    }
                }

                if (entry.male) this.current.male = entry.male;
                if (entry.female) this.current.female = entry.female;
            }
        });
    }

    async loadFromCurrentChunk(timeOffset = 0) {
        const chunk = chunksData.get();
        return await this.loadFromChunk(chunk, timeOffset);
    }

    async loadFromChunk(chunk, timeOffset = 0) {
        if (!chunk) return;

        const url = chunk.getDemographicsUrl();
        return await this.loadFromUrl(url, timeOffset);
    }

    async loadFromUrl(url, timeOffset) {
        if (!url) return;

        console.log(`Loading demographics from ${url}`);
        const response = await fetch(url);
        const demographics = await response.json();
        this.data = demographics;

        var result = {};

        for (const entry of demographics) {
            const time = Math.floor(entry.time) + timeOffset;
            result[time] = result[time] || { time };
            result[time][entry.detection] = entry.count;
        }

        let sorted = Object.values(result).sort((a, b) => a.time - b.time);
        this.summary = {};
        for (const entry of sorted) {
            this.summary[Math.floor(entry.time)] = entry;
        }

        return this.summary;
    }
}

const demographics = new Demographics();

if (typeof window !== "undefined") {
    window._vy_demographics = demographics;
}

// H019 Tracker — assigns stable `person` IDs to detection rows that lack them.
//
// Two paths:
//   1. If every row already has a numeric `person` (local ves output), the
//      existing IDs are treated as authoritative and we only run signature
//      cross-chunk re-id (when signatures are present on both sides).
//   2. Otherwise (Hume API path; no person field), we run greedy bbox-IoU
//      matching per consecutive-frame pair to build stable IDs within the
//      chunk.
//
// Tracker state (`nextTrackId`, `priorSignatures`) is instance-level and
// carries across chunks so cross-chunk signature re-id has something to
// match against. Call reset() at the start of a fresh scoring run.

const DEFAULT_IOU_THRESHOLD = 0.3;
const DEFAULT_TIME_GAP_S = 0.5;
const DEFAULT_SIGNATURE_THRESHOLD = 0.7;

class Tracker {
    constructor({
        iouThreshold = DEFAULT_IOU_THRESHOLD,
        timeGapS = DEFAULT_TIME_GAP_S,
        signatureThreshold = DEFAULT_SIGNATURE_THRESHOLD,
    } = {}) {
        this.iouThreshold = iouThreshold;
        this.timeGapS = timeGapS;
        this.signatureThreshold = signatureThreshold;
        this.nextTrackId = 0;
        this.priorSignatures = null;
    }

    reset() {
        this.nextTrackId = 0;
        this.priorSignatures = null;
    }

    assign(rows, chunkSignatures = null) {
        if (!rows || rows.length === 0) return rows;

        const allHavePerson = rows.every(
            (r) => typeof r.person === "number"
        );

        if (!allHavePerson) {
            this._assignByIoU(rows);
        }

        if (chunkSignatures && this.priorSignatures) {
            const current = decodeSignatures(chunkSignatures);
            this._reidBySignature(rows, current);
            this.priorSignatures = current;
        } else if (chunkSignatures) {
            this.priorSignatures = decodeSignatures(chunkSignatures);
        }

        return rows;
    }

    _assignByIoU(rows) {
        // Group rows by frame
        const framesMap = new Map();
        for (const row of rows) {
            if (!framesMap.has(row.frame)) framesMap.set(row.frame, []);
            framesMap.get(row.frame).push(row);
        }
        const frames = [...framesMap.keys()].sort((a, b) => a - b);

        // active: Map<trackId, {lastTime, lastBox}>
        const active = new Map();

        for (const frame of frames) {
            const frameRows = framesMap.get(frame);
            frameRows.sort((a, b) => a.time - b.time);
            const refTime = frameRows[0].time;

            // Candidate active tracks within timeGapS of this frame
            const candidates = [];
            for (const [trackId, info] of active.entries()) {
                if (refTime - info.lastTime <= this.timeGapS) {
                    candidates.push({
                        trackId,
                        lastBox: info.lastBox,
                    });
                }
            }

            // All (row, candidate) IoU pairs above threshold
            const pairs = [];
            for (let ri = 0; ri < frameRows.length; ri++) {
                for (let ci = 0; ci < candidates.length; ci++) {
                    const iou = bboxIoU(
                        frameRows[ri].box,
                        candidates[ci].lastBox
                    );
                    if (iou >= this.iouThreshold) {
                        pairs.push({ ri, ci, iou });
                    }
                }
            }
            // Greedy by descending IoU
            pairs.sort((a, b) => b.iou - a.iou);
            const usedRows = new Set();
            const usedCands = new Set();
            for (const p of pairs) {
                if (usedRows.has(p.ri) || usedCands.has(p.ci)) continue;
                usedRows.add(p.ri);
                usedCands.add(p.ci);
                const row = frameRows[p.ri];
                const cand = candidates[p.ci];
                row.person = cand.trackId;
                active.set(cand.trackId, {
                    lastTime: row.time,
                    lastBox: row.box,
                });
            }

            // Unmatched rows get fresh track IDs
            for (let ri = 0; ri < frameRows.length; ri++) {
                if (usedRows.has(ri)) continue;
                const row = frameRows[ri];
                const trackId = this.nextTrackId++;
                row.person = trackId;
                active.set(trackId, {
                    lastTime: row.time,
                    lastBox: row.box,
                });
            }

            // Prune stale tracks
            for (const [trackId, info] of active.entries()) {
                if (refTime - info.lastTime > this.timeGapS) {
                    active.delete(trackId);
                }
            }
        }
    }

    _reidBySignature(rows, current) {
        const currentIds = [...current.keys()];
        const priorIds = [...this.priorSignatures.keys()];
        if (currentIds.length === 0 || priorIds.length === 0) return;

        // Best prior for each current, best current for each prior
        const bestForCurrent = new Map();
        const bestForPrior = new Map();
        for (const ci of currentIds) {
            const cv = current.get(ci);
            for (const pi of priorIds) {
                const pv = this.priorSignatures.get(pi);
                const s = cosineSim(cv, pv);
                const bc = bestForCurrent.get(ci);
                if (!bc || s > bc.sim) {
                    bestForCurrent.set(ci, { pi, sim: s });
                }
                const bp = bestForPrior.get(pi);
                if (!bp || s > bp.sim) {
                    bestForPrior.set(pi, { ci, sim: s });
                }
            }
        }

        // Mutual-best ≥ threshold
        const remap = new Map();
        for (const ci of currentIds) {
            const best = bestForCurrent.get(ci);
            if (!best || best.sim < this.signatureThreshold) continue;
            const reverse = bestForPrior.get(best.pi);
            if (reverse && reverse.ci === ci) {
                remap.set(ci, best.pi);
            }
        }

        if (remap.size === 0) return;
        for (const row of rows) {
            if (remap.has(row.person)) row.person = remap.get(row.person);
        }
    }
}

function bboxIoU(a, b) {
    if (!a || !b) return 0;
    const ix1 = Math.max(a.x, b.x);
    const iy1 = Math.max(a.y, b.y);
    const ix2 = Math.min(a.x + a.w, b.x + b.w);
    const iy2 = Math.min(a.y + a.h, b.y + b.h);
    const iw = Math.max(0, ix2 - ix1);
    const ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    if (inter <= 0) return 0;
    const union = a.w * a.h + b.w * b.h - inter;
    return union > 0 ? inter / union : 0;
}

function decodeSignatureCentroid(b64) {
    const raw = atob(b64);
    const buf = new Int8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        // int8 sign-extend: charCodeAt gives 0..255; shift maps high bytes negative.
        buf[i] = (raw.charCodeAt(i) << 24) >> 24;
    }
    const v = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) v[i] = buf[i] / 127.0;
    let n = 0;
    for (let i = 0; i < v.length; i++) n += v[i] * v[i];
    n = Math.sqrt(n);
    if (n < 1e-8) return v;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
}

function cosineSim(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
}

function decodeSignatures(chunkSignatures) {
    const out = new Map();
    for (const sig of chunkSignatures) {
        if (!sig.signature || !sig.signature.centroid_b64) continue;
        out.set(
            sig.track_id,
            decodeSignatureCentroid(sig.signature.centroid_b64)
        );
    }
    return out;
}

// Per-emotion τ configuration for the H019 StateFilter. Values mirror the
// Python testing config verbatim. Fast τ for fast-onset emotions (so the
// filter is near-identity), long τ for the three drift-prone emotions
// (Boredom, Concentration, Confusion), default τ for everything else.
//
// The StateFilter constructor accepts either a number (uniform τ) or this
// object shape; the special key `default` is used for emotions not listed.

const DEFAULT_FILTER_CONFIG = Object.freeze({
    Joy: 0.3,
    Amusement: 0.3,
    Excitement: 0.3,
    Triumph: 0.3,
    "Surprise (positive)": 0.3,
    Adoration: 0.3,
    Love: 0.3,
    Awe: 0.3,
    Realization: 0.3,
    Interest: 0.3,
    Admiration: 0.3,
    Horror: 0.3,
    Fear: 0.3,
    "Surprise (negative)": 0.3,
    Distress: 0.3,
    Pain: 0.3,
    "Empathic Pain": 0.3,
    Boredom: 3.0,
    Concentration: 3.0,
    Confusion: 3.0,
    default: 1.0,
});

// H019 StateFilter — per-(track, emotion) 2nd-order critically-damped
// state-space filter, integrated with the exact closed-form step of
//
//     ÿ + 2ω·ẏ + ω²·y = 0    where y = state − measurement
//
// Critical damping (ζ = 1) is fixed; the only knob is τ (per emotion). The
// exact step is unconditionally stable for any dt and keeps the state within
// the convex hull of measurements (no overshoot). First sight of a
// (track, emotion) pair writes through unchanged — no cold-start transient.
//
// State (the per-(track, emotion) map) carries across chunks within a single
// scoring run so the chunk-edge initialization transient dissolves. Call
// reset() at the start of a fresh scoring run.


class StateFilter {
    constructor(tauConfig = null) {
        this.setTau(tauConfig);
        // state: Map<trackId, Map<emotionName, {s, v, t}>>
        this.state = new Map();
    }

    reset() {
        this.state = new Map();
    }

    setTau(tauConfig) {
        if (typeof tauConfig === "number") {
            this.tauDefault = tauConfig;
            this.tauPerEmotion = null;
        } else if (tauConfig && typeof tauConfig === "object") {
            this.tauDefault = tauConfig.default ?? 1.0;
            this.tauPerEmotion = tauConfig;
        } else {
            this.tauDefault = DEFAULT_FILTER_CONFIG.default;
            this.tauPerEmotion = DEFAULT_FILTER_CONFIG;
        }
    }

    tauFor(emotionName) {
        if (
            this.tauPerEmotion &&
            Object.prototype.hasOwnProperty.call(this.tauPerEmotion, emotionName)
        ) {
            return this.tauPerEmotion[emotionName];
        }
        return this.tauDefault;
    }

    apply(rows) {
        if (!rows || rows.length === 0) return rows;

        // Group rows by trackId
        const byTrack = new Map();
        for (const row of rows) {
            const tid = row.person;
            if (tid === undefined || tid === null) continue;
            if (!byTrack.has(tid)) byTrack.set(tid, []);
            byTrack.get(tid).push(row);
        }

        for (const [trackId, trackRows] of byTrack.entries()) {
            trackRows.sort((a, b) => a.time - b.time);
            this._filterTrack(trackId, trackRows);
        }

        return rows;
    }

    _filterTrack(trackId, trackRows) {
        if (!this.state.has(trackId)) this.state.set(trackId, new Map());
        const trackState = this.state.get(trackId);

        for (const row of trackRows) {
            const t = row.time;
            if (!Array.isArray(row.emotions)) continue;
            for (const emotion of row.emotions) {
                const name = emotion.name;
                const measurement = emotion.score;
                const tau = this.tauFor(name);
                const omega = 1.0 / tau;

                const prev = trackState.get(name);
                if (!prev) {
                    trackState.set(name, { s: measurement, v: 0, t });
                    continue;
                }

                const dt = Math.abs(t - prev.t);
                const y0 = prev.s - measurement;
                const b = prev.v + omega * y0;
                const decay = Math.exp(-omega * dt);
                const y1 = (y0 + b * dt) * decay;
                const vNew =
                    decay *
                    (prev.v * (1 - omega * dt) - omega * omega * y0 * dt);
                const sNew = measurement + y1;

                emotion.score = sNew;
                trackState.set(name, { s: sNew, v: vNew, t });
            }
        }
    }
}

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
        this.softmaxAlpha = 0.0065;
        this.combineSoftmaxAlpha = 0.0005; // Per-row weighting across multiple detections (0 = mean)
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

    ensureTracking(rows) {
        if (!this.filterEnabled) return rows;
        this.tracker.assign(rows, null);
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
            eventBus.fire("scoring.video", rows.video || {});
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
        this.ensureTracking(rows);
        this.applyFilters(rows);
        this.applyProfile(rows, profilesData.profile);

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
        return this.clamp(Math.round(ui), -1e3, 1000);
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

class Summarizer {
    constructor() {
        this.currentCamera = 1;
        this.summaries = [];

        // H017: post-bucket rolling-mean smoothing on the `score` field.
        // Defaults match the H017 production recommendation: causal w=10.
        // Set smoothWindow <= 1 or smoothMode = "none" to disable.
        this.smoothWindow = 10;
        this.smoothMode = "causal"; // "causal" | "centered" | "none"

        eventBus.addEventListener("ui.requestSummaryRebuild", async (e) => {
            const { hierarchy } = e.detail;
            await this.rebuild(hierarchy);
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

    smoothSummary(results) {
        const window = this.smoothWindow;
        const mode = this.smoothMode;
        if (window <= 1 || mode === "none") return results;

        const n = results.length;
        // Snapshot the original scores so each smoothed value is computed
        // from raw inputs, not from previously-smoothed neighbors.
        const raw = results.map((r) => r.score);

        for (let i = 0; i < n; i++) {
            let lo, hi;
            if (mode === "centered") {
                const half = Math.floor(window / 2);
                lo = Math.max(0, i - half);
                hi = Math.min(n, i + half + 1);
            } else if (mode === "causal") {
                lo = Math.max(0, i - window + 1);
                hi = i + 1;
            } else {
                console.error(
                    `Unknown smoothMode: ${mode}; smoothing skipped`
                );
                return results;
            }
            let sum = 0;
            for (let j = lo; j < hi; j++) sum += raw[j];
            results[i].score = sum / (hi - lo);
        }
        return results;
    }

    async rebuild(hierarchy) {
        let hier = new Hierarchy(hierarchy);
        hierarchy = hier.toString("-");

        let summary = await this.create(hierarchy);
        //await this.saveToFirestore(hierarchy, summary);
        await this.saveToStorage(hierarchy, summary);
        return summary;
    }

    async create(hierarchy) {
        // Initialize a new scoring instance
        var scoring = new Score();

        // Load fragments and initalize the schedule
        let fragments;

        try {
            fragments = await scoring.getFragments(hierarchy);
            await scoring.initLoadSchedule(fragments);
        } catch (error) {
            console.error(`Error loading fragments for ${hierarchy}: ${error}`);
            return [];
        }

        scoring.resetWindow();
        await scoring.loadWindowFromSchedule(0);
        let scores = {};

        console.log("Creating summary...");
        var { closed, pct } = progress.show("Creating summary...");

        // Run through the fragments as if the video was playing 0.25 seconds
        // at a time. Disable per-tick live-UI smoothing for the duration so
        // bucket aggregation sees raw post-volatility currentScore (the
        // H017-validated max-then-smooth path).
        const prevLiveSmooth = scoring.liveSmoothEnabled;
        scoring.liveSmoothEnabled = false;
        try {
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
                        maxScore: 0,
                    });

                    // Accumulate the score
                    score.startTime = Math.min(score.startTime, newTime);
                    score.endTime = Math.max(score.endTime, newTime);
                    score.score += scoring.currentScore;
                    score.people += activeBoxManager.activeBoxes.length;
                    score.count += 1;
                    if (
                        Math.abs(scoring.currentScore) >
                        Math.abs(score.maxScore)
                    ) {
                        score.maxScore = scoring.currentScore;
                    }
                }
            }
        } finally {
            scoring.liveSmoothEnabled = prevLiveSmooth;
        }

        // Compute averages and format times
        for (const second in scores) {
            const score = scores[second];
            score.score = score.maxScore; //Math.round(score.score / score.count);
            score.people = Math.round(score.people / score.count);
            score.startTime = score.startTime.toFixed(2);
            score.endTime = score.endTime.toFixed(2);
        }

        // H017: post-bucket smoothing pass. `count` and `maxScore` pass
        // through unchanged; only `score` is smoothed.
        const result = this.smoothSummary(Object.values(scores));

        closed.val = true;
        return result;
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

    // getUrl(token, date, camera) {
    //     const urlPrefix = "https://storage.roarscore.ai/production/play/";
    //     // Make sure camera is zero padded two digits
    //     camera = parseInt(camera).toString().padStart(2, "0");

    //     return (
    //         `${urlPrefix}${token}/${date}/${camera}/` +
    //         `summary-${token}-${date}-${camera}.json`
    //     );
    // }

    async loadFromUrl(url) {
        //console.log(`Loading summary ${url}..`);
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

    // async loadAllFromUrl(hierarchy, cameras = 5) {
    //     console.log(`Loading summaries for ${hierarchy}...`);
    //     this.summaries = [];

    //     const [token, date] = hierarchy.split("-");
    //     for (let camera = 1; camera <= cameras; camera++) {
    //         const url = this.getSummaryUrl(token, date, camera);
    //         this.summaries.push(await this.loadSummary(url));
    //     }
    // }

    async loadFromStorage(hierarchy) {
        let h = new Hierarchy(hierarchy);
        let path = `summaries/${h.toFileOrEventString("/")}/summary-${h.toString("-")}.json`;

        try {
            // let storage = getStorage(app);
            // let storageRef = ref(storage, path);
            // let url = await getDownloadURL(storageRef);
            //console.log(`Loading summary from storage: ${hierarchy}...`);
            let url = await firebaseStorage.getDownloadUrl(path);

            return await this.loadFromUrl(url);
        } catch (error) {
            console.error(`Error loading from storage: ${error}`);
            return null;
        }
    }

    async saveToStorage(hierarchy, summary) {
        let h = new Hierarchy(hierarchy);
        let path = `summaries/${h.toFileOrEventString("/")}/summary-${h.toString("-")}.json`;

        console.log(`Saving summary to storage: ${path}...`);

        //let storage = getStorage(app);
        // let storageRef = ref(storage, path);
        // await uploadString(storageRef, JSON.stringify(summary));

        await firebaseStorage.uploadString(path, JSON.stringify(summary));

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
        //console.log(`Loading summary from firestore: ${hierarchy}...`);
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

    async ensure(hierarchy, cameras) {
        if (!hierarchy) {
            this.summaries = [];
            eventBus.fire("summarizer.ready");
            return this.summaries;
        }

        const hier = new Hierarchy(hierarchy);

        cameras = cameras || hier.type === "event" ? 5 : 1;

        console.log(`Ensuring summaries for ${hier.toFileOrEventString()}...`);

        var { closed, pct } = progress.show("Loading summaries..");

        this.summaries = [];
        for (let camera = 1; camera <= cameras; camera++) {
            hier.camera = camera;
            const h = hier.toString("-");

            let summary = await this.loadFromStorage(h);

            // if (!summary || !summary.length) {
            //     console.log(`Loading ${h} from firestore..`);
            //     summary = await this.loadFromFirestore(h);
            //     await this.saveToStorage(h, summary);
            // }

            if (!summary || !summary.length) {
                console.warn(
                    `SUMMARY ${h} MISSING.  CREATING.  THIS WILL TAKE AWHILE...`
                );

                summary = await this.create(h);
                //await this.saveToFirestore(h, summary);
                await this.saveToStorage(h, summary);
            }

            pct.val = (camera / cameras) * 100;
            this.summaries.push(summary);
        }

        hier.camera = 1;
        await this.ensureEventSummary(hier.toString(":"));

        closed.val = true;

        eventBus.fire("summarizer.ready");

        return this.summaries;
    }

    createCameraSummary(camera = 1) {
        const summary = this.summaries[camera - 1] || [];

        if (!summary.length) {
            return null;
        }

        const result = {
            totalScore: 0,
            totalPeople: 0,
            seconds: summary.length,
            averageScore: 0,
            averagePeople: 0,
            minScore: 99999,
            maxScore: -99999,
            minPeople: 99999,
            maxPeople: -99999,
        };

        for (const row of summary) {
            result.totalScore += row.score;
            result.totalPeople += row.people;
            result.minScore = Math.min(result.minScore, row.score);
            result.maxScore = Math.max(result.maxScore, row.score);
            result.minPeople = Math.min(result.minPeople, row.people);
            result.maxPeople = Math.max(result.maxPeople, row.people);
        }

        result.averageScore = Math.round(result.totalScore / result.seconds);
        result.averagePeople = Math.round(result.totalPeople / result.seconds);

        return result;
    }

    combineCameraSummaries(a, b) {
        const totalSeconds = a.seconds + b.seconds;

        a.totalPeople += b.totalPeople;
        a.totalScore += b.totalScore;
        a.seconds = Math.max(a.seconds, b.seconds);
        a.minScore = Math.min(a.minScore, b.minScore);
        a.maxScore = Math.max(a.maxScore, b.maxScore);
        a.minPeople = Math.min(a.minPeople, b.minPeople);
        a.maxPeople = Math.max(a.maxPeople, b.maxPeople);
        a.averageScore = Math.round(a.totalScore / totalSeconds);
        a.averagePeople = Math.round(a.totalPeople / totalSeconds);

        return a;
    }

    createEventSummary(relevantCameras = 4) {
        const summary = this.createCameraSummary(1);
        if (!summary) {
            return null;
        }

        for (let camera = 2; camera <= relevantCameras; camera++) {
            const camSummary = this.createCameraSummary(camera);
            if (camSummary) {
                this.combineCameraSummaries(summary, camSummary);
            }
        }

        summary.cameras = this.getCameraCount();

        return summary;
    }

    getCameraCount() {
        let count = 0;
        for (const summary of this.summaries) {
            if (summary && summary.length) {
                count++;
            }
        }
        return count;
    }

    async saveEventSummary(hierarchy, summary) {
        await eventsData.updateEventSummary(hierarchy, summary);
    }

    async rebuildEventSummary(hierarchy, relevantCameras = 4) {
        if (!this.summaries.length) {
            await this.ensure(hierarchy);
        }

        const summary = this.createEventSummary(hierarchy, relevantCameras);
        await this.saveEventSummary(hierarchy, summary);
        return summary;
    }

    async ensureEventSummary(hierarchy, relevantCameras = 4) {
        const event = await eventsData.getByHierarchy(hierarchy);
        if (event) {
            if (!event.summary) {
                console.log(`Event summary missing.  Rebuilding...`);
                return await this.rebuildEventSummary(
                    hierarchy,
                    relevantCameras
                );
            }
        }
    }
}

const summarizer = new Summarizer();

export { ProfilesData as P, Summarizer as S, activeBoxManager as a, scoring as b, profilesData as c, demographics as d, geomUtil as g, progress as p, summarizer as s };
//# sourceMappingURL=summarizer-Cc70FNiY.js.map
