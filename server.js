import express from "express";
import { _app as legacyApp } from "./functions/app/index.js";
import { chatApp } from "./functions/chat/index.js"; // Import your new chat Express app
import { orgApp } from "./functions/org/index.js";
import { fileApp } from "./functions/file/index.js";
import { v1App } from "./functions/v1/index.js";
import { billingApp } from "./functions/billing/index.js";

const app = express();

// Add raw body parser for webhook endpoint BEFORE mounting chatApp
app.use(
    "/api/chat/webhook",
    express.raw({
        type: "*/*",
        limit: "10mb",
    })
);

// Add raw body parser for billing webhook endpoint BEFORE mounting billingApp
app.use(
    "/api/billing/webhook",
    express.raw({
        type: "*/*",
        limit: "10mb",
    })
);

// Mount the chat app at /api/chat
app.use("/api/chat", chatApp);

// Mount the org app at /api/org
app.use("/api/org", orgApp);

// Mount the file app at /api/file
app.use("/api/file", fileApp);

// Mount the v1 app at /api/v1
app.use("/api/v1", v1App);

// Mount the billing app at /api/billing
app.use("/api/billing", billingApp);

// Map /s to serve static files from the public directory
app.use("/s", express.static("public/s"));

// Mount the main app at /
app.use("/", legacyApp);

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
