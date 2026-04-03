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

Uploading a video is a two-step process: request a signed upload URL, PUT the file directly to storage, then confirm the upload is complete.

```
1. POST /video/upload/request   → get uploadUrl and uploadToken
2. PUT file bytes to uploadUrl  → upload directly to storage
3. POST /video/upload/complete  → finalize, save record, queue processing
```

---

#### POST /video/upload/request

Returns a signed upload URL and an upload token. The signed URL allows you to PUT the entire file directly to storage. The upload token is used in the complete step.

**Request body:**

| Field      | Type   | Required | Description                                             |
| ---------- | ------ | -------- | ------------------------------------------------------- |
| `filename` | string | yes      | Original filename including extension (e.g. `game.mp4`) |
| `mimeType` | string | no       | MIME type. If omitted, guessed from the file extension. |

Supported video extensions: `mp4`, `mov`, `avi`, `m4v`, `mkv`

**Response `200`:**

```json
{
    "uploadUrl": "https://storage.googleapis.com/...",
    "uploadToken": "abc123..."
}
```

The `uploadUrl` expires after **15 minutes**. Upload the file by sending a `PUT` request with the raw file bytes directly to this URL. Set the `Content-Type` header to match the file's MIME type.

**Errors:** `400` if `filename` is missing or the file type is not a video.

---

#### POST /video/upload/complete

Confirms the upload, creates a file record, and queues video processing. Returns the `fileId` you will use to poll status.

**Request body:**

| Field         | Type   | Required | Description                                          |
| ------------- | ------ | -------- | ---------------------------------------------------- |
| `uploadToken` | string | yes      | The `uploadToken` from `/video/upload/request`       |
| `location`    | string | no       | Optional location hint passed to the processing job  |

**Response `200`:**

```json
{
    "fileId": "0ABCxyz...",
    "jobId": "0DEFxyz...",
    "message": "Upload complete, processing queued"
}
```

**Errors:** `400` if `uploadToken` is missing; `404` if the upload session is not found; `403` if the session belongs to a different organization.

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

async function uploadVideo(file) {
    const headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
    };

    // 1. Request upload URL
    const { uploadUrl, uploadToken } = await fetch(
        `${BASE_URL}/video/upload/request`,
        {
            method: "POST",
            headers,
            body: JSON.stringify({ filename: file.name }),
        }
    ).then((r) => r.json());

    // 2. Upload file directly to storage
    await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
    });

    // 3. Complete
    const { fileId, jobId } = await fetch(
        `${BASE_URL}/video/upload/complete`,
        {
            method: "POST",
            headers,
            body: JSON.stringify({ uploadToken }),
        }
    ).then((r) => r.json());

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
