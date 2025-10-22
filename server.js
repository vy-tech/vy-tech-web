import { _app, _express } from "./functions/app/index.js";
import { chatApp } from "./functions/chat/index.js"; // Import your new chat Express app

const app = _app;
const express = _express;

// Map /s to serve static files from the public directory
app.use("/s", express.static("public/s"));

app.use("/api/chat", chatApp); // Mount the chat app at /api/chat

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
