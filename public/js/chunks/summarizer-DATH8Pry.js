import { g as getApp, d as database } from './db-BZQDImdW.js';
import { g as getAuth } from './index-35c79a8a-DBAtCsce.js';
import './index.esm2017-D8q59gHf.js';
import { S as Score, b as progress, a as activeBoxManager } from './annotations-ChiWH4zS.js';
import { e as eventBus } from './eventbus-B9JUr222.js';
import { H as Hierarchy, e as eventsData } from './hierarchy-DQ6298PP.js';

// ── Guards ──────────────────────────────────────────────────────────────────

async function requireFs() {
    try {
        return await import('node:fs');
    } catch {
        throw new Error("File system operations require a Node.js environment");
    }
}

function assertSecrets(secrets, className) {
    if (!secrets || !secrets.access_key) {
        throw new Error(
            `${className} requires credentials — not available in this context`
        );
    }
}

function assertAdminSdk(methodName) {
    if (typeof global === "undefined" || !global._vy_firebase_admin_sdk) {
        throw new Error(
            `${methodName}() requires Firebase Admin SDK — not available in this context`
        );
    }
}

// ── MIME type map ────────────────────────────────────────────────────────────

const MIME_TYPES = {
    ".mp4": "video/mp4",
    ".mov": "video/mp4",
    ".avi": "video/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".txt": "text/plain",
    ".json": "application/json",
};

// ── Lazy AWS SDK loader ──────────────────────────────────────────────────────

let _awsSdk = null;

async function loadAwsSdk() {
    if (_awsSdk) return _awsSdk;
    try {
        const [s3, presigner] = await Promise.all([
            import('@aws-sdk/client-s3'),
            import('@aws-sdk/s3-request-presigner'),
        ]);
        _awsSdk = {
            S3Client: s3.S3Client,
            GetObjectCommand: s3.GetObjectCommand,
            PutObjectCommand: s3.PutObjectCommand,
            ListObjectsV2Command: s3.ListObjectsV2Command,
            DeleteObjectCommand: s3.DeleteObjectCommand,
            getSignedUrl: presigner.getSignedUrl,
        };
        return _awsSdk;
    } catch {
        throw new Error(
            "AWS SDK not available. Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner"
        );
    }
}

// ── Base Storage class ───────────────────────────────────────────────────────

const configDefaults = {
    seaweed: {
        endpoint_url: "https://s.vy.vision/",
        region: "DefaultDataCenter",
    },
};

class Storage {
    static getInstance(storageType = "firebase", config = {}, secrets = {}) {
        config = { ...(configDefaults[storageType] || {}), ...config };
        if (storageType === "s3") return new S3Storage({ config, secrets });
        if (storageType === "minio")
            return new MinioStorage({ config, secrets });
        if (storageType === "seaweed")
            return new SeaweedStorage({ config, secrets });
        if (storageType === "firebase")
            return new FirebaseStorage({ config, secrets });
        if (storageType === "local")
            return new FileSystemStorage({ config, secrets });
        throw new Error(`Unsupported storage type: ${storageType}`);
    }

    constructor({ config, secrets } = {}) {
        this.config = config || null;
        this.secrets = secrets || null;
        this.storageType = "base";
    }

    async createSignedUrl(
        _remotePath,
        _method = "GET",
        _expiresIn = 3600,
        _contentType = null
    ) {
        throw new Error("createSignedUrl() must be implemented by subclass");
    }

    async listFiles(_remotePath) {
        throw new Error("listFiles() must be implemented by subclass");
    }

    async deleteFile(_remotePath) {
        throw new Error("deleteFile() must be implemented by subclass");
    }

    guessMimeType(filePath) {
        const dot = filePath.lastIndexOf(".");
        const ext = dot !== -1 ? filePath.slice(dot).toLowerCase() : "";
        return MIME_TYPES[ext] || "application/octet-stream";
    }

    _exponentialDelay(attempt) {
        return new Promise((resolve) =>
            setTimeout(resolve, 2 ** attempt * 1000)
        );
    }

