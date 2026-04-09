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

## Next steps

- See the [Videos](/docs#videos) tab for upload, processing, and retrieval endpoints.
- See the [Events & Locations](/docs#events-locations) tab for querying locations and camera events.
- Upload your first video and poll `/api/v1/video/status/:fileId` to watch processing progress.
