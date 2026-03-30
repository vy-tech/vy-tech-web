# Getting Started

This guide walks you through setting up the Vy API so you can upload and process video programmatically. By the end you will have an organization, an application, an API key, and a working upload.

![Vy API Key Steps](/img/vy-api-key-steps.png)

---

## 1. Create or select an organization

Everything in Vy — applications, API keys, uploads, and processing jobs — is scoped to an **organization**. When you first sign in, a personal organization is created automatically using your account name.

To create a team organization:

1. Open the **navigation sidebar** and click the organization name at the top.
2. Select **Create Organization** and give it a name.
3. The new organization appears in the sidebar picker. Select it to switch context.

All resources you create from this point forward belong to the selected organization.

> **Tip:** Use your personal org for experimentation and a team org for shared projects. You can invite teammates to a team org from the Settings page.

---

## 2. Create an application

Applications represent a distinct integration or project that uses the Vy API. Each application can have its own set of API keys.

1. Navigate to **Settings**.
2. Under the **Applications** section, click **Create Application**.
3. Enter a name (e.g. "Stadium Pilot") and an optional description.
4. Click **Save**.

Your new application appears in the list and is ready for API key generation.

---

## 3. Generate an API key

API keys authenticate your requests to the Vy API. Keys are scoped to a specific application within your organization.

1. In **Settings**, find your application in the list.
2. Click **Generate Key** and give the key a name (e.g. "production", "dev-laptop").
3. Copy the key immediately — it is shown **only once** and cannot be retrieved later.

Keys use the prefix `vyk_` so they are easy to identify. Store the key securely; treat it like a password.

---

## 4. Verify authentication

Use the health-check endpoint to confirm your key is working before writing any upload code.

### cURL

```bash
curl -H "X-API-Key: vyk_YOUR_KEY_HERE" \
     https://app.vy.vision/api/v1/health
```

### Python

```python
import requests

resp = requests.get(
    "https://app.vy.vision/api/v1/health",
    headers={"X-API-Key": "vyk_YOUR_KEY_HERE"},
)
print(resp.json())  # {"status": "ok"}
```

### Node.js

```js
const resp = await fetch("https://app.vy.vision/api/v1/health", {
    headers: { "X-API-Key": "vyk_YOUR_KEY_HERE" },
});
console.log(await resp.json()); // { status: "ok" }
```

A successful response looks like:

```json
{ "status": "ok" }
```

If you receive `401 Unauthorized`, double-check that the key is correct and has not expired.

You can pass the key with either header format:

```
X-API-Key: vyk_...
```

or

```
Authorization: Bearer vyk_...
```

---

## 5. Upload a video

Video upload uses a **multipart upload** flow. Instead of sending the entire file in one request — which is unreliable for large files and subject to body-size limits — you split the file into chunks and upload each chunk directly to storage using short-lived presigned URLs.

The flow has three steps:

```
1.  POST /api/v1/video/upload/request   -->  get an uploadId
2.  POST /api/v1/video/upload/part      -->  get a presigned URL, PUT bytes to it
    (repeat for each chunk)
3.  POST /api/v1/video/upload/complete  -->  finalize and queue processing
```

### How it works

1. **Request an upload session.** Send the filename (and optionally the MIME type) to get back an `uploadId`. Supported formats: `mp4`, `mov`, `avi`, `m4v`, `mkv`.

2. **Upload parts.** Split the file into **5 MB** chunks (the last chunk can be smaller). For each chunk, call the part endpoint to get a presigned URL, then **PUT** the raw bytes directly to that URL. Collect the `ETag` header from each storage response.

3. **Complete the upload.** Send the `uploadId` and the array of `{ PartNumber, ETag }` objects. Vy finalizes the upload, creates a file record, and queues a `ProcessFootage` job. You get back a `fileId` and `jobId`.

Presigned URLs expire after **15 minutes**, so upload each part promptly after requesting its URL.

### Why multipart?

| Concern     | Multipart answer                                                  |
| ----------- | ----------------------------------------------------------------- |
| Large files | No single-request body limit to worry about                       |
| Reliability | A failed chunk can be retried without restarting the whole upload |
| Performance | Chunks can be uploaded in parallel for faster throughput          |

### Full example — Python

```python
import math
import time
import requests

API_KEY  = "vyk_YOUR_KEY_HERE"
BASE_URL = "https://app.vy.vision/api/v1"
CHUNK    = 5 * 1024 * 1024  # 5 MB

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}

filepath = "game-footage.mp4"

with open(filepath, "rb") as f:
    data = f.read()

filename = filepath.split("/")[-1]

# 1. Request upload
resp = requests.post(
    f"{BASE_URL}/video/upload/request",
    headers=headers,
    json={"filename": filename},
)
upload_id = resp.json()["uploadId"]

# 2. Upload parts
num_parts = math.ceil(len(data) / CHUNK)
parts = []

for i in range(num_parts):
    part_number = i + 1
    chunk = data[i * CHUNK : (i + 1) * CHUNK]

    resp = requests.post(
        f"{BASE_URL}/video/upload/part",
        headers=headers,
        json={"uploadId": upload_id, "partNumber": part_number},
    )
    upload_url = resp.json()["uploadUrl"]

    put_resp = requests.put(upload_url, data=chunk)
    etag = put_resp.headers["ETag"]
    parts.append({"PartNumber": part_number, "ETag": etag})
    print(f"  Part {part_number}/{num_parts} uploaded")

# 3. Complete
resp = requests.post(
    f"{BASE_URL}/video/upload/complete",
    headers=headers,
    json={"uploadId": upload_id, "parts": parts},
)
result = resp.json()
file_id = result["fileId"]
job_id  = result["jobId"]
print(f"Upload complete — fileId={file_id}, jobId={job_id}")

# 4. Poll for processing status
status = "requested"
while status not in ("completed", "failed"):
    time.sleep(3)
    resp = requests.get(f"{BASE_URL}/video/status/{file_id}", headers=headers)
    jobs = resp.json()["jobs"]
    status = jobs[0]["status"] if jobs else "requested"
    message = jobs[0].get("message", "") if jobs else ""
    print(f"  Status: {status} {message}")

print("Done!" if status == "completed" else "Processing failed.")
```

