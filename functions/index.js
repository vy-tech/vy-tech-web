/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
// Core imports
import { readFileSync } from "fs";
import { join } from "path";

// Firebase imports
import { db, auth, functions } from "./lib/firebase.js";

// Express imports
import express from "express";
import bodyParser from "body-parser";
const { urlencoded, json } = bodyParser;
import cookieParser from "cookie-parser";

// Handlebars imports
import Handlebars from "handlebars";

// Express setup
const app = express();
app.use(urlencoded({ extended: true }));
app.use(json());
app.use(cookieParser());

// __dirname is not available in ES modules, so we need to use a workaround
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

Handlebars.registerHelper("default", function (value, defaultValue) {
    return value !== undefined ? value : defaultValue;
});
const loginTemplate = Handlebars.compile(
    readFileSync(join(__dirname, "views", "login.hbs"), "utf8")
);
const appTemplate = Handlebars.compile(
    readFileSync(join(__dirname, "views", "app.hbs"), "utf8")
);

app.get("/users/login", (req, res) => {
    res.send(
        loginTemplate({
            error: req.query.error,
            return_url: req.query.return_url,
        })
    );
});

const STORAGE_URLS = {
    firebase: {
        prefix: "https://firebasestorage.googleapis.com/v0/b/roarscore-1ddf5.firebasestorage.app/o/",
        suffix: "?alt=media&ext=.mp4",
        placeholder: "videos%2Fvideo-placeholder.mp4",
        encoded: true,
    },
    minio: {
        prefix: "https://storage.roarscore.ai/production/",
        suffix: "",
        placeholder: "videos/playback-placeholder.mp4",
        encoded: false,
    },
};

const getVideoUrl = (storageType, path) => {
    const { prefix, suffix, encoded } = STORAGE_URLS[storageType || "firebase"];

    if (!path) return "";

    var resultPath = path;
    if (encoded) resultPath = encodeURIComponent(resultPath);
    if (resultPath.startsWith("/") && prefix.endsWith("/"))
        resultPath = resultPath.substring(1); // Remove leading slash if prefix ends with slash

    return `${prefix}${resultPath}${suffix}`;
};

const getPlaceholderVideoUrl = (storageType) => {
    storageType = storageType || "firebase"; // Default to firebase if not specified
    const { prefix, suffix, placeholder } = STORAGE_URLS[storageType];

    return `${prefix}${placeholder}${suffix}`;
};

const cleanupChunks = (chunks) => {
    // Sort by minuteOfDay
    chunks.sort((a, b) => a.minuteOfDay - b.minuteOfDay);

    // Filter out any that cannot be played
    chunks = chunks.filter((c) => {
        if (!c.playbackPrefix) {
            console.warn(`Chunk ${c.id} is missing playbackPrefix, skipping.`);
            return false;
        }
        return true;
    });

    // Remove duplicates and prioritize those with expressionsPath
    var unique = {};
    chunks.forEach((c) => {
        if (!unique[c.minuteOfDay] || c.expressionsPath) {
            unique[c.minuteOfDay] = c;
        }
    });
    chunks = Object.values(unique);

    return chunks;
};

app.get("/playlist/:location-:date-:camera-:quality.m3u8", async (req, res) => {
    const { location, date, camera, quality } = req.params;
    if (!location || !date || !camera || !quality) {
        return res
            .status(400)
            .send(
                "Missing 'location', 'date', 'camera', or 'quality' query parameter."
            );
    }

    const hierarchy = `${location}:${date}:${camera}`;
    const colRef = db.collection("chunks");
    const query = colRef.where("hierarchy", "==", hierarchy);
    const snapshot = await query.get();
    if (snapshot.empty) {
        return res
            .status(404)
            .send(
                "No video segments found for this location, date, and camera."
            );
    }

    var chunks = cleanupChunks(snapshot.docs.map((doc) => doc.data()));

    var playlistLines = [
        "#EXTM3U",
        "#EXT-X-VERSION:7",
        "#EXT-X-TARGETDURATION:6",
        "#EXT-X-MEDIA-SEQUENCE:0",
        "#EXT-X-PLAYLIST-TYPE:VOD",
    ];

    for (const chunk of chunks) {
        var prefix = `${chunk.playbackPrefix}-${quality}`;
        var initUrl = getVideoUrl(chunk.storage, `${prefix}-init.mp4`);
        var exprUrl = getVideoUrl(chunk.storage, chunk.expressionsPath);
        playlistLines.push(`#EXT-X-MAP:URI="${initUrl}#${exprUrl}"`);
        for (var i = 0; i < chunk.playbackSegments; i++) {
            var segmentNum = i.toString().padStart(3, "0");
            var segmentUrl = getVideoUrl(
                chunk.storage,
                `${prefix}-${segmentNum}.mp4`
            );
            playlistLines.push(`#EXTINF:${chunk.playbackDurations[i]},`);
            playlistLines.push(segmentUrl);
        }
        playlistLines.push("#EXT-X-DISCONTINUITY");
    }
    playlistLines.push("#EXT-X-ENDLIST");

    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.send(playlistLines.join("\n"));
});

const appEndpoints = [
    "dashboard",
    "locations",
    "schedule",
    "reports",
    "settings",
    "profile",
    "admin",
];

// Add the app endpoints to the express app
appEndpoints.forEach((endpoint) => {
    app.get(`/${endpoint}/:location?/:date?/:camera?`, (req, res) => {
        const { location, date, camera } = req.params;
        res.send(
            appTemplate({
                error: req.query.error,
                endpoint: endpoint,
                Endpoint: endpoint.charAt(0).toUpperCase() + endpoint.slice(1),
                location,
                date,
                camera,
            })
        );
    });
});

export const _app = app;
export const _express = express;
const _app_request = functions.https.onRequest(app);
export { _app_request as app };
