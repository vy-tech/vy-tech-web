# Vy Tech Web

## Change History

For major changes requiring a plan review, append a dated entry to `HISTORY.md` with a concise few-sentence description of the change.

## Floating overlays above the video player

The video.js control bar uses `z-index: 1000 !important` and its container forms a stacking context. Floating tooltips/overlays that need to render above it (e.g. `src/viz/heatmapDetail.js`) must append themselves to `document.body` — a high z-index alone is not enough, because a child of an ancestor stacking context is clamped to that context's stacking position regardless of its own z-index.

## Reports page URL as permalink

`src/rsreports.js` mirrors the current hierarchy into `window.location` via `Reports.updateLocationBar()` (uses `history.replaceState`, not `pushState`, so the URL is a permalink/reload target and we don't have to handle `popstate`). The path format must stay compatible with `getHierarchyFromPath()`: preserve the first two path segments (`/reports`) and append `hierarchy.toString("/")`. The Express/functions routing is already set up to serve the reports SPA for any depth of hierarchy segments under `/reports`.