### Full example — Node.js

```js
import { readFileSync } from "fs";

const API_KEY = "vyk_YOUR_KEY_HERE";
const BASE_URL = "https://app.vy.vision/api/v1";
const CHUNK = 5 * 1024 * 1024; // 5 MB

const headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
};

const file = readFileSync("game-footage.mp4");
const filename = "game-footage.mp4";

// 1. Request upload
const { uploadId } = await fetch(`${BASE_URL}/video/upload/request`, {
    method: "POST",
    headers,
    body: JSON.stringify({ filename }),
}).then((r) => r.json());

// 2. Upload parts
const numParts = Math.ceil(file.length / CHUNK);
const parts = [];

for (let i = 0; i < numParts; i++) {
    const partNumber = i + 1;
    const chunk = file.subarray(i * CHUNK, (i + 1) * CHUNK);

    const { uploadUrl } = await fetch(`${BASE_URL}/video/upload/part`, {
        method: "POST",
        headers,
        body: JSON.stringify({ uploadId, partNumber }),
    }).then((r) => r.json());

    const putResp = await fetch(uploadUrl, { method: "PUT", body: chunk });
    const etag = putResp.headers.get("ETag");
    parts.push({ PartNumber: partNumber, ETag: etag });
    console.log(`  Part ${partNumber}/${numParts} uploaded`);
}

// 3. Complete
const { fileId, jobId } = await fetch(`${BASE_URL}/video/upload/complete`, {
    method: "POST",
    headers,
    body: JSON.stringify({ uploadId, parts }),
}).then((r) => r.json());

console.log(`Upload complete — fileId=${fileId}, jobId=${jobId}`);

// 4. Poll for processing status
let status = "requested";
while (status !== "completed" && status !== "failed") {
    await new Promise((r) => setTimeout(r, 3000));
    const { jobs } = await fetch(`${BASE_URL}/video/status/${fileId}`, {
        headers,
    }).then((r) => r.json());
    status = jobs[0]?.status ?? "requested";
    console.log(`  Status: ${status} ${jobs[0]?.message ?? ""}`);
}
```

---

## Multipart upload libraries

You do not have to implement chunking from scratch. These libraries handle splitting, presigned-URL uploads, retries, and parallel part uploads out of the box. They work well with any S3-compatible storage endpoint, which is what Vy uses under the hood.

### Python

| Library                                                          | Notes                                                                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [boto3](https://pypi.org/project/boto3/)                         | AWS SDK for Python. `S3Client.upload_fileobj` handles multipart automatically. Use a custom endpoint URL to point at Vy's storage. |
| [requests-toolbelt](https://pypi.org/project/requests-toolbelt/) | `MultipartEncoder` for streaming large request bodies without loading everything into memory.                                      |
| [aiohttp](https://pypi.org/project/aiohttp/)                     | Async HTTP client — useful for uploading parts concurrently with `asyncio.gather`.                                                 |

### Node.js

| Library                                                                                                                                             | Notes                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [@aws-sdk/client-s3](https://www.npmjs.com/package/@aws-sdk/client-s3) + [@aws-sdk/lib-storage](https://www.npmjs.com/package/@aws-sdk/lib-storage) | The `Upload` class from `@aws-sdk/lib-storage` handles multipart chunking, retries, and parallel uploads. |
| [axios](https://www.npmjs.com/package/axios)                                                                                                        | Popular HTTP client with built-in progress events — helpful for tracking upload progress per chunk.       |
| [p-limit](https://www.npmjs.com/package/p-limit)                                                                                                    | Concurrency limiter — useful for uploading parts in parallel with a cap (e.g. 4 at a time).               |

### Java

| Library                                                                                 | Notes                                                                                                                  |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [AWS SDK for Java v2](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/) | `S3AsyncClient` with `MultipartUpload` provides managed multipart uploads with configurable part size and parallelism. |
| [OkHttp](https://square.github.io/okhttp/)                                              | Lightweight HTTP client. Use `RequestBody` with a streaming source to PUT each chunk to the presigned URL.             |
| [Apache HttpClient 5](https://hc.apache.org/httpcomponents-client-5.4.x/)               | Mature HTTP client with connection pooling and async support for concurrent part uploads.                              |

### C# / .NET

| Library                                                                               | Notes                                                                                                            |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [AWSSDK.S3](https://www.nuget.org/packages/AWSSDK.S3)                                 | `TransferUtility.UploadAsync` manages multipart uploads, retries, and parallel parts automatically.              |
| [HttpClient](https://learn.microsoft.com/en-us/dotnet/api/system.net.http.httpclient) | Built-in .NET HTTP client. Use `StreamContent` to PUT chunks to presigned URLs without buffering the whole file. |
| [Polly](https://www.nuget.org/packages/Polly)                                         | Resilience library — wrap part uploads in retry policies to handle transient network failures gracefully.        |

---

## Next steps

- See the full [API Reference](/docs#api-reference) for detailed endpoint documentation, error codes, and job status values.
- Upload your first video and poll `/api/v1/video/status/:fileId` to watch processing progress.
