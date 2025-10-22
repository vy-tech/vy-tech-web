import express from "express";
import { onRequest } from "firebase-functions/v2/https";

// Express app for development
const chatApp = express();

chatApp.post("/completion", async (req, res) => {
  // Your LLM logic here
  res.json({ message: "Chat response" });
});

chatApp.get("/models", async (req, res) => {
  // List available models
  res.json({ models: ["gpt-4", "claude-3"] });
});

// Export for development server
export { chatApp };

// Export Cloud Function for production
export const chat = onRequest({
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60
}, chatApp);