    // ── Download (Node.js only) ──────────────────────────────────────────────

    async downloadFile(
        remotePath,
        localPath,
        progressCallback = null,
        retries = 10
    ) {
        const fs = await requireFs();

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                await this._downloadFileOnce(
                    remotePath,
                    localPath,
                    progressCallback,
                    fs
                );
                return;
            } catch (e) {
                console.log(
                    `Download attempt ${attempt + 1} failed: ${e.message}`
                );
                try {
                    fs.unlinkSync(localPath);
                } catch {
                    /* ignore cleanup errors */
                }
                if (attempt === retries - 1) throw e;
                await this._exponentialDelay(attempt);
            }
        }
    }

    async _downloadFileOnce(remotePath, localPath, progressCallback, fs) {
        console.log(
            `Downloading ${this.storageType}:${remotePath} to ${localPath}..`
        );

        const url = await this.createSignedUrl(remotePath, "GET");
        const resp = await fetch(url);
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

        const totalSize = parseInt(resp.headers.get("content-length") || "0");
        let downloadedSize = 0;
        let lastUpdateTime = Date.now();

        await new Promise((resolve, reject) => {
            const dest = fs.createWriteStream(localPath);
            dest.on("error", reject);
            dest.on("finish", resolve);

            const reader = resp.body.getReader();
            const pump = () => {
                reader
                    .read()
                    .then(({ done, value }) => {
                        if (done) {
                            dest.end();
                            return;
                        }
                        dest.write(Buffer.from(value));
                        downloadedSize += value.length;
                        const now = Date.now();
                        if (now - lastUpdateTime > 1000) {
                            const pct = totalSize
                                ? (downloadedSize / totalSize) * 100
                                : 0;
                            if (progressCallback) progressCallback(pct);
                            lastUpdateTime = now;
                        }
                        pump();
                    })
                    .catch(reject);
            };
            pump();
        });

        console.log(
            `Downloaded ${this.storageType}:${remotePath} to ${localPath}`
        );
    }

    // ── Upload from local file (Node.js only) ───────────────────────────────

    async uploadFile(
        localPath,
        remotePath,
        progressCallback = null,
        retries = 10
    ) {
        const fs = await requireFs();

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                await this._uploadFileOnce(
                    localPath,
                    remotePath,
                    progressCallback,
                    fs
                );
                return;
            } catch (e) {
                console.log(
                    `Upload attempt ${attempt + 1} failed: ${e.message}`
                );
                if (attempt === retries - 1) throw e;
                await this._exponentialDelay(attempt);
            }
        }
    }

    async _uploadFileOnce(localPath, remotePath, progressCallback, fs) {
        console.log(
            `Uploading ${localPath} to ${this.storageType}:${remotePath}..`
        );

        const contentType = this.guessMimeType(localPath);
        const url = await this.createSignedUrl(
            remotePath,
            "PUT",
            3600,
            contentType
        );

        const totalSize = fs.statSync(localPath).size;
        let sentSize = 0;
        let lastUpdateTime = Date.now();

        // Wrap the Node.js file stream in a web ReadableStream for fetch compatibility
        const nodeStream = fs.createReadStream(localPath, {
            highWaterMark: 1024 * 1024,
        });
        const body = new ReadableStream({
            start(controller) {
                nodeStream.on("data", (chunk) => {
                    sentSize += chunk.length;
                    const now = Date.now();
                    if (now - lastUpdateTime > 1000) {
                        const pct = totalSize
                            ? (sentSize / totalSize) * 100
                            : 0;
                        if (progressCallback) progressCallback(pct);
                        lastUpdateTime = now;
                    }
                    controller.enqueue(chunk);
                });
                nodeStream.on("end", () => controller.close());
                nodeStream.on("error", (e) => controller.error(e));
            },
        });

        const resp = await fetch(url, {
            method: "PUT",
            body,
            headers: { "Content-Type": contentType },
            duplex: "half",
        });

        if (!resp.ok)
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

        console.log(
            `Uploaded ${localPath} to ${this.storageType}:${remotePath}`
        );
    }

    async getAuthHeaders() {
        const user = getAuth().currentUser;
        if (!user) {
            throw new Error("User not authenticated");
        }

        const idToken = await user.getIdToken(true);
        return {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
        };
    }

    // Calls the /api/file/upload endpoint to get a presigned upload URL
    // Note that destinationPath should not include the filename, nor should it prefix
    // with the orgId, that is done automatically.  A valid destinationPath is just
    // a categorization like "videos".
    async requestUploadUrl(
        file,
        destinationPath,
        orgId = null,
        mimeType = null,
        storageType = "seaweed"
    ) {
        mimeType = mimeType || file.type;

        const body = {
            storage: storageType,
            mimeType,
            oid: orgId,
        };

        const path = `${destinationPath}/${file.name}`;
        const headers = await this.getAuthHeaders();
        const endpoint = `/api/file/upload/${encodeURIComponent(path)}`;

        const resp = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const errorData = await resp.json();
            throw new Error(
                `Failed to get upload URL: ${errorData.message || resp.statusText}`
            );
        }

        const data = await resp.json();
        return data.uploadUrl;
    }

    // ── Upload via presigned URL (browser + Node.js) ─────────────────────────
    // Use this in the browser after obtaining a presigned PUT URL from your backend.
    // Uses XHR for upload progress support.

    uploadToSignedUrl(
        presignedUrl,
        file,
        contentType,
        progressCallback = null
    ) {
        return new Promise((resolve, reject) => {
            if (typeof XMLHttpRequest !== "undefined") {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", presignedUrl);
                xhr.setRequestHeader("Content-Type", contentType);

                if (progressCallback) {
                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            progressCallback(
                                (event.loaded / event.total) * 100
                            );
                        }
                    };
                }

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(
                            new Error(`HTTP ${xhr.status}: ${xhr.statusText}`)
                        );
                    }
                };
                xhr.onerror = () =>
                    reject(new Error("Network error during upload"));
                xhr.send(file);
            } else {
                // Node.js fallback: fetch (no progress in this path)
                fetch(presignedUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": contentType },
                })
                    .then((resp) => {
                        if (!resp.ok)
                            throw new Error(
                                `HTTP ${resp.status}: ${resp.statusText}`
                            );
                        resolve();
                    })
                    .catch(reject);
            }
        });
    }
}

