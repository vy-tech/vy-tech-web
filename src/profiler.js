import { firestore, doc, getDoc } from "./rsdb.js";

class Profiler {
    constructor() {
        this.profile = null;
    }

    async loadFromFirestore(id) {
        /**
         * Load a profile by its ID.
         * @param {string} profileId - The ID of the profile to load.
         */

        var docRef = doc(firestore, "profiles", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log("Profile loaded:", docSnap.data());
            this.profile = docSnap.data();
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
