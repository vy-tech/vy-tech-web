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
const dashboardTemplate = Handlebars.compile(
  readFileSync(join(__dirname, "views", "dashboard.hbs"), "utf8")
);

app.get("/users/login", (req, res) => {
  res.send(
    loginTemplate({
      error: req.query.error,
      return_url: req.query.return_url,
    })
  );
});

app.get("/dashboard", (req, res) => {
  res.send(
    dashboardTemplate({
      error: req.query.error,
    })
  );
});

export const _app = app;
export const _express = express;
const _app_request = functions.https.onRequest(app);
export { _app_request as app };
