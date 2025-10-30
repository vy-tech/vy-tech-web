import express from "express";
import { _app as legacyApp } from "./functions/app/index.js";
import { chatApp } from "./functions/chat/index.js"; // Import your new chat Express app

const app = express();

// Add raw body parser for webhook endpoint BEFORE mounting chatApp
app.use(
    "/api/chat/webhook",
    express.raw({
        type: "*/*",
        limit: "10mb",
    })
);

// Mount the chat app at /api/chat
app.use("/api/chat", chatApp);

// Map /s to serve static files from the public directory
app.use("/s", express.static("public/s"));

// Mount the main app at /
app.use("/", legacyApp);

app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
