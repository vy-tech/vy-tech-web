import { database } from "./db.js";

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
export default profiles;
export { profiles, Profiles };