// ── S3Storage ────────────────────────────────────────────────────────────────

class S3Storage extends Storage {
    _clientOptions() {
        return {};
    }

    constructor({ config, secrets } = {}) {
        super({ config, secrets });
        this.storageType = "s3";

        assertSecrets(this.secrets, this.constructor.name);

        this.accessKeyId = this.secrets.access_key;
        this.secretKey = this.secrets.secret_key;
        this.bucketName = this.config?.bucket_name ?? null;

        // s3Client is initialized lazily on first use (requires async AWS SDK import)
        this._s3Client = null;
        this._s3ClientOptions = {
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretKey,
            },
            region: this.config?.region || "us-east-1",
            ...this._clientOptions(),
        };
    }

    async _ensureClient() {
        if (this._s3Client) return;
        const { S3Client } = await loadAwsSdk();

        this._s3Client = new S3Client(this._s3ClientOptions);
    }

    getBucketAndPrefix(remotePath) {
        if (this.bucketName) return [this.bucketName, remotePath];
        const slash = remotePath.indexOf("/");
        if (slash === -1) return [remotePath, ""];
        return [remotePath.slice(0, slash), remotePath.slice(slash + 1)];
    }

    async createSignedUrl(
        remotePath,
        method = "GET",
        expiresIn = 3600,
        contentType = null
    ) {
        await this._ensureClient();

        const sdk = await loadAwsSdk();

        const [bucket, key] = this.getBucketAndPrefix(remotePath);
        const params = {
            Bucket: bucket,
            Key: key,
        };
        if (contentType) params.ContentType = contentType;

        console.log(params);
        const command =
            method.toUpperCase() === "PUT"
                ? new sdk.PutObjectCommand(params)
                : new sdk.GetObjectCommand(params);

        const url = await sdk.getSignedUrl(this._s3Client, command, {
            expiresIn,
        });

        console.log(url);

        return url;
    }

    async listFiles(remotePath) {
        // Note: returns up to 1000 results — S3 API limit, no auto-pagination
        await this._ensureClient();
        const { ListObjectsV2Command } = await loadAwsSdk();

        const [bucket, prefix] = this.getBucketAndPrefix(remotePath);
        const response = await this._s3Client.send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
        );
        return (response.Contents || []).map((item) => item.Key);
    }

    async deleteFile(remotePath) {
        await this._ensureClient();
        const { DeleteObjectCommand } = await loadAwsSdk();

        const [bucket, key] = this.getBucketAndPrefix(remotePath);
        await this._s3Client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: key })
        );
        console.log(`File ${remotePath} deleted from ${this.storageType}`);
    }
}

