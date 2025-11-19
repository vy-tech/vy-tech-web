import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getAuth } from "firebase-admin/auth";

import OpenAI from "openai";

import { WebHooksData } from "../../data/webhooks.js";
import { Hierarchy } from "../../util/hierarchy.js";
import { database } from "../../data/db.js";
import { event } from "firebase-functions/v1/analytics";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const openaiWebhookSecret = defineSecret("OPENAI_WEBHOOK_SECRET");
const openaiPromptId = defineSecret("OPENAI_PROMPT_ID");
const openaiPromptVersion = defineSecret("OPENAI_PROMPT_VERSION");
const weatherApiKey = defineSecret("WEATHER_API_KEY");

let openai;
const initializeOpenAI = () => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || openaiApiKey.value(),
            webhookSecret:
                process.env.OPENAI_WEBHOOK_SECRET ||
                openaiWebhookSecret.value(),
        });
    }
    return openai;
};

const isAuthenticated = async (req) => {
    try {
        // Get the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return {
                authenticated: false,
                error: "No valid authorization header",
            };
        }

        // Extract the ID token
        const idToken = authHeader.split("Bearer ")[1];

        // Verify the ID token
        const decodedToken = await getAuth().verifyIdToken(idToken);

        return {
            authenticated: true,
            uid: decodedToken.uid,
            user: decodedToken,
        };
    } catch (error) {
        console.error("Authentication error:", error);
        return {
            authenticated: false,
            error: "Invalid token",
        };
    }
};

const parseJsonBody = (body) => {
    if (Buffer.isBuffer(body)) {
        return JSON.parse(body.toString());
    } else if (typeof body === "object") {
        return body;
    } else if (typeof body === "string") {
        return JSON.parse(body);
    } else if (body) {
        return JSON.parse(body.toString());
    } else {
        return null;
    }
};

// Authentication middleware
const requireAuth = async (req, res, next) => {
    const authResult = await isAuthenticated(req);

    if (!authResult.authenticated) {
        console.warn("Unauthorized access attempt");
        return res.status(401).json({
            error: "Unauthorized",
            message: authResult.error,
        });
    }

    // Add user info to request object for use in route handlers
    req.user = authResult.user;
    req.uid = authResult.uid;

    next();
};

// Express app for development
const chatApp = express();

chatApp.use(express.raw({ type: "*/*" }));

// NOTE: Webhook endpoint is setup to receive raw body inputs upstream
// Define webhook route BEFORE authentication middleware
chatApp.post("/webhook", async (req, res) => {
    try {
        const client = initializeOpenAI();

        let rawBody;

        if (req.rawBody) {
            rawBody = Buffer.isBuffer(req.rawBody)
                ? req.rawBody.toString()
                : req.rawBody;
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString();
        } else if (typeof req.body === "string") {
            rawBody = req.body;
        } else {
            console.log("Invalid body format.");
            console.log("req.body:", req.body);
            console.log("typeof req.body:", typeof req.body);
            console.log("req.rawBody:", req.rawBody);
            console.log("typeof req.rawBody:", typeof req.rawBody);

            res.status(400).send("Invalid body format");
            return;
        }

        // Verify and unwrap the webhook event
        const event = await client.webhooks.unwrap(rawBody, req.headers);

        // Acknowledge receipt of the webhook
        res.status(200).send("Webhook received");

        // Handle the event asynchronously
        setImmediate(async () => await resolveWebhook(event));
    } catch (error) {
        console.error("Webhook processing error:", error);
        console.log("req.headers:", req.headers);
        console.log("req.body:", req.body);
        console.log(
            "dev secret length:",
            process.env.OPENAI_WEBHOOK_SECRET?.length
        );
        console.log("prod secret length:", openaiWebhookSecret.value()?.length);

        res.status(400).send("Webhook processing failed");
    }
});

const resolveWebhook = async (event) => {
    const key = event.data.id;
    const webhooks = new WebHooksData();
    try {
        return await webhooks.resolve(key, event);
    } catch (error) {
        console.error(`Error resolving webhook with key ${key}:`, error);
    }
};

chatApp.use(requireAuth);

chatApp.post("/start", async (req, res) => {
    try {
        const client = initializeOpenAI();

        console.log("Creating new conversation");
        const conversation = await client.conversations.create();
        console.log("Created new conversation:", conversation);

        res.json(conversation);
    } catch (error) {
        console.error("Error creating conversation:", error);
        console.log("Request body:", req.body);
        console.log("Request headers:", req.headers);
        console.log("Dev api key length:", process.env.OPENAI_API_KEY?.length);
        console.log("Prod api key length:", openaiApiKey.value()?.length);
        res.status(400).json({ error: "Failed to create conversation" });
    }
});

chatApp.post("/finish", async (req, res) => {
    try {
        const data = parseJsonBody(req.body);
        const client = initializeOpenAI();

        const conversationId = data.conversation;
        console.log(`Deleting conversation ${conversationId}`);
        const result = await client.conversations.delete(conversationId);
        console.log(`Deleted conversation ${conversationId}: `, result);

        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting conversation:", error);
        console.log("Request body:", req.body);
        console.log("Request raw body:", req.rawBody);
        console.log("Request headers:", req.headers);
        console.log("Dev api key length:", process.env.OPENAI_API_KEY?.length);
        console.log("Prod api key length:", openaiApiKey.value()?.length);
        res.status(400).json({ error: "Failed to delete conversation" });
    }
});

