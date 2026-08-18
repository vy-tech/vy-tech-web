// Dev harness for src/viz/crowdMap.js — NOT shipped in the app.
//
// Loads raw expressions samples, groups detections by frame, and drives the
// crowdMap viz imperatively from a time slider. Served standalone at
// /explore/crowdmap.html (see plan let-s-narrow-the-focus-rustling-wall.md).
// Mirrors the public/explore/synthetic-smoke.* precedent.

import { CrowdMap } from "./viz/crowdMap.js";

const DATASETS = {
    "calm-few": "/explore/expressions-calm-few.json",
    "cheering-many": "/explore/expressions-cheering-many.json",
};

// In "all 5 wedges" mode, each camera pulls from an independently-loaded
// dataset — a stand-in for real per-camera expression files. This demonstrates
// the multi-file path: the production feature will feed 5 distinct streams the
// same way, via crowdMap.setAllDetections({1: rowsA, 2: rowsB, ...}).
const ALL_ASSIGN = {
    1: "cheering-many",
    2: "calm-few",
    3: "cheering-many",
    4: "calm-few",
    5: "cheering-many",
};

const stageEl = document.getElementById("stage");
const datasetEl = document.getElementById("dataset");
const cameraEl = document.getElementById("camera");
const frameEl = document.getElementById("frame");
const frameVEl = document.getElementById("frameV");
const statusEl = document.getElementById("status");
const readoutEl = document.getElementById("readout");

// Fresh instance (not the singleton) so the harness owns its own canvas.
const crowdMap = new CrowdMap();
stageEl.appendChild(crowdMap.createElement());

// Exposed so headless tests can drive the viz directly (sequence/scrub paths
// that the sample-file UI doesn't exercise).
window._vy_crowdMap = crowdMap;

// name -> sorted [{ frame, time, rows }] for every loaded dataset.
const loaded = {};

function setStatus(msg) {
    statusEl.textContent = msg;
}

// Group a flat detection array into per-frame buckets, sorted by frame.
function groupByFrame(rows) {
    const byFrame = new Map();
    for (const row of rows) {
        const key = row.frame;
        if (!byFrame.has(key)) {
            byFrame.set(key, { frame: key, time: row.time, rows: [] });
        }
        byFrame.get(key).rows.push(row);
    }
    return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
}

// Bucket for a dataset at a slider index, clamped to its own length (datasets
// differ in frame count, so each camera clamps independently).
function bucketAt(name, index) {
    const frames = loaded[name];
    if (!frames || !frames.length) return null;
    return frames[Math.min(index, frames.length - 1)];
}

function render(index) {
    const sel = cameraEl.value;

    if (sel === "all") {
        const byCam = {};
        let total = 0;
        for (let cam = 1; cam <= 5; cam++) {
            const bucket = bucketAt(ALL_ASSIGN[cam], index);
            const rows = bucket ? bucket.rows : [];
            byCam[cam] = rows;
            total += rows.length;
        }
        crowdMap.setAllDetections(byCam);
        frameVEl.textContent = `frame index ${index}`;
        readoutEl.textContent =
            `5 wedges (per-camera datasets) · ${total} people total`;
        return;
    }

    const bucket = bucketAt(datasetEl.value, index);
    const rows = bucket ? bucket.rows : [];
    crowdMap.setAllDetections({ [parseInt(sel, 10)]: rows });

    let sum = 0;
    for (const row of rows) sum += crowdMap.rowScore(row);
    const mean = rows.length ? sum / rows.length : 0;

    frameVEl.textContent = bucket
        ? `${bucket.time.toFixed(2)}s (frame ${bucket.frame})`
        : `frame index ${index}`;
    readoutEl.textContent =
        `cam ${sel} · ${rows.length} people · mean sentiment ${mean.toFixed(0)}`;
}

async function loadDataset(name) {
    if (loaded[name]) return;
    const res = await fetch(DATASETS[name]);
    if (!res.ok) throw new Error(`fetch ${name}: ${res.status}`);
    loaded[name] = groupByFrame(await res.json());
}

function maxFrames() {
    return Math.max(0, ...Object.values(loaded).map((f) => f.length));
}

async function boot() {
    setStatus("loading datasets…");
    frameEl.disabled = true;
    try {
        // Preload every dataset so "all" mode can mix them per camera.
        await Promise.all(Object.keys(DATASETS).map(loadDataset));

        frameEl.min = 0;
        frameEl.max = Math.max(0, maxFrames() - 1);
        frameEl.value = 0;
        frameEl.disabled = false;

        const summary = Object.entries(loaded)
            .map(([n, f]) => `${n}: ${f.length} frames`)
            .join(" · ");
        setStatus(summary);
        render(0);
    } catch (err) {
        console.error(err);
        setStatus(`error: ${err.message}`);
    }
}

datasetEl.addEventListener("change", () => render(parseInt(frameEl.value, 10)));
cameraEl.addEventListener("change", () => render(parseInt(frameEl.value, 10)));
frameEl.addEventListener("input", () => render(parseInt(frameEl.value, 10)));

boot();
