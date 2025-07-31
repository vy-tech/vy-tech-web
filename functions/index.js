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
    prefix:
      "https://firebasestorage.googleapis.com/v0/b/roarscore-1ddf5.firebasestorage.app/o/",
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
      .send("No video segments found for this location, date, and camera.");
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
    playlistLines.push(`#EXT-X-MAP:URI="${initUrl}"`);
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

// app.get("/playlist/:event/:camera/play.m3u8", async (req, res) => {
//   const { event, camera } = req.params;
//   if (!event || !camera) {
//     return res.status(400).send("Missing 'event' or 'camera' query parameter.");
//   }

//   try {
//     // Fetch all video segments for this event (regardless of camera)
//     const videosRef = db.collection("videos");
//     const snapshot = await videosRef
//       .where("event", "==", event)
//       .orderBy("minuteOfDay")
//       .orderBy("camera")
//       .get();

//     const allSegments = snapshot.docs.map((doc) => doc.data());

//     if (allSegments.length === 0) {
//       return res.status(404).send("No video segments found for this event.");
//     }

//     // Placeholder video URL
//     const placeholderVideoUrl = getPlaceholderVideoUrl(allSegments[0].storage);

//     // Filter segments for the requested camera
//     const segmentsByCamera = allSegments.filter((v) => v.camera === camera);
//     const segmentMap = new Map(segmentsByCamera.map((v) => [v.minuteOfDay, v]));

//     // Determine the full event timeline
//     const minuteValues = allSegments.map((v) => v.minuteOfDay);
//     const firstMinute = Math.min(...minuteValues);
//     const lastMinute = Math.max(...minuteValues);

//     let playlistLines = [
//       "#EXTM3U",
//       "#EXT-X-VERSION:7",
//       "#EXT-X-TARGETDURATION:60",
//       "#EXT-X-MEDIA-SEQUENCE:0",
//       "#EXT-X-INDEPENDENT-SEGMENTS",
//     ];

//     for (let minute = firstMinute; minute <= lastMinute; minute++) {
//       const segment = segmentMap.get(minute);
//       console.log(segment);
//       if (segment) {
//         //const url = `${VIDEO_URL_PREFIX}${encodeURIComponent(segment.path)}${VIDEO_URL_SUFFIX}`;
//         const url = getVideoUrl(segment);
//         playlistLines.push(`#EXTINF:${segment.duration.toFixed(1)},`);
//         playlistLines.push(url);
//       } else {
//         playlistLines.push("#EXTINF:60.0,");
//         playlistLines.push(placeholderVideoUrl);
//       }
//     }

//     playlistLines.push("#EXT-X-ENDLIST");

//     res.set("Content-Type", "application/vnd.apple.mpegurl");
//     res.send(playlistLines.join("\n"));
//   } catch (err) {
//     console.error("Error generating playlist:", err);
//     res.status(500).send("Server error generating playlist.");
//   }
// });

// async function getCameraData(cameraId) {
//   try {
//     const cameraRef = db.collection("cameras").doc(cameraId);
//     const doc = await cameraRef.get();
//     if (!doc.exists) {
//       throw new Error(`Camera ${cameraId} not found`);
//     }
//     return doc.data();
//   } catch (err) {
//     console.error(`Error fetching camera data for ${cameraId}:`, err);
//     throw err; // rethrow for caller to handle
//   }
// }

// app.get("/playlist/:event/play.m3u8", async (req, res) => {
//   const { event } = req.params;
//   if (!event) {
//     return res.status(400).send("Missing 'event' query parameter.");
//   }

//   try {
//     const videosRef = db.collection("videos");
//     const snapshot = await videosRef
//       .where("event", "==", event)
//       .orderBy("minuteOfDay")
//       .orderBy("camera")
//       .get();

//     const videos = snapshot.docs.map((doc) => doc.data());

//     if (videos.length === 0) {
//       return res.status(404).send("No video segments found for this event.");
//     }

//     // Group by camera and grab one sample per camera to estimate metadata
//     const allCameras = new Map();
//     for (const video of videos) {
//       if (!allCameras.has(video.camera)) {
//         const cameraData = await getCameraData(video.camera);
//         allCameras.set(video.camera, cameraData);
//       }
//     }

//     const playlistLines = ["#EXTM3U"];

//     for (const [cameraId, cameraData] of allCameras.entries()) {
//       const segments = videos.filter((v) => v.camera === cameraId);
//       const bitrates = segments
//         .map((v) => v.bitrate)
//         .filter((b) => typeof b === "number" && b > 0);

//       const estimatedBandwidth =
//         bitrates.length > 0 ? Math.max(...bitrates) : 60000000; // fallback default

//       const RESOLUTION = "3840x2160"; // could vary by camera
//       const CODECS = "avc1.64001f,mp4a.40.2";
//       const cameraLabel = cameraData.name || cameraId; // use friendly name if available
//       const cameraPlaylistUrl = `/playlist/${event}/${cameraId}/play.m3u8`;

//       playlistLines.push(
//         `#EXT-X-STREAM-INF:BANDWIDTH=${estimatedBandwidth},RESOLUTION=${RESOLUTION},CODECS="${CODECS}",NAME="${cameraLabel}"`,
//         cameraPlaylistUrl
//       );
//     }

//     res.set({
//       "Content-Type": "application/vnd.apple.mpegurl",
//       "Cache-Control":
//         "public, max-age=3600, s-maxage=86400, stale-while-revalidate=600",
//     });
//     res.send(playlistLines.join("\n"));
//   } catch (err) {
//     console.error("Error generating master playlist:", err);
//     res.status(500).send("Server error generating master playlist.");
//   }
// });

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
