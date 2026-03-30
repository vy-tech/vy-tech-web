import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { requireAuth } from "../common.js";

import { Storage } from "../../data/storage.js";
import { JobsData } from "../../data/jobs.js";
import { FilesData } from "../../data/files.js";

const storageAccessKeySeaweed = defineSecret("STORAGE_ACCESS_KEY_SEAWEED");
const storageSecretKeySeaweed = defineSecret("STORAGE_SECRET_KEY_SEAWEED");

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

function getSecrets(storageType) {
    const secrets = {};
    if (storageType === "seaweed") {
        secrets.access_key =
            process.env.STORAGE_ACCESS_KEY_SEAWEED ||
            storageAccessKeySeaweed.value();
        secrets.secret_key =
            process.env.STORAGE_SECRET_KEY_SEAWEED ||
            storageSecretKeySeaweed.value();
    }
    return secrets;
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

fileApp.post("/upload/multipart/complete", async (req, res) => {
    // Completes a multipart upload.
    // Request body must include:
    //   uploadId: string
    //   path: string — same path used when initiating the upload
    //   parts: Array<{ PartNumber: number, ETag: string }>
    //   oid: organization ID (default: first valid org)
    //   storage: "seaweed" | "s3" (default: "seaweed")

    const validOids = req.user.orgIds || [];
    validOids.push("personal_" + req.uid);

    const opts = req.body || {};
    const { uploadId, path, parts, storage: storageType = "seaweed" } = opts;
    const requestedOrgId = opts.oid || validOids[0];
    const secrets = getSecrets(storageType);

    if (!uploadId || !path || !Array.isArray(parts) || parts.length === 0) {
        return res
            .status(400)
            .json({
                error: "Bad Request",
                message: "uploadId, path, and parts are required",
            });
    }

    if (!requestedOrgId || !validOids.includes(requestedOrgId)) {
        console.warn(
            `User ${req.uid} attempted to complete multipart upload for unauthorized org ${requestedOrgId}`
        );
        return res
            .status(403)
            .json({
                error: "Forbidden",
                message: "You do not have access to the specified organization",
            });
    }

    const remotePath = `files/${requestedOrgId}/${path}`;
    console.log(
        `Completing multipart upload for user ${req.uid} at path ${remotePath} with ${parts.length} parts`
    );

    const storage = Storage.getInstance(storageType, {}, secrets);

    try {
        await storage.completeMultipartUpload(remotePath, uploadId, parts);
        return res
            .status(200)
            .json({ message: "Multipart upload completed successfully" });
    } catch (error) {
        console.error("Error completing multipart upload:", error);
        return res
            .status(500)
            .json({
                error: "Internal Server Error",
                message: "Failed to complete multipart upload",
            });
    }
});

fileApp.post("/upload/multipart/:path", async (req, res) => {
    // Initiates an S3 multipart upload and returns the uploadId.
    // Request body may include:
    //   storage: "seaweed" | "s3" (default: "seaweed")
    //   mimeType: string (default: guessed from path)
    //   oid: organization ID (default: first valid org)

    const validOids = req.user.orgIds || [];
    validOids.push("personal_" + req.uid);

    const { path } = req.params;
    const opts = req.body || {};

    const storageType = opts.storage || "seaweed";
    const mimeType = opts.mimeType || guessMimeType(path);
    const requestedOrgId = opts.oid || validOids[0];
    const secrets = getSecrets(storageType);

    if (!path) {
        return res
            .status(400)
            .json({ error: "Bad Request", message: "Upload path is required" });
    }

    if (!requestedOrgId || !validOids.includes(requestedOrgId)) {
        console.warn(
            `User ${req.uid} attempted multipart upload to unauthorized org ${requestedOrgId}`
        );
        return res
            .status(403)
            .json({
                error: "Forbidden",
                message: "You do not have access to the specified organization",
            });
    }

    const remotePath = `files/${requestedOrgId}/${path}`;
    console.log(
        `Initiating multipart upload for user ${req.uid} to org ${requestedOrgId} at path ${remotePath}`
    );

    const storage = Storage.getInstance(storageType, {}, secrets);

    try {
        const { uploadId } = await storage.createMultipartUpload(
            remotePath,
            mimeType
        );
        return res.status(200).json({ uploadId, path, remotePath, mimeType });
    } catch (error) {
        console.error("Error initiating multipart upload:", error);
        return res
            .status(500)
            .json({
                error: "Internal Server Error",
                message: "Failed to initiate multipart upload",
            });
    }
});

fileApp.post("/upload/part", async (req, res) => {
    // Returns a presigned URL for uploading a single part of a multipart upload.
    // Request body must include:
    //   uploadId: string — the upload ID from /upload/multipart/:path
    //   path: string — same path used when initiating the upload
    //   partNumber: number — 1-indexed part number
    //   oid: organization ID (default: first valid org)
    //   storage: "seaweed" | "s3" (default: "seaweed")

    const validOids = req.user.orgIds || [];
    validOids.push("personal_" + req.uid);

    const opts = req.body || {};
    const {
        uploadId,
        path,
        partNumber,
        storage: storageType = "seaweed",
    } = opts;
    const requestedOrgId = opts.oid || validOids[0];
    const secrets = getSecrets(storageType);

    if (!uploadId || !path || !partNumber) {
        return res
            .status(400)
            .json({
                error: "Bad Request",
                message: "uploadId, path, and partNumber are required",
            });
    }

    if (!requestedOrgId || !validOids.includes(requestedOrgId)) {
        console.warn(
            `User ${req.uid} attempted part upload to unauthorized org ${requestedOrgId}`
        );
        return res
            .status(403)
            .json({
                error: "Forbidden",
                message: "You do not have access to the specified organization",
            });
    }

    const remotePath = `files/${requestedOrgId}/${path}`;
    const storage = Storage.getInstance(storageType, {}, secrets);

    try {
        const uploadUrl = await storage.createSignedPartUrl(
            remotePath,
            uploadId,
            partNumber,
            15 * 60
        );
        return res.status(200).json({ uploadUrl, partNumber });
    } catch (error) {
        console.error("Error generating part upload URL:", error);
        return res
            .status(500)
            .json({
                error: "Internal Server Error",
                message: "Failed to generate part upload URL",
            });
    }
});

fileApp.post("/upload/:path", async (req, res) => {
    // Returns a pre-signed URL allowing for upload to the specified path
    // The user must be authenticated and a have valid org membership to upload
    // Upload paths are prefixed with /files/{orgId}/...
    // Request body is JSON and may include:
    //   opts: {
    //     storage: "seaweed" | "s3" (default: "seaweed")
    //     mimeType: string (default: guessed from path)
    //     oid: organization ID to upload under (default: first valid org)
    //   }
    //

    const validOids = req.user.orgIds || [];
    validOids.push("personal_" + req.uid); // Always allow personal org

    const { path } = req.params;
    const opts = req.body || {};

    const storageType = opts.storage || "seaweed";
    const mimeType = opts.mimeType || guessMimeType(path);
    const requestedOrgId = opts.oid || validOids[0];
    const secrets = getSecrets(storageType);

    if (!path) {
        console.warn("Upload path not specified");
        return res.status(400).json({
            error: "Bad Request",
            message: "Upload path is required",
        });
    }

    // Check that user has access to the requested org
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

    let remotePath = `files/${requestedOrgId}/${path}`;

    console.log(
        `Generating upload URL for user ${req.uid} to org ${requestedOrgId} at path ${remotePath} with mimeType ${mimeType} using storage ${storageType}`
    );
    // Initialize storage object
    let storage = Storage.getInstance(storageType, {}, secrets);

    // Generate signed URL
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

fileApp.post("/delete/:path", async (req, res) => {
    const validOids = req.user.orgIds || [];
    validOids.push("personal_" + req.uid); // Always allow personal org

    const { path } = req.params;
    const opts = req.body || {};

    const storageType = opts.storage || "seaweed";
    const requestedOrgId = opts.oid || validOids[0];
    const secrets = getSecrets(storageType);

    if (!path) {
        console.warn("Delete path not specified");
        return res.status(400).json({
            error: "Bad Request",
            message: "Delete path is required",
        });
    }

    // Check that user has access to the requested org
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

    let remotePath = `files/${requestedOrgId}/${path}`;

    console.log(
        `Deleting file for user ${req.uid} in org ${requestedOrgId} at path ${remotePath} using storage ${storageType}`
    );
    // Initialize storage object
    let storage = Storage.getInstance(storageType, {}, secrets);

    // Delete the file
    try {
        await storage.deleteFile(remotePath);
        return res.status(200).json({
            message: "File deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting file:", error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to delete file",
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
        secrets: [storageAccessKeySeaweed, storageSecretKeySeaweed],
    },
    functionApp
);
