import { Router } from "express";

import { FilesData } from "../../../data/files.js";
import { JobsData } from "../../../data/jobs.js";
import { UploadsData } from "../../../data/uploads.js";
import { ChunksData } from "../../../data/chunk.js";
import Hierarchy from "../../../util/hierarchy.js";
import { orgContext } from "../../../data/orgContext.js";
import {
    getUploadStorage,
    guessMimeType,
    getFetchUrl,
    buildAnnotationsResponse,
} from "../helpers.js";

const router = Router();

// Lists all videos for the authenticated org (minimal metadata, no chunks).
router.get("/", async (req, res) => {
    try {
        const files = new FilesData();
        const videos = await files.getByOrgAndContext(req.apiKey.oid, "video");

        const result = (videos || []).map((file) => ({
            id: file.id,
            filename: file.filename,
            token: file.token,
            hierarchy: file.hierarchy,
            created: file.created?.toDate?.()?.toISOString() ?? file.created,
            updated: file.updated?.toDate?.()?.toISOString() ?? file.updated,
        }));

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error listing videos:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to list videos",
        });
    }
});

// Returns a signed upload URL and an upload token for completing the upload.
router.post("/upload/request", async (req, res) => {
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
router.post("/upload/complete", async (req, res) => {
    const { uploadToken, location, betaPipeline } = req.body || {};

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

        if (betaPipeline) {
            const org = orgContext.getCurrentOrg();
            if (!org?.flags?.betaPipeline) {
                return res.status(403).json({
                    error: "Forbidden",
                    message:
                        "Beta pipeline access is not enabled for your organization",
                });
            }
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
            location || null,
            betaPipeline ? { beta: true } : null
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
router.get("/status/:id", async (req, res) => {
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

// Get annotations for a video by file ID or file token
router.get("/:id/annotations", async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res
            .status(400)
            .json({ error: "Bad Request", message: "File ID is required" });
    }

    try {
        const files = new FilesData();
        let file = await files.getById(id);

        if (!file) {
            const org = orgContext.getCurrentOrg();
            const orgToken = org?.token || req.apiKey.oid;
            file = await files.getByHierarchy(`${orgToken}:video:${id}`);
        }

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

        const result = await buildAnnotationsResponse(file.hierarchy);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching annotations:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to fetch annotations",
        });
    }
});

// Gets the results of a processed video
router.get("/:id", async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res
            .status(400)
            .json({ error: "Bad Request", message: "File ID is required" });
    }

    try {
        const files = new FilesData();
        let file = await files.getById(id);

        if (!file) {
            const org = orgContext.getCurrentOrg();
            const orgToken = org?.token || req.apiKey.oid;
            file = await files.getByHierarchy(`${orgToken}:video:${id}`);
        }

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
            videoUrl: getFetchUrl(chunk.storage, chunk.path),
        }));

        const summaryPath =
            `summaries/${hierarchy.toFileOrEventString("/")}` +
            `/summary-${hierarchy.toString("-")}.json`;

        const summaryUrl = getFetchUrl("firebase", summaryPath);

        const result = {
            ...file,
            created: file.created?.toDate().toISOString(),
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

export default router;
