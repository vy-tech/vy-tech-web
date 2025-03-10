class RSObject extends EventTarget {
    constructor(rs) {
        super();

        this.rs = rs;
        this.lo = rs.lo;
    }

    get fb() {
        return RoarScore.firebase;
    }
    get db() {
        return this.fb.db;
    }
    get storage() {
        return this.fb.storage;
    }
    get auth() {
        return this.fb.auth;
    }

    // Creates a url for downloading a file stored in bucket/type/id/path
    async createDownloadUrl(path) {
        try {
            const fileRef = this.storage.ref(this.storage.instance, path);
            
            // Get the download URL
            const url = await this.storage.getDownloadURL(fileRef);
            
            return url;
        } 
        catch (error) {
            console.error("Error creating download URL:", error);
            throw error;
        }
    }

    async fetchData(path) {
        try {
            const url = await this.createDownloadUrl(path);
            const response = await fetch(url);
            const data = await response.json();
            return data;
        }
        catch (error) {
            console.error("Error fetching from storage:", error);
            throw error;
        }
    }
}
