# Events & Locations

## Overview

The Events & Locations API lets you query your organization's physical locations and their associated camera events. All requests must be authenticated with an API key scoped to your organization.

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

## Locations

### GET /locations

Lists all locations for the authenticated organization, including the cameras configured at each location.

**Response `200`:**

```json
{
    "locations": [
        {
            "id": "abc123",
            "token": "stadium-west",
            "name": "Stadium West Entrance",
            "address": "123 Main St",
            "city": "Austin",
            "state": "TX",
            "zip": "78701",
            "country": "US",
            "cameras": [
                {
                    "id": "cam1",
                    "name": "Lobby Camera",
                    "number": "01",
                    "type": "fixed"
                }
            ]
        }
    ]
}
```

---

## Events

### GET /events

Lists events for the authenticated organization, optionally filtered by status and location.

**Query parameters:**

| Param      | Type   | Default       | Description                                                        |
| ---------- | ------ | ------------- | ------------------------------------------------------------------ |
| `status`   | string | `"available"` | Filter by event status                                             |
| `location` | string | —             | Filter by location — accepts a location token or a document ID     |

**Response `200`:**

```json
{
    "events": [
        {
            "id": "evt123",
            "hierarchy": "stadium-west:20260409",
            "location": "loc456",
            "name": "Game Day",
            "status": "available",
            "begin": "2026-04-09T18:00:00.000Z",
            "end": "2026-04-09T21:00:00.000Z",
            "duration": 10800,
            "cameras": 2
        }
    ]
}
```

**Errors:** `404` if the specified location is not found.

---

### GET /events/:id/:camera

Returns full event details by document ID, including playback playlists, chunks with analysis data, and a summary URL.

**Path parameters:**

| Param    | Type   | Required | Description                          |
| -------- | ------ | -------- | ------------------------------------ |
| `:id`    | string | yes      | Event document ID                    |
| `:camera`| string | no       | Camera number (defaults to `"01"`)   |

**Response `200`:**

```json
{
    "id": "evt123",
    "hierarchy": "stadium-west:20260409",
    "location": "loc456",
    "name": "Game Day",
    "status": "available",
    "begin": "2026-04-09T18:00:00.000Z",
    "end": "2026-04-09T21:00:00.000Z",
    "summary": {
        "seconds": 10800,
        "cameras": 2
    },
    "playlists": {
        "360p": "/playlist/stadium-west-20260409-01-360p.m3u8",
        "720p": "/playlist/stadium-west-20260409-01-720p.m3u8",
        "1080p": "/playlist/stadium-west-20260409-01-1080p.m3u8",
        "4k": "/playlist/stadium-west-20260409-01-4k.m3u8"
    },
    "chunks": [
        {
            "id": "chunk1",
            "date": "20260409",
            "minuteOfDay": 1080,
            "duration": 60,
            "startTime": 0,
            "playbackMetadata": {
                "segments": [],
                "durations": [],
                "bitrates": [],
                "qualities": [],
                "prefix": "..."
            },
            "expressionsUrl": "/api/v1/fetch/1/path/to/expressions.json",
            "demographicsUrl": "/api/v1/fetch/1/path/to/demographics.json"
        }
    ],
    "summaryUrl": "/api/v1/fetch/1/summaries/.../summary-....json"
}
```

**Errors:** `404` if the event is not found; `403` if it belongs to a different organization.

---

### GET /events/:location_token/:date/:camera

Returns full event details by location token and date. This is an alternative to fetching by document ID when you know the location and date of the event.

**Path parameters:**

| Param             | Type   | Required | Description                                      |
| ----------------- | ------ | -------- | ------------------------------------------------ |
| `:location_token` | string | yes      | The location's token (e.g. `"stadium-west"`)     |
| `:date`           | string | yes      | Date in `YYYYMMDD` format (e.g. `"20260409"`)   |
| `:camera`         | string | no       | Camera number (defaults to `"01"`)               |

**Response:** Same shape as `GET /events/:id/:camera` above.

**Errors:** `404` if no event matches the location token and date; `403` if it belongs to a different organization.
