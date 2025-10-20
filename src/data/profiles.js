import van from "vanjs-core";
import { database } from "./db.js";
import { eventBus } from "../eventbus.js";

const defaultProfileId = "BkBUQq4GiSfuwHN7YrK3";

// Default scoring parameters based on rssettings.js
const defaultScoringParams = {
    softmaxAlpha: 0.01,
    combineSoftmaxAlpha: 0.005,
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

class Profiles {
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

    async setSelectorToAll() {
        const profiles = await this.getAll();
        this.profileListState.val = profiles;
    }

    createOptionElement(profileData, selected) {
        const { option } = van.tags;

        const displayName = profileData.name || "Unnamed Profile";
        const displayDescription = profileData.description
            ? ` - ${profileData.description}`
            : "";
        const displayText = `${displayName}${displayDescription}`;

        return option(
            {
                value: profileData.id,
                selected: profileData.id == selected,
            },
            displayText
        );
    }

    createSelectorElement(selected) {
        const { div, select } = van.tags;
        this.profileListState = van.state([]);
        this.setSelectorToAll();

        const container = div({ class: "vyprofiles-selector" }, () => {
            const sel = select({
                id: "profile-select",
                class: "w-full text-black p-1",
            });

            this.profileListState.val.forEach((profileData) =>
                van.add(sel, this.createOptionElement(profileData, selected))
            );

            sel.addEventListener("change", (e) => {
                eventBus.dispatchEvent(
                    new CustomEvent("ui.requestProfile", {
                        detail: e.target.value,
                    })
                );
            });

            return sel;
        });

        return container;
    }
}

const profiles = new Profiles();
export default profiles;
export { profiles, Profiles, defaultScoringParams, defaultEmotionWeights };
