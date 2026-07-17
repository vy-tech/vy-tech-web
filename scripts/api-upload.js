// Test harness for the Videos upload API.
//
// Usage:
//   VY_API_KEY=vyk_... node scripts/api-upload.js [--beta] [--location <loc>] <file>
//   echo vyk_... | node scripts/api-upload.js <file>
//
// The API key is read from VY_API_KEY, or from stdin if that is unset.
// The endpoint defaults to https://vy.vision/ (override with VY_ENDPOINT).
//
// Flow (see public/doc/vy-videos.md):
//   1. POST /api/v1/video/upload/request   -> uploadUrl + uploadToken
//   2. PUT file bytes to uploadUrl
//   3. POST /api/v1/video/upload/complete  -> fileId + jobId
//   4. Poll GET /api/v1/video/status/:fileId until completed/failed

import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

// Mirrors guessMimeType() in src/functions/v1/helpers.js
function guessMimeType(filename) {
    const extension = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
        mp4: "video/mp4",
        avi: "video/x-msvideo",
        mov: "video/quicktime",
        m4v: "video/x-m4v",
        mkv: "video/x-matroska",
    };
    return mimeTypes[extension] || "application/octet-stream";
}

function parseArgs(argv) {
    const args = { beta: false, location: null, file: null };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--beta") {
            args.beta = true;
        } else if (arg === "--location") {
            args.location = argv[++i] ?? null;
        } else if (arg.startsWith("--")) {
            fail(`Unknown option: ${arg}`);
        } else if (!args.file) {
            args.file = arg;
        } else {
            fail(`Unexpected argument: ${arg}`);
        }
    }
    return args;
}

function fail(message) {
    console.error(`Error: ${message}`);
    console.error(
        "Usage: node scripts/api-upload.js [--beta] [--location <loc>] <file>"
    );
    process.exit(1);
}

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8").trim();
}

async function getApiKey() {
    if (process.env.VY_API_KEY) return process.env.VY_API_KEY.trim();
    if (process.stdin.isTTY) {
        fail("VY_API_KEY is not set and no API key was piped in on stdin");
    }
    const key = await readStdin();
    if (!key) fail("No API key provided via VY_API_KEY or stdin");
    return key;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.file) fail("A file path is required");

    const fileInfo = await stat(args.file).catch(() => null);
    if (!fileInfo?.isFile()) fail(`Not a readable file: ${args.file}`);

    const apiKey = await getApiKey();
    const endpoint = (process.env.VY_ENDPOINT || "https://vy.vision/").replace(
        /\/+$/,
        ""
    );
    const baseUrl = `${endpoint}/api/v1`;

    const filename = basename(args.file);
    const mimeType = guessMimeType(filename);
    const jsonHeaders = {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
    };

    console.log(`Endpoint:  ${baseUrl}`);
    console.log(`File:      ${args.file} (${mimeType}, ${fileInfo.size} bytes)`);
    console.log(`Beta:      ${args.beta}`);
    if (args.location) console.log(`Location:  ${args.location}`);
    console.log();

    // 1. Request a signed upload URL.
    console.log("1/4 Requesting upload URL...");
    const requestRes = await fetch(`${baseUrl}/video/upload/request`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ filename, mimeType }),
    });
    const requestBody = await requestRes.json().catch(() => ({}));
    if (!requestRes.ok) {
        fail(
            `upload/request failed (${requestRes.status}): ${
                requestBody.message || JSON.stringify(requestBody)
            }`
        );
    }
    const { uploadUrl, uploadToken } = requestBody;
    console.log(`    uploadToken: ${uploadToken}`);

    // 2. PUT the file bytes directly to storage.
    console.log("2/4 Uploading file bytes...");
    const fileBytes = await readFile(args.file);
    const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: fileBytes,
    });
    if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        fail(`file PUT failed (${putRes.status}): ${text.slice(0, 500)}`);
    }
    console.log("    upload OK");

    // 3. Complete the upload and queue processing.
    console.log("3/4 Completing upload...");
    const completeRes = await fetch(`${baseUrl}/video/upload/complete`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
            uploadToken,
            location: args.location || undefined,
            betaPipeline: args.beta || undefined,
        }),
    });
    const completeBody = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok) {
        fail(
            `upload/complete failed (${completeRes.status}): ${
                completeBody.message || JSON.stringify(completeBody)
            }`
        );
    }
    const { fileId, jobId } = completeBody;
    console.log(`    fileId: ${fileId}`);
    console.log(`    jobId:  ${jobId}`);

    // 4. Poll processing status.
    console.log("4/4 Polling status (Ctrl-C to stop)...");
    let status = "requested";
    while (status !== "completed" && status !== "failed") {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`${baseUrl}/video/status/${fileId}`, {
            headers: jsonHeaders,
        });
        const statusBody = await statusRes.json().catch(() => ({}));
        if (!statusRes.ok) {
            fail(
                `status failed (${statusRes.status}): ${
                    statusBody.message || JSON.stringify(statusBody)
                }`
            );
        }
        const job = statusBody.jobs?.[0];
        status = job?.status ?? "requested";
        console.log(`    status: ${status}${job?.message ? ` — ${job.message}` : ""}`);
    }

    console.log();
    console.log(status === "completed" ? "Done." : "Processing failed.");
    process.exit(status === "completed" ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
