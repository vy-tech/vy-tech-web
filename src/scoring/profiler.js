import { database } from "../data/db.js";

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
export default profiler;
export { profiler, Profiler };