// ── MinioStorage ─────────────────────────────────────────────────────────────

class MinioStorage extends S3Storage {
    _clientOptions() {
        return {
            endpoint: this.config.endpoint_url,
            forcePathStyle: true,
        };
    }

    constructor({ config, secrets } = {}) {
        super({ config, secrets });
        this.storageType = "minio";
    }
}

// ── SeaweedStorage ────────────────────────────────────────────────────────────

class SeaweedStorage extends S3Storage {
    _clientOptions() {
        return {
            endpoint: this.config.endpoint_url,
            forcePathStyle: true,
        };
    }

    constructor({ config, secrets } = {}) {
        super({ config, secrets });
        this.storageType = "seaweed";
    }
}

// ── FirebaseStorage ───────────────────────────────────────────────────────────

let _firebaseStorageFunctions = null;
let _firebaseStorageInstance = null;

async function initFirebaseStorage() {
    if (_firebaseStorageInstance) return;

    const app = await getApp();

    if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
        _firebaseStorageFunctions = global._vy_storage_functions;
        _firebaseStorageInstance = _firebaseStorageFunctions.getStorage();
    } else {
        const { getStorage, ref, uploadString, getDownloadURL } =
            await import('./index.esm-7Y3OjC-L.js');
        _firebaseStorageFunctions = {
            getStorage,
            ref,
            uploadString,
            getDownloadURL,
        };
        _firebaseStorageInstance = getStorage(app);
    }
}

class FirebaseStorage extends Storage {
    constructor({ config, secrets } = {}) {
        super({ config, secrets });
        this.storageType = "firebase";
    }

    async _ensureStorage() {
        await initFirebaseStorage();
    }

    async createSignedUrl(
        remotePath,
        method = "GET",
        expiresIn = 3600,
        contentType = null
    ) {
        assertAdminSdk("FirebaseStorage.createSignedUrl");
        const adminStorage = global._vy_storage_functions.getStorage();
        const bucket = adminStorage.bucket();
        const file = bucket.file(remotePath);
        const action = method.toUpperCase() === "PUT" ? "write" : "read";
        const [url] = await file.getSignedUrl({
            action,
            expires: Date.now() + expiresIn * 1000,
            ...(contentType ? { contentType } : {}),
        });
        return url;
    }

    async getDownloadUrl(path) {
        await this._ensureStorage();
        const fileRef = _firebaseStorageFunctions.ref(
            _firebaseStorageInstance,
            path
        );
        return await _firebaseStorageFunctions.getDownloadURL(fileRef);
    }

    async uploadString(path, data) {
        await this._ensureStorage();
        const fileRef = _firebaseStorageFunctions.ref(
            _firebaseStorageInstance,
            path
        );
        console.log(`Saving to storage: ${path}`);
        await _firebaseStorageFunctions.uploadString(fileRef, data);
    }

