import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

import { createHmac } from "crypto";

import { ApiKeysData } from "../../data/apiKeys.js";
import { FilesData } from "../../data/files.js";
import { JobsData } from "../../data/jobs.js";
import { OrganizationsData } from "../../data/organizations.js";
import { UploadsData } from "../../data/uploads.js";
import { ChunksData } from "../../data/chunk.js";
import { Storage } from "../../data/storage.js";
import { orgContext } from "../../data/orgContext.js";
import Hierarchy from "../../util/hierarchy.js";

const keyHashHmacSecret = defineSecret("KEY_HASH_HMAC_SECRET");

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSecrets() {
    return {
        keyHashHmacSecret:
            process.env.KEY_HASH_HMAC_SECRET || keyHashHmacSecret.value(),
    };
}

function getUploadStorage() {
    return Storage.getInstance("firebase");
}

function guessMimeType(filename) {
    const extension = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        pdf: "application/pdf",
        txt: "text/plain",
        mp4: "video/mp4",
        avi: "video/x-msvideo",
        mov: "video/quicktime",
        m4v: "video/x-m4v",
        mkv: "video/x-matroska",
    };
    return mimeTypes[extension] || "application/octet-stream";
}

// ── Auth middleware ──────────────────────────────────────────────────────────

async function requireApiKey(req, res, next) {
    // Accept X-API-Key header or Authorization: Bearer vyk_...
    let key = req.headers["x-api-key"];
    if (!key) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer vyk_")) {
            key = authHeader.slice(7);
        }
    }

    if (!key?.startsWith("vyk_")) {
        return res
            .status(401)
            .json({ error: "Unauthorized", message: "Invalid API key" });
    }

    try {
        const { keyHashHmacSecret } = getSecrets();
        const keyHash = createHmac("sha256", keyHashHmacSecret)
            .update(key)
            .digest("hex");

        const apiKeysData = new ApiKeysData();
        const apiKey = await apiKeysData.getByHash(keyHash);

        if (!apiKey) {
            return res
                .status(401)
                .json({ error: "Unauthorized", message: "Invalid API key" });
        }

        if (apiKey.expires && Date.now() > apiKey.expires) {
            return res
                .status(401)
                .json({ error: "Unauthorized", message: "Invalid API key" });
        }

        req.apiKey = {
            id: apiKey.id,
            oid: apiKey.oid,
            application: apiKey.application,
            name: apiKey.name,
        };

        // Fire-and-forget last-used timestamp
        apiKeysData.update(apiKey.id, { used: Date.now() }).catch(() => {});

        // Set server-side org context for downstream data layer code
        const orgsData = new OrganizationsData();
        const org = await orgsData.getById(apiKey.oid);

        orgContext.run(
            {
                orgId: apiKey.oid,
                org: org || { id: apiKey.oid },
                userId: apiKey.uid || "api:" + apiKey.id,
            },
            () => next()
        );
    } catch (error) {
        console.error("API key auth error:", error);
        return res
            .status(401)
            .json({ error: "Unauthorized", message: "Invalid API key" });
    }
}

// ── Express app ─────────────────────────────────────────────────────────────

const v1App = express();

v1App.use(express.json());
v1App.use(requireApiKey);

const functionApp = express();
functionApp.use("/api/v1", v1App);

// Export for development server
export { v1App };

// ── Endpoints ───────────────────────────────────────────────────────────────

v1App.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// Returns a signed upload URL and an upload token for completing the upload.
v1App.post("/video/upload/request", async (req, res) => {
    let { filename, mimeType } = req.body || {};

    if (!filename) {
        return res
            .status(400)
            .json({ error: "Bad Request", message: "filename is required" });
    }

    mimeType = mimeType || guessMimeType(filename);
    if (!mimeType.startsWith("video/")) {
        return res.status(400).json({
            error: "Bad Request",
            message: "File does not appear to be a video",
        });
    }

    const oid = req.apiKey.oid;
    const destinationPath = "videos";
    const remotePath = `files/${oid}/${destinationPath}/${filename}`;

    try {
        const storage = getUploadStorage();
        const uploadUrl = await storage.createSignedUrl(
            remotePath,
            "PUT",
            15 * 60,
            mimeType
        );

        const uploads = new UploadsData();
        const uploadToken = await uploads.create({
            remotePath,
            filename,
            destinationPath,
            mimeType,
            oid,
            uid: req.apiKey.uid || "api:" + req.apiKey.id,
        });

        console.log(
            `Created upload URL for ${filename} (token: ${uploadToken}) by API key ${req.apiKey.id}`
        );

        return res.status(200).json({ uploadUrl, uploadToken });
    } catch (error) {
        console.error("Error creating upload URL:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to create upload URL",
        });
    }
});

// Completes an upload, saves a file record, and queues processing.
v1App.post("/video/upload/complete", async (req, res) => {
    const { uploadToken, location } = req.body || {};

    if (!uploadToken) {
        return res.status(400).json({
            error: "Bad Request",
            message: "uploadToken is required",
        });
    }

    try {
        const uploads = new UploadsData();
        const upload = await uploads.getById(uploadToken);

        if (!upload) {
            return res
                .status(404)
                .json({ error: "Not Found", message: "Upload not found" });
        }

        if (upload.oid !== req.apiKey.oid) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have access to this upload",
            });
        }

        // Save file record — orgContext is set by requireApiKey middleware
        const files = new FilesData();
        const fileId = await files.save(
            upload.filename,
            upload.destinationPath,
            "video",
            upload.mimeType
        );

        // Queue processing job
        const uid = req.apiKey.uid || "api:" + req.apiKey.id;
        const jobs = new JobsData();
        const jobId = await jobs.queueJob(
            "file",
            fileId,
            "ProcessFootage",
            uid,
            upload.oid,
            location || null
        );

        // Link job to file record
        await files.update(fileId, { job: jobId });

        // Clean up upload tracking record
        await uploads.delete(upload.id);

        console.log(
            `Completed upload for ${upload.filename}: fileId=${fileId}, jobId=${jobId}`
        );

        return res.status(200).json({
            fileId,
            jobId,
            message: "Upload complete, processing queued",
        });
    } catch (error) {
        console.error("Error completing upload:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to complete upload",
        });
    }
});

