# Vy API v1

## Overview

The Vy API v1 allows programmatic access to video upload and processing functionality. All requests must be authenticated with an API key scoped to your organization.

Base URL: `/api/v1`

---

## Authentication

All endpoints require an API key. Keys are generated in the Vy settings dashboard and are scoped to a specific organization.

Include your key using either method:

```
X-API-Key: vyk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

or

```
Authorization: Bearer vyk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keys begin with the prefix `vyk_`. A key is shown only once when created and cannot be retrieved again.

**Error response when key is missing or invalid:**

```json
{ "error": "Unauthorized", "message": "Invalid API key" }
```

---

## Error format

All error responses follow this shape:

```json
{
    "error": "Error Type",
    "message": "Human-readable description"
}
```

| Status | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| 400    | Bad request — missing or invalid parameters              |
| 401    | Unauthorized — API key missing, invalid, or expired      |
| 403    | Forbidden — resource belongs to a different organization |
| 404    | Not found                                                |
| 500    | Internal server error                                    |
| 501    | Not yet implemented                                      |

---

## Endpoints

### GET /health

Health check. Does not require authentication.

**Response:**

```json
{ "status": "ok" }
```

---

### Video Upload

Uploading a video is a three-step process using multipart upload. This avoids body size limits and allows reliable upload of large files.

```
1. POST /video/upload/request   → get uploadId
2. POST /video/upload/part      → get presigned URL, upload bytes directly to storage
   (repeat for each ~5 MB chunk)
3. POST /video/upload/complete  → finalize, save record, queue processing
```

---

#### POST /video/upload/request

Initiates a multipart upload session. Returns an `uploadId` to use in subsequent calls.

**Request body:**

| Field      | Type   | Required | Description                                             |
| ---------- | ------ | -------- | ------------------------------------------------------- |
| `filename` | string | yes      | Original filename including extension (e.g. `game.mp4`) |
| `mimeType` | string | no       | MIME type. If omitted, guessed from the file extension. |

Supported video extensions: `mp4`, `mov`, `avi`, `m4v`, `mkv`

**Response `200`:**

```json
{
    "uploadId": "abc123..."
}
```

**Errors:** `400` if `filename` is missing or the file type is not a video.

---

#### POST /video/upload/part

Returns a short-lived presigned URL for uploading one part. After receiving the URL, PUT the raw bytes of that chunk directly to it — do not go through this API. Collect the `ETag` header from the storage response; you will need it in the complete step.

Parts must be at least 5 MB except for the final part. Use a chunk size of exactly 5 MB (`5 * 1024 * 1024` bytes) for all parts except the last.

**Request body:**

| Field        | Type   | Required | Description                                 |
| ------------ | ------ | -------- | ------------------------------------------- |
| `uploadId`   | string | yes      | The `uploadId` from `/video/upload/request` |
| `partNumber` | number | yes      | 1-indexed part number                       |

**Response `200`:**

```json
{
    "uploadUrl": "https://s.vy.vision/...",
    "partNumber": 1
}
```

Presigned URLs expire after **15 minutes**.

**Errors:** `400` if fields are missing; `404` if the upload session is not found; `403` if the session belongs to a different organization.

---

#### POST /video/upload/complete

Finalizes the multipart upload, creates a file record, and queues video processing. Returns the `fileId` you will use to poll status.

**Request body:**

| Field      | Type   | Required | Description                                                                       |
| ---------- | ------ | -------- | --------------------------------------------------------------------------------- |
| `uploadId` | string | yes      | The `uploadId` from `/video/upload/request`                                       |
| `parts`    | array  | yes      | Array of `{ PartNumber, ETag }` objects collected from each part upload, in order |
| `location` | string | no       | Optional location hint passed to the processing job                               |

**`parts` element:**

```json
{ "PartNumber": 1, "ETag": "\"abc123...\"" }
```

Note: ETags returned by storage are typically wrapped in quotes — include them as-is.

**Response `200`:**

```json
{
    "fileId": "0ABCxyz...",
    "jobId": "0DEFxyz...",
    "message": "Upload complete, processing queued"
}
```

**Errors:** `400` if `uploadId` or `parts` are missing/empty; `404` if the upload session is not found; `403` if the session belongs to a different organization.

---

### GET /video/status/:fileId

Returns the current status of a video file and its associated processing job(s). Poll this endpoint after calling `/video/upload/complete` to track processing progress.

**Path parameter:** `fileId` — the value returned by `/video/upload/complete`.

**Response `200`:**

```json
{
    "file": {
        "id": "0ABCxyz...",
        "filename": "game.mp4",
        "context": "video",
        "type": "video/mp4",
        "created": 1743296400000
    },
    "jobs": [
        {
            "id": "0DEFxyz...",
            "type": "ProcessFootage",
            "status": "processing",
            "message": "Extracting frames..."
        }
    ]
}
```

**Job statuses:**

| Status       | Description                                  |
| ------------ | -------------------------------------------- |
| `requested`  | Job queued, not yet started                  |
| `processing` | Actively being processed                     |
| `completed`  | Processing finished successfully             |
| `failed`     | Processing failed; see `message` for details |

**Errors:** `404` if the file is not found; `403` if it belongs to a different organization.

---

## Complete upload example

```js
const API_KEY = "vyk_...";
const BASE_URL = "https://vy.vision/v1/api/v1";
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

async function uploadVideo(file) {
    const headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
    };

    // 1. Initiate
    const { uploadId } = await fetch(`${BASE_URL}/video/upload/request`, {
        method: "POST",
        headers,
        body: JSON.stringify({ filename: file.name }),
    }).then((r) => r.json());

    // 2. Upload parts
    const numParts = Math.ceil(file.size / CHUNK_SIZE);
    const parts = [];

    for (let i = 0; i < numParts; i++) {
        const partNumber = i + 1;
        const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

        const { uploadUrl } = await fetch(`${BASE_URL}/video/upload/part`, {
            method: "POST",
            headers,
            body: JSON.stringify({ uploadId, partNumber }),
        }).then((r) => r.json());

        const uploadResp = await fetch(uploadUrl, {
            method: "PUT",
            body: chunk,
        });
        const etag = uploadResp.headers.get("ETag");
        parts.push({ PartNumber: partNumber, ETag: etag });
    }

    // 3. Complete
    const { fileId, jobId } = await fetch(`${BASE_URL}/video/upload/complete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ uploadId, parts }),
    }).then((r) => r.json());

    // 4. Poll status
    let status = "requested";
    while (status !== "completed" && status !== "failed") {
        await new Promise((r) => setTimeout(r, 3000));
        const { jobs } = await fetch(`${BASE_URL}/video/status/${fileId}`, {
            headers,
        }).then((r) => r.json());
        status = jobs[0]?.status ?? "requested";
        console.log("Status:", status, jobs[0]?.message ?? "");
    }

    return { fileId, jobId, status };
}
```