    async listFiles(remotePath) {
        assertAdminSdk("FirebaseStorage.listFiles");
        const adminStorage = global._vy_storage_functions.getStorage();
        const [files] = await adminStorage
            .bucket()
            .getFiles({ prefix: remotePath });
        return files.map((f) => f.name);
    }

    async deleteFile(remotePath) {
        assertAdminSdk("FirebaseStorage.deleteFile");
        const adminStorage = global._vy_storage_functions.getStorage();
        await adminStorage.bucket().file(remotePath).delete();
        console.log(`File ${remotePath} deleted from Firebase Storage`);
    }
}

// ── FileSystemStorage ─────────────────────────────────────────────────────────

class FileSystemStorage extends Storage {
    constructor({ config, secrets } = {}) {
        super({ config, secrets });
        this.storageType = "local";
        this.basePath = this.config?.base_path ?? "data";
    }

    async _ensureFs() {
        if (this._fs) return this._fs;
        this._fs = await requireFs();
        if (!this._fs.existsSync(this.basePath)) {
            this._fs.mkdirSync(this.basePath, { recursive: true });
        }
        return this._fs;
    }

    async createSignedUrl(
        remotePath,
        _method = "GET",
        _expiresIn = 3600,
        _contentType = null
    ) {
        await this._ensureFs();
        const path = await import('node:path');
        return `file://${path.join(this.basePath, remotePath)}`;
    }

    async listFiles(remotePath) {
        const fs = await this._ensureFs();
        const path = await import('node:path');

        const results = [];
        const walk = (dir) => {
            const dirPath = path.join(this.basePath, dir);
            if (!fs.existsSync(dirPath)) return;

            for (const entry of fs.readdirSync(dirPath)) {
                const entryPath = path.join(dirPath, entry);
                const entryRelative = path.join(dir, entry);
                if (fs.statSync(entryPath).isDirectory()) {
                    walk(entryRelative);
                } else {
                    results.push(entryRelative);
                }
            }
        };
        walk(remotePath);
        return results;
    }

    async deleteFile(remotePath) {
        const fs = await this._ensureFs();
        const path = await import('node:path');

        const filePath = path.join(this.basePath, remotePath);
        if (!fs.existsSync(filePath)) {
            console.log(`File ${remotePath} not found in FileSystemStorage`);
            return;
        }

        fs.unlinkSync(filePath);
        console.log(`File ${remotePath} deleted from FileSystemStorage`);

        // Clean up empty parent directories
        let dir = path.dirname(filePath);
        while (
            dir !== this.basePath &&
            fs.existsSync(dir) &&
            fs.readdirSync(dir).length === 0
        ) {
            fs.rmdirSync(dir);
            dir = path.dirname(dir);
        }
    }

    async _downloadFileOnce(remotePath, localPath, progressCallback, fs) {
        console.log(
            `Copying ${this.storageType}:${remotePath} to ${localPath}..`
        );
        const path = await import('node:path');

        const srcPath = remotePath.startsWith(this.basePath)
            ? remotePath
            : path.join(this.basePath, remotePath);

        if (!fs.existsSync(srcPath)) {
            throw new Error(`Source file ${srcPath} does not exist`);
        }

        const totalSize = fs.statSync(srcPath).size;
        let copiedSize = 0;
        let lastUpdateTime = Date.now();

        await new Promise((resolve, reject) => {
            const src = fs.createReadStream(srcPath, {
                highWaterMark: 1024 * 1024,
            });
            const dest = fs.createWriteStream(localPath);

            src.on("data", (chunk) => {
                copiedSize += chunk.length;
                const now = Date.now();
                if (now - lastUpdateTime > 250) {
                    const pct = totalSize ? (copiedSize / totalSize) * 100 : 0;
                    if (progressCallback) progressCallback(pct);
                    lastUpdateTime = now;
                }
            });
            src.on("error", reject);
            dest.on("error", reject);
            dest.on("finish", resolve);
            src.pipe(dest);
        });

        console.log(`Copied ${this.storageType}:${remotePath} to ${localPath}`);
    }

