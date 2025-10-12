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
            if (!profileData.scoring) {
                profileData.scoring = { ...defaultScoringParams };
            } else {
                // Merge with defaults to ensure all parameters exist
                profileData.scoring = {
                    ...defaultScoringParams,
                    ...profileData.scoring,
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

    async duplicate(sourceId, updates = {}) {
        /**
         * Duplicate an existing profile with optional updates.
         * @param {string} sourceId - The source profile ID
         * @param {Object} [updates={}] - Optional data to override in the duplicated profile
         * @returns {string|null} The new profile ID or null if failed
         */
        const sourceProfile = await database.get("profiles", sourceId);
        if (!sourceProfile) {
            console.error("Source profile not found:", sourceId);
            return null;
        }

        // Start with source profile data (excluding id, created, updated)
        const { id, created, updated, ...profileData } = sourceProfile;

        // Ensure scoring parameters exist with defaults
        if (!profileData.scoring) {
            profileData.scoring = { ...defaultScoringParams };
        } else {
            profileData.scoring = {
                ...defaultScoringParams,
                ...profileData.scoring,
            };
        }

        // Apply any updates, merging nested objects properly
        const duplicateData = {
            ...profileData,
            ...updates,
        };

        // Handle nested merging for emotions and scoring if they exist in updates
        if (updates.emotions) {
            duplicateData.emotions = {
                ...profileData.emotions,
                ...updates.emotions,
            };
        }
        if (updates.scoring) {
            duplicateData.scoring = {
                ...profileData.scoring,
                ...updates.scoring,
            };
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
         * @param {Object} [profileData.scoring] - Scoring parameters (will override defaults)
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
        if (updates.scoring && this.profile && this.profile.id === id) {
            updates.scoring = { ...this.profile.scoring, ...updates.scoring };
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
        return this.profile?.scoring || { ...defaultScoringParams };
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

        return await this.update(this.profile.id, { scoring: params });
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

    async setSelectorToAll(state) {
        const profiles = await this.getAll();
        state.val = profiles;
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
        const profileListState = van.state([]);
        this.setSelectorToAll(profileListState);

        const container = div({ class: "vyprofiles-selector" }, () => {
            const sel = select({
                id: "profile-select",
                class: "w-full text-black p-1",
            });

            profileListState.val.forEach((profileData) =>
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
export { profiles, Profiles, defaultScoringParams };
