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

const VIDEO_URL_PREFIX = "https://firebasestorage.googleapis.com/v0/b/roarscore-1ddf5.firebasestorage.app/o/";
const VIDEO_URL_SUFFIX = "?alt=media&ext=.mp4";
const PLACEHOLDER_VIDEO_URL = `${VIDEO_URL_PREFIX}videos%2Fvideo-placeholder.mp4${VIDEO_URL_SUFFIX}`; // Placeholder for missing segments

app.get("/playlist/:event/:camera/play.m3u8", async (req, res) => {
  const { event, camera } = req.params;
  if (!event || !camera) {
    return res.status(400).send("Missing 'event' or 'camera' query parameter.");
  }

  try {
    // Fetch all video segments for this event (regardless of camera)
    const videosRef = db.collection("videos");
    const snapshot = await videosRef
      .where("event", "==", event)
      .orderBy("minuteOfDay")
      .orderBy("camera")
      .get();

    const allSegments = snapshot.docs.map(doc => doc.data());

    if (allSegments.length === 0) {
      return res.status(404).send("No video segments found for this event.");
    }

    // Filter segments for the requested camera
    const segmentsByCamera = allSegments.filter(v => v.camera === camera);
    const segmentMap = new Map(segmentsByCamera.map(v => [v.minuteOfDay, v]));

    // Determine the full event timeline
    const minuteValues = allSegments.map(v => v.minuteOfDay);
    const firstMinute = Math.min(...minuteValues);
    const lastMinute = Math.max(...minuteValues);

    let playlistLines = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-TARGETDURATION:60",
      "#EXT-X-MEDIA-SEQUENCE:0"
    ];

    for (let minute = firstMinute; minute <= lastMinute; minute++) {
      const segment = segmentMap.get(minute);
      if (segment) {
        const url = `${VIDEO_URL_PREFIX}${encodeURIComponent(segment.path)}${VIDEO_URL_SUFFIX}`;
        playlistLines.push(`#EXTINF:${segment.duration.toFixed(1)},`);
        playlistLines.push(url);
      } 
      else {
        playlistLines.push("#EXTINF:60.0,");
        playlistLines.push(PLACEHOLDER_VIDEO_URL);
      }
    }

    playlistLines.push("#EXT-X-ENDLIST");

    res.set("Content-Type", "application/vnd.apple.mpegurl");
    res.send(playlistLines.join("\n"));
  } catch (err) {
    console.error("Error generating playlist:", err);
    res.status(500).send("Server error generating playlist.");
  }
});

async function getCameraData(cameraId) {
  try {
    const cameraRef = db.collection("cameras").doc(cameraId);
    const doc = await cameraRef.get();
    if (!doc.exists) {
      throw new Error(`Camera ${cameraId} not found`);
    }
    return doc.data();
  } catch (err) {
    console.error(`Error fetching camera data for ${cameraId}:`, err);
    throw err; // rethrow for caller to handle
  }
}

app.get("/playlist/:event/play.m3u8", async (req, res) => {
  const { event } = req.params;
  if (!event) {
    return res.status(400).send("Missing 'event' query parameter.");
  }

  try {
    const videosRef = db.collection("videos");
    const snapshot = await videosRef
      .where("event", "==", event)
      .orderBy("minuteOfDay")
      .orderBy("camera")
      .get();

    const videos = snapshot.docs.map(doc => doc.data());

    if (videos.length === 0) {
      return res.status(404).send("No video segments found for this event.");
    }

    // Group by camera and grab one sample per camera to estimate metadata
    const allCameras = new Map();
    for (const video of videos) {
      if (!allCameras.has(video.camera)) {
        const cameraData = await getCameraData(video.camera);
        allCameras.set(video.camera, cameraData);
      }
    }

    const playlistLines = ["#EXTM3U"];

    for (const [cameraId, cameraData] of allCameras.entries()) {
      const segments = videos.filter(v => v.camera === cameraId);
      const bitrates = segments
        .map(v => v.bitrate)
        .filter(b => typeof b === "number" && b > 0);

      const estimatedBandwidth = bitrates.length > 0
        ? Math.max(...bitrates)
        : 60000000; // fallback default

      const RESOLUTION = "3840x2160"; // could vary by camera
      const CODECS = "avc1.64001f,mp4a.40.2";
      const cameraLabel = cameraData.name || cameraId; // use friendly name if available
      const cameraPlaylistUrl = `/playlist/${event}/${cameraId}/play.m3u8`;

      playlistLines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${estimatedBandwidth},RESOLUTION=${RESOLUTION},CODECS="${CODECS}",NAME="${cameraLabel}"`,
        cameraPlaylistUrl
      );
    }

    res.set({
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=600",
    });
    res.send(playlistLines.join("\n"));
  } catch (err) {
    console.error("Error generating master playlist:", err);
    res.status(500).send("Server error generating master playlist.");
  }
});

const appEndpoints = [
  "dashboard",
  "locations",
  "schedule",
  "reports",
  "settings",
  "profile",
];

// Add the app endpoints to the express app
appEndpoints.forEach((endpoint) => {
  app.get(`/${endpoint}/:id?`, (req, res) => {
    const { id } = req.params;
    res.send(
      appTemplate({
        error: req.query.error,
        endpoint: endpoint,
        Endpoint: endpoint.charAt(0).toUpperCase() + endpoint.slice(1),
        id
      })
    );
  });
});

export const _app = app;
export const _express = express;
const _app_request = functions.https.onRequest(app);
export { _app_request as app };