    async _uploadFileOnce(localPath, remotePath, progressCallback, fs) {
        console.log(
            `Copying ${localPath} to ${this.storageType}:${remotePath}..`
        );
        const path = await import('node:path');

        const destPath = remotePath.startsWith(this.basePath)
            ? remotePath
            : path.join(this.basePath, remotePath);

        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const totalSize = fs.statSync(localPath).size;
        let copiedSize = 0;
        let lastUpdateTime = Date.now();

        await new Promise((resolve, reject) => {
            const src = fs.createReadStream(localPath, {
                highWaterMark: 1024 * 1024,
            });
            const dest = fs.createWriteStream(destPath);

            src.on("data", (chunk) => {
                copiedSize += chunk.length;
                const now = Date.now();
                if (now - lastUpdateTime > 250) {
                    const pct = totalSize ? (copiedSize / totalSize) * 100 : 0;
                    if (progressCallback) progressCallback(pct);
                    lastUpdateTime = now;
                }
            });
            src.on("error", reject);
            dest.on("error", reject);
            dest.on("finish", resolve);
            src.pipe(dest);
        });

        console.log(`Copied ${localPath} to ${this.storageType}:${remotePath}`);
    }
}

// ── Singleton (Firebase, backward-compatible) ─────────────────────────────────

// DEPRECATED: Do not use in new code.  Use the storage singleton or Storage.getInstance().
let firebaseStorage = new FirebaseStorage();

let storage = Storage.getInstance();

if (typeof window !== "undefined") {
    window._vy_storage = storage;
}

class Summarizer {
    constructor() {
        this.currentCamera = 1;
        this.summaries = [];

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
        let scores = {};

        console.log("Creating summary...");
        var { closed, pct } = progress.show("Creating summary...");

        // Run through the fragments as if the video was playing 0.25 seconds
        // at a time.
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
                if (Math.abs(scoring.currentScore) > Math.abs(score.maxScore)) {
                    score.maxScore = scoring.currentScore;
                }
            }
        }

        // Compute averages and format times
        for (const second in scores) {
            const score = scores[second];
            score.score = score.maxScore; //Math.round(score.score / score.count);
            score.people = Math.round(score.people / score.count);
            score.startTime = score.startTime.toFixed(2);
            score.endTime = score.endTime.toFixed(2);
        }

        closed.val = true;

        return Object.values(scores);
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

    getUrl(token, date, camera) {
        const urlPrefix = "https://storage.roarscore.ai/production/play/";
        // Make sure camera is zero padded two digits
        camera = parseInt(camera).toString().padStart(2, "0");

        return (
            `${urlPrefix}${token}/${date}/${camera}/` +
            `summary-${token}-${date}-${camera}.json`
        );
    }

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

    async loadAllFromUrl(hierarchy, cameras = 5) {
        console.log(`Loading summaries for ${hierarchy}...`);
        this.summaries = [];

        const [token, date] = hierarchy.split("-");
        for (let camera = 1; camera <= cameras; camera++) {
            const url = this.getSummaryUrl(token, date, camera);
            this.summaries.push(await this.loadSummary(url));
        }
    }

    async loadFromStorage(hierarchy) {
        let [token, date, camera] = hierarchy.split("-");
        let path = `summaries/${token}/${date}/summary-${token}-${date}-${camera}.json`;

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
        let [token, date, camera] = hierarchy.split("-");
        let path = `summaries/${token}/${date}/summary-${token}-${date}-${camera}.json`;

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

    async ensure(hierarchy, cameras = 5) {
        if (!hierarchy) {
            this.summaries = [];
            eventBus.fire("summarizer.ready");
            return this.summaries;
        }

        const hier = new Hierarchy(hierarchy);

        console.log(`Ensuring summaries for ${hier.location}-${hier.date}...`);

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

export { Summarizer as S, storage as a, summarizer as s };
//# sourceMappingURL=summarizer-DATH8Pry.js.map
