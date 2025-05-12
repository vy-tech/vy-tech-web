/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { db, auth, functions } from "./lib/firebase.js";

import { onRequest } from "firebase-functions/v2/https";
//import { logger } from "firebase-functions/logger";

// Express imports
import express from "express";
import bodyParser from "body-parser";
const { urlencoded, json } = bodyParser;
import cookieParser from "cookie-parser";

// Express setup
const app = express();
app.use(urlencoded({ extended: true }));
app.use(json());
app.use(cookieParser());

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

export const _app = app;
export const _express = express;
const _app_request = functions.https.onRequest(app);
export { _app_request as app };
