# Change History

## 2026-04-14
Reports page URL now reflects the current selection. `Reports.changeHierarchy()` calls a new `updateLocationBar()` helper that rewrites `window.location` via `history.replaceState` using the same path format `getHierarchyFromPath()` already parses (preserves the first two path segments, appends `hierarchy.toString("/")`). `replaceState` avoids polluting history and sidesteps `popstate` handling — the URL is purely a permalink/reload target, not a navigation step.

## 2026-04-14
Moved the `heatmapDetail` floating tooltip out of the report DOM tree and into `document.body` (inside `HeatmapDetail.createElement()`). The tooltip was trapped inside the video.js stacking context and couldn't float above `vjs-control-bar` (`z-index: 1000 !important`) no matter how high its own z-index went. Also bumped its class to `z-[10000]` and added a small `pt-2` to the Weighted Avg row in the emotions table.

## 2026-04-14
Promoted the temporary `showBoxDebug`/`hideBoxDebug` heatmap overlay in `src/rsreports.js` to a proper viz component at `src/viz/heatmapDetail.js`. The new `HeatmapDetail` class subscribes to `heatmap.mousemove` directly, builds its emotions table with VanJS tags instead of `innerHTML`, and renders as a compact `position: fixed` tooltip that tracks the cursor (flipping near viewport edges). Cores breakdown removed. `src/viz/heatmap.js` now also forwards `clientX`/`clientY` on the mousemove event so the tooltip can position itself.

## 2026-04-13
Follow-up on the TLA fix: reverted `vanjs-core` to a static import in `src/data/orgContext.js` and restored eager `van.state` field creation in the `BrowserOrgContext` constructor. The lazy load introduced a race — `src/ui/topbar.js` builds its DOM synchronously at module load (via `rsnav` → `nav.addElements()` → `topBar.addElements()`) and reads `orgContext.currentOrg.val` / `userOrgs.val` / `isLoading.val` / `currentOrgId.val` inside van render closures, which would crash reading `.val` of `null` before auth fired `orgContext.init(user)`. vanjs-core is safe to module-load in Node (no DOM side-effects), so the server v1 bundle tolerates it. `ServerOrgContext` still lazy-loads `node:async_hooks` to keep the module graph free of top-level await.

## 2026-04-13
Fixed `ERR_REQUIRE_ASYNC_MODULE` on Firebase Functions deploy. `src/data/orgContext.js` had top-level `await import(...)` for `vanjs-core` / `node:async_hooks`, which rollup preserved as TLA in the v1 bundle and broke Firebase's `require()`-based function loader. Moved both imports to lazy loads inside `BrowserOrgContext.init()` and `ServerOrgContext.run()` (via a new `_ensureAls()` helper), deferring reactive-state and `AsyncLocalStorage` instantiation to first use. `orgContext.run()` is now async, so `src/functions/v1/middleware.js` awaits it.

## 2026-04-10
Added annotation endpoints to the v1 API. Event annotations can be fetched by document ID (`GET /event/:id/annotations`) or by location token and date (`GET /event/:location_token/:date/annotations`). Video annotations can be fetched by file ID or token (`GET /video/:id/annotations`). Each annotation includes computed `minuteOfDay` and `offsetSeconds` fields derived from chunk timing data, along with `videoSeconds` (seconds from video start). Added "Annotations" documentation tab.

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