chatApp.post("/response", async (req, res) => {
    try {
        const data = parseJsonBody(req.body);
        const client = initializeOpenAI();

        const type = data.type || "message";
        const content = data.content;
        const conversation = data.conversation;

        let msgs = [];

        if (type === "message") {
            msgs.push({ role: "user", content: content });
        } else if (type === "tool_response") {
            msgs = data.output.map((output) => ({
                type: "function_call_output",
                output: output.output,
                call_id: output.call_id,
            }));
        }

        const promptId = process.env.OPENAI_PROMPT_ID || openaiPromptId.value();
        const promptVersion =
            process.env.OPENAI_PROMPT_VERSION || openaiPromptVersion.value();

        // TODO FIXME set up dev/prod split pmpt_68ff94173ef4819686db667303d9b8eb0be186025f5a95ae
        const args = {
            model: "gpt-5",
            conversation: conversation,
            prompt: {
                id: promptId,
                version: promptVersion,
            },
            input: msgs,
            background: true,
        };

        console.log("Calling Response API with", args);
        const response = await client.responses.create(args);
        console.log("Response API returned", response);

        res.json(response);
    } catch (error) {
        console.error("Error creating response:", error);
        console.log("Request body:", req.body);
        console.log("Request headers:", req.headers);
        console.log("Dev api key length:", process.env.OPENAI_API_KEY?.length);
        console.log("Prod api key length:", openaiApiKey.value()?.length);
        console.log("Dev prompt id:", process.env.OPENAI_PROMPT_ID);
        console.log("Prod prompt id:", openaiPromptId.value());
        console.log("Dev prompt version:", process.env.OPENAI_PROMPT_VERSION);
        console.log("Prod prompt version:", openaiPromptVersion.value());

        if (error.status === 404) {
            console.warn("Prompt or conversation not found");
            return res
                .status(404)
                .json({ error: "Prompt or conversation not found" });
        } else {
            res.status(400).json({ error: "Failed to create response" });
        }
    }
});

chatApp.get("/response/:responseId", async (req, res) => {
    const client = initializeOpenAI();
    const responseId = req.params.responseId;

    try {
        console.log(`Retrieving response ${responseId} from Response API`);
        const response = await client.responses.retrieve(responseId);
        console.log("Retrieved response:", response);
        res.json(response);
    } catch (error) {
        if (error.status === 404) {
            console.warn(`Response ${responseId} not found`);
            res.status(404).json({ error: "Response not found" });
        } else {
            console.error("Error retrieving response:", error);
            res.status(400).json({ error: "Failed to retrieve response" });
        }
    }
});

chatApp.post("/tool/weather", async (req, res) => {
    const data = parseJsonBody(req.body);
    const locationHierarchy = data.hierarchy;
    const hierarchy = new Hierarchy(locationHierarchy);
    let rows = await database.query("locations", {
        token: hierarchy.location,
    });
    if (rows.length === 0) {
        res.status(404).json({ error: "Location not found" });
        return;
    }

    const locationData = rows[0];

    hierarchy.camera = 1;
    rows = await database.query("events", {
        hierarchy: hierarchy.toString(),
    });

    if (rows.length === 0) {
        res.status(404).json({ error: "Event not found" });
        return;
    }

    const eventData = rows[0];

    // Change YYYYMMDD to YYYY-MM-DD
    const date = hierarchy.date.toString();
    const dt = [
        date.substring(0, 4),
        date.substring(4, 6),
        date.substring(6, 8),
    ].join("-");

    const q = locationData.zip;

    const apikey = process.env.WEATHER_API_KEY || weatherApiKey.value();
    const url = `https://api.weatherapi.com/v1/history.json?key=${apikey}&q=${q}&dt=${dt}`;
    console.log("Fetching weather data from URL:", url);
    const response = await fetch(url);

    if (!response.ok) {
        console.error(
            `Weather API request failed with status ${response.status}`
        );
        res.status(400).json({ error: "Failed to fetch weather data" });
        return;
    }

    const weatherData = await response.json();

    const hourly = weatherData.forecast.forecastday[0].hour;
    hourly.forEach((hour) => {
        hour.time_until_event_start =
            eventData.begin.toMillis() / 1000 - hour.time_epoch;
        hour.time_until_event_end =
            eventData.end.toMillis() / 1000 - hour.time_epoch;
    });

    res.json(hourly);
});

const functionApp = express();
functionApp.use("/api/chat", chatApp);

// Export for development server
export { chatApp };

console.log("Setting up Cloud Function export...");
// Export Cloud Function for production
export const chat = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
        secrets: [
            openaiApiKey,
            openaiWebhookSecret,
            openaiPromptId,
            openaiPromptVersion,
            weatherApiKey,
        ],
        invoker: "public",
    },
    functionApp
);
