import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { requireAuth } from "../common.js";

import { Storage } from "../../data/storage.js";
import { JobsData } from "../../data/jobs.js";
import { FilesData } from "../../data/files.js";

// Express app for development
const fileApp = express();

fileApp.use(express.json());
fileApp.use(requireAuth);

// Functions
function guessMimeType(filename) {
    const extension = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        pdf: "application/pdf",
        txt: "text/plain",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        mp4: "video/mp4",
        avi: "video/x-msvideo",
        mov: "video/quicktime",
        m4v: "video/x-m4v",
        mkv: "video/x-matroska",
    };
    return mimeTypes[extension] || "application/octet-stream";
}

fileApp.post("/process/:file_id", async (req, res) => {
    const { file_id } = req.params;
    const opts = req.body || {};

    const validOids = req.user.orgIds || [];
    validOids.push("personal_" + req.uid); // Always allow personal org

    if (!file_id) {
        console.warn("File ID not specified for processing");
        return res.status(400).json({
            error: "Bad Request",
            message: "File ID is required",
        });
    }

    const jobs = new JobsData();
    const files = new FilesData();

    let file = await files.getById(file_id);
    if (!file) {
        console.warn(`File with ID ${file_id} not found`);
        return res.status(404).json({
            error: "Not Found",
            message: "File not found",
        });
    }

    if (!validOids.includes(file.oid)) {
        console.warn(
            `User ${req.uid} attempted to process file ${file_id} in unauthorized org ${file.oid}`
        );
        return res.status(403).json({
            error: "Forbidden",
            message: "You do not have access to the specified organization",
        });
    }

    // Ensure context is "video" and type starts with "video/"
    if (file.context !== "video" || !file.type.startsWith("video/")) {
        console.warn(
            `File ${file_id} has unsupported context ${file.context} or type ${file.type} for processing`
        );
        return res.status(400).json({
            error: "Bad Request",
            message: "File context not supported for processing",
        });
    }

    try {
        const jobId = await jobs.queueJob(
            "file",
            file_id,
            "ProcessFootage",
            req.uid,
            file.oid,
            opts.location || null
        );
        console.log(
            `Queued processing job ${jobId} for file ${file_id} by user ${req.uid}`
        );

        await files.update(file_id, { job: jobId });

        return res.status(200).json({
            jobId,
            message: "Processing job queued successfully",
        });
    } catch (error) {
        console.error("Error queuing processing job:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to queue processing job",
        });
    }
});

fileApp.post("/upload/:path", async (req, res) => {
    // Returns a pre-signed URL allowing for upload to the specified path.
    // Upload paths are prefixed with /files/{orgId}/...
    // Request body is JSON and may include:
    //   mimeType: string (default: guessed from path)
    //   oid: organization ID to upload under (default: first valid org)

    const validOids = req.user.orgIds || [];
    validOids.push("personal_" + req.uid); // Always allow personal org

    const { path } = req.params;
    const opts = req.body || {};

    const mimeType = opts.mimeType || guessMimeType(path);
    const requestedOrgId = opts.oid || validOids[0];

    if (!path) {
        console.warn("Upload path not specified");
        return res.status(400).json({
            error: "Bad Request",
            message: "Upload path is required",
        });
    }

    if (!requestedOrgId || !validOids.includes(requestedOrgId)) {
        console.warn(
            `User ${req.uid} attempted upload to unauthorized org ${requestedOrgId}, valid orgs are `,
            validOids
        );
        return res.status(403).json({
            error: "Forbidden",
            message: "You do not have access to the specified organization",
        });
    }

    const remotePath = `files/${requestedOrgId}/${path}`;

    console.log(
        `Generating upload URL for user ${req.uid} to org ${requestedOrgId} at path ${remotePath} with mimeType ${mimeType}`
    );

    const storage = Storage.getInstance("firebase");

    try {
        const uploadUrl = await storage.createSignedUrl(
            remotePath,
            "PUT",
            15 * 60,
            mimeType
        );
        return res.status(200).json({
            uploadUrl,
            path,
            mimeType,
        });
    } catch (error) {
        console.error("Error generating upload URL:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to generate upload URL",
        });
    }
});

fileApp.post("/delete/:file_id", async (req, res) => {
    const validOids = req.user.orgIds || [];
    validOids.push("personal_" + req.uid); // Always allow personal org

    const { file_id } = req.params;

    if (!file_id) {
        return res.status(400).json({
            error: "Bad Request",
            message: "File ID is required",
        });
    }

    const files = new FilesData();
    const file = await files.getById(file_id);

    if (!file) {
        return res.status(404).json({
            error: "Not Found",
            message: "File not found",
        });
    }

    if (!validOids.includes(file.oid)) {
        console.warn(
            `User ${req.uid} attempted to delete file ${file_id} in unauthorized org ${file.oid}`
        );
        return res.status(403).json({
            error: "Forbidden",
            message: "You do not have access to the specified organization",
        });
    }

    try {
        await files.update(file_id, { deleteRequested: Date.now() });

        const jobs = new JobsData();
        const jobId = await jobs.queueJob(
            "file",
            file_id,
            "DeleteFootage",
            req.uid,
            file.oid
        );

        console.log(
            `Queued delete job ${jobId} for file ${file_id} by user ${req.uid}`
        );

        return res.status(200).json({
            jobId,
            message: "Delete job queued successfully",
        });
    } catch (error) {
        console.error("Error queuing delete job:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to queue delete job",
        });
    }
});

// Set up exports

const functionApp = express();
functionApp.use("/api/file", fileApp);

// Export for development server
export { fileApp };

console.log("Setting up Cloud Function export...");
// Export Cloud Function for production
export const file = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        invoker: "public",
        secrets: [],
    },
    functionApp
);
