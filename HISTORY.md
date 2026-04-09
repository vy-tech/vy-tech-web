# Change History

## 2026-04-09
Restructured API documentation from a single "API Reference" tab into three tabs: Getting Started, Videos, and Events & Locations. Documented the new `GET /videos`, `GET /video/:id`, `GET /locations`, `GET /events`, and event detail endpoints. Removed the old monolithic `vy-api-v1.md`.

## 2026-04-09
Added detailed event fetch endpoints: `GET /event/:id[/:camera]` (by document ID) and `GET /event/:location_token/:date[/:camera]` (by location token and date). Both return the full event with chunks, playlists, and summary URL. Camera defaults to "01". Mounted the events router at both `/event` and `/events`.

## 2026-04-09
Added a `GET /api/v1/videos` endpoint that lists all videos for the authenticated org with minimal metadata (no chunks query). Mounted the video router under both `/video` and `/videos` so all existing endpoints are accessible via either path prefix.

## 2026-04-09
Moved the video results endpoint from `/video/results/:id` to `/video/:id` and added support for querying by file token in addition to document ID. The endpoint now falls back to a hierarchy-based lookup (`org_token:video:file_token`) when a document ID match is not found.

## 2026-04-09
Refactored `src/functions/v1/index.js` into sub-modules: `helpers.js`, `middleware.js`, and route files under `routes/` (video, fetch, locations, events). The main `index.js` is now a thin wiring file that mounts the routers and exports the Cloud Function.

## 2026-04-09
Implemented `GET /locations` and `GET /events` endpoints in the v1 API. The locations endpoint returns all locations for the authenticated org with their associated cameras. The events endpoint returns events filtered by status (defaults to "available") and optionally by location, which can be specified by ID or token. Added `getByToken` to `LocationsData` and `getByOrg` to `EventsData` to support the new query patterns.

## 2026-04-07
Added Google authentication support to the login UI. Users can now sign in with their Google account via Firebase Authentication in addition to the existing email/password method. A "Sign in with Google" button was added to the login form using Firebase's `signInWithPopup` flow.
