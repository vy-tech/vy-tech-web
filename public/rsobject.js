class RSObject extends EventTarget {
    constructor(rs) {
        super();

        this.rs = rs;
        this.fb = rs.fb;
        this.lo = rs.lo;
    }

    // Creates a url for downloading a file stored in bucket/type/id/path
    async createDownloadUrl(path) {
        try {
            const fileRef = this.fb.ref(this.fb.storage, path);
            
            // Get the download URL
            const url = await this.fb.getDownloadURL(fileRef);
            
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
