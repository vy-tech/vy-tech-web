# Annotations

## Overview

The Annotations API lets you retrieve timestamped notes associated with video content. Annotations are categorized markers tied to specific moments in a video — for example, game actions, highlights, or transcription entries. Annotations are shared across all cameras for an event.

Each annotation includes time-mapping fields so you can locate the corresponding video chunk:

| Field            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `videoSeconds`   | Seconds from the start of the video                                |
| `minuteOfDay`    | The absolute minute of the day (UTC) that the annotation falls in  |
| `offsetSeconds`  | Remaining seconds within that minute (0–59)                        |

Base URL: `/api/v1`

---

## Authentication

Include your API key using either method:

```
X-API-Key: vyk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

or

```
Authorization: Bearer vyk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Event Annotations

### GET /event/:id/annotations

Returns all annotations for an event by document ID.

**Path parameters:**

| Param | Type   | Required | Description       |
| ----- | ------ | -------- | ----------------- |
| `:id` | string | yes      | Event document ID |

**Response `200`:**

```json
{
    "annotations": [
        {
            "id": "00W_jRjsoJXbXQRJqECC",
            "content": "Bases loaded. RBI Walk. Ballers go up 1-0 #ga #wga",
            "videoSeconds": 4146,
            "minuteOfDay": 1149,
            "offsetSeconds": 6,
            "type": "action",
            "importance": "critical",
            "tags": ["ga", "wga"],
            "updated": "2025-10-14T14:26:56.000Z"
        }
    ]
}
```

**Errors:** `404` if the event is not found; `403` if it belongs to a different organization.

---

### GET /event/:location_token/:date/annotations

Returns all annotations for an event by location token and date.

**Path parameters:**

| Param             | Type   | Required | Description                                  |
| ----------------- | ------ | -------- | -------------------------------------------- |
| `:location_token` | string | yes      | The location's token (e.g. `"raimondi"`)     |
| `:date`           | string | yes      | Date in `YYYYMMDD` format (e.g. `"20250711"`)|

**Response:** Same shape as `GET /event/:id/annotations` above.

**Errors:** `404` if no event matches the location token and date; `403` if it belongs to a different organization.

---

## Video Annotations

### GET /video/:id/annotations

Returns all annotations for a video by file ID or file token.

The endpoint first looks up the file by document ID. If no match is found, it falls back to a hierarchy-based lookup using the file token.

**Path parameters:**

| Param | Type   | Required | Description                   |
| ----- | ------ | -------- | ----------------------------- |
| `:id` | string | yes      | File document ID or file token|

**Response:** Same shape as `GET /event/:id/annotations` above.

**Errors:** `404` if the file is not found; `403` if it belongs to a different organization; `400` if the file has not been processed yet.