// Returns the status of a video file and its associated processing job(s).
v1App.get("/video/status/:id", async (req, res) => {
    const fileId = req.params.id;

    if (!fileId) {
        return res
            .status(400)
            .json({ error: "Bad Request", message: "File ID is required" });
    }

    try {
        const files = new FilesData();
        const file = await files.getById(fileId);

        if (!file) {
            return res
                .status(404)
                .json({ error: "Not Found", message: "File not found" });
        }

        if (file.oid !== req.apiKey.oid) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have access to this file",
            });
        }

        const jobs = new JobsData();
        const processJobs = await jobs.getByRef(
            "file",
            fileId,
            "ProcessFootage"
        );
        const rootJob = processJobs?.[0];

        let jobTree = [];
        if (rootJob) {
            jobTree = await jobs.getJobTree(rootJob.id);
        }

        return res.status(200).json({
            file: {
                id: file.id,
                filename: file.filename,
                context: file.context,
                type: file.type,
                created: file.created,
            },
            jobs: jobTree,
        });
    } catch (error) {
        console.error("Error fetching video status:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to fetch video status",
        });
    }
});

v1App.get("/fetch/:storage/*pathParts", async (req, res) => {
    const { storage, pathParts } = req.params;
    const path = pathParts.join("/");

    console.log(path);
    const storageMap = {
        1: "firebase",
        2: "minio",
        3: "seaweed",
    };
    const storageType = storageMap[storage] || storage;

    try {
        const storageInstance = Storage.getInstance(storageType);
        const url = await storageInstance.createSignedUrl(path, "GET", 3600);
        res.set("Cache-Control", "public, max-age=3600");
        res.set("Location", url);
        return res.status(302).end();
    } catch (error) {
        console.error("Error generating signed URL:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to generate signed URL",
        });
    }
});

const getFetchUrl = (storage, path) => {
    const storageMap = {
        firebase: 1,
        minio: 2,
        seaweed: 3,
    };

    if (!path) return null;
    if (!storage) return null;
    if (!storageMap[storage]) return null;

    return `/fetch/${storageMap[storage]}/${path}`;
};

// Gets the results of a processed video
v1App.get("/video/results/:id", async (req, res) => {
    const fileId = req.params.id;
    const storageMap = {
        firebase: 1,
        minio: 2,
        seaweed: 3,
    };

    if (!fileId) {
        return res
            .status(400)
            .json({ error: "Bad Request", message: "File ID is required" });
    }

    try {
        const files = new FilesData();
        const file = await files.getById(fileId);

        if (!file) {
            return res
                .status(404)
                .json({ error: "Not Found", message: "File not found" });
        }

        if (file.oid !== req.apiKey.oid) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have access to this file",
            });
        }

        if (!file.hierarchy) {
            return res.status(400).json({
                error: "Bad Request",
                message: "File does not have processing results",
            });
        }

        const hierarchy = new Hierarchy(file.hierarchy);
        const chunkData = new ChunksData();
        const chunks = await chunkData.getByHierarchy(hierarchy);
        const chunkResult = chunks.map((chunk) => ({
            id: chunk.id,
            date: chunk.date,
            minuteOfDay: chunk.minuteOfDay,
            duration: chunk.duration,
            startTime: chunk.startTime,
            playbackMetadata: {
                segments: chunk.playbackSegments,
                durations: chunk.playbackDurations,
                bitrates: chunk.playbackBitrates,
                qualities: chunk.playbackQualities,
                prefix: chunk.playbackPrefix,
            },
            expressionsUrl: getFetchUrl(chunk.storage, chunk.expressionsPath),
            demographicsUrl: getFetchUrl(chunk.storage, chunk.demographicsPath),
        }));

        const summaryPath =
            `summaries/${hierarchy.toFileOrEventString("/")}` +
            `/summary-${hierarchy.toString("-")}.json`;

        const summaryUrl = getFetchUrl("firebase", summaryPath);

        const result = {
            ...file,
            created: file.created.toDate().toISOString(),
            updated: file.updated.toDate().toISOString(),
            playlists: {
                "360p": `/playlist/${hierarchy.toString("-")}-360p.m3u8`,
                "720p": `/playlist/${hierarchy.toString("-")}-720p.m3u8`,
                "1080p": `/playlist/${hierarchy.toString("-")}-1080p.m3u8`,
                "4k": `/playlist/${hierarchy.toString("-")}-4k.m3u8`,
            },
            chunks: chunkResult,
            summaryUrl,
        };

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching video results:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to fetch video results",
        });
    }
});

// ── Cloud Function export ───────────────────────────────────────────────────

console.log("Setting up Cloud Function export...");
export const v1 = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        invoker: "public",
        secrets: [keyHashHmacSecret],
    },
    functionApp
);
