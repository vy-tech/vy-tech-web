import "../firebase-shim.js";

import express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getAuth } from "firebase-admin/auth";

import OpenAI from "openai";

import { WebHooksData } from "../../data/webhooks.js";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const openaiWebhookSecret = defineSecret("OPENAI_WEBHOOK_SECRET");

let openai;
const initializeOpenAI = () => {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            webhookSecret: process.env.OPENAI_WEBHOOK_SECRET,
        });
    }
    return openai;
};

async function isAuthenticated(req) {
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
}

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

chatApp.use(express.json());

// NOTE: Webhook endpoint is setup to receive raw body inputs upstream
// Define webhook route BEFORE authentication middleware
chatApp.post("/webhook", async (req, res) => {
    try {
        const client = initializeOpenAI();

        // Ensure we have a buffer and convert to string
        const rawBody = Buffer.isBuffer(req.body)
            ? req.body.toString()
            : req.body;

        // Verify and unwrap the webhook event
        const event = await client.webhooks.unwrap(rawBody, req.headers);
        console.log(event);

        console.log(`<<< Webhook event: ${event.type}`);

        // Acknowledge receipt of the webhook
        res.status(200).send("Webhook received");

        // Handle the event asynchronously
        setImmediate(async () => await resolveWebhook(event));
    } catch (error) {
        console.error("Webhook processing error:", error);
        res.status(400).send("Webhook processing failed");
    }
});

async function resolveWebhook(event) {
    const key = event.data.id;
    const webhooks = new WebHooksData();
    try {
        return await webhooks.resolve(key, event);
    } catch (error) {
        console.error(`Error resolving webhook with key ${key}:`, error);
    }
}

// Apply authentication middleware to all other routes
chatApp.use(requireAuth);

chatApp.post("/start", async (req, res) => {
    // req.user and req.uid are now available

    const client = initializeOpenAI();

    const conversation = await client.conversations.create();

    res.json(conversation);
});

chatApp.post("/finish", async (req, res) => {
    const client = initializeOpenAI();

    const conversationId = req.body.conversation;
    await client.conversations.delete(conversationId);

    res.json({ success: true });
});

chatApp.post("/response", async (req, res) => {
    const client = initializeOpenAI();

    const type = req.body.type || "message";
    const content = req.body.content;
    const conversation = req.body.conversation;

    let msgs = [];

    if (type === "message") {
        msgs.push({ role: "user", content: content });
    } else if (type === "tool_response") {
        msgs = req.body.output.map((output) => ({
            type: "function_call_output",
            output: output.output,
            call_id: output.call_id,
        }));
    }

    try {
        const args = {
            model: "gpt-5",
            conversation: conversation,
            prompt: {
                id: "pmpt_68ff94173ef4819686db667303d9b8eb0be186025f5a95ae",
                version: "2",
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
        res.status(400).json({ error: "Failed to create response" });
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
        console.error("Error retrieving response:", error);
        res.status(400).json({ error: "Failed to retrieve response" });
    }
});

// async function handleResponseMessages(response) {
//     const output_text = response.output
//         .filter((item) => item.type === "message")
//         .flatMap((item) => item.content)
//         .filter((contentItem) => contentItem.type === "output_text")
//         .map((contentItem) => contentItem.text)
//         .join("");

//     console.log(`#${response.conversation.id}<<< ${output_text}`);

//     if (output_text.trim() === "") {
//         return false;
//     }

//     const md = new MessagesData(response.conversation.id);
//     await md.add({
//         role: "assistant",
//         content: output_text,
//     });

//     return true;
// }

// async function handleEmptyResponse(response) {
//     const md = new MessagesData(response.conversation.id);
//     await md.add({
//         role: "assistant",
//         content: "(No response generated, try your question again.)",
//     });
// }

// async function handleToolRequests(response) {
//     const tool_requests = response.output.filter(
//         (item) => item.type === "function_call"
//     );

//     if (tool_requests.length === 0) {
//         return false;
//     }

//     const md = new MessagesData(response.conversation.id);
//     const tools = [];
//     let content = "Requesting tools:\n\n";

//     for (const tool_request of tool_requests) {
//         tools.push({
//             name: tool_request.name,
//             args: tool_request.arguments,
//             call_id: tool_request.call_id,
//         });
//         content += `  - ${tool_request.name} ${tool_request.arguments};\n`;
//     }

//     await md.add({
//         role: "assistant",
//         type: "tool_request",
//         content: content,
//         tools: tools,
//         status: "requested",
//     });

//     return true;

// for (const tool_request of tool_requests) {
//     const content = `Requesting tool ${tool_request.name}...`;
//     await md.add({
//         role: "assistant",
//         type: "tool_request",
//         content: content,
//         tool: tool_request.name,
//         arguments: tool_request.arguments,
//         call_id: tool_request.call_id,
//         status: "requested",
//     });
// }
//}

// async function handleCompletedResponse(client, event) {
//     const response_id = event.data.id;

//     if (response_id == "resp_abc123") {
//         console.log("Ignoring test response");
//         return true;
//     }

//     try {
//         // Get the full response
//         const response = await client.responses.retrieve(response_id);
//         console.log("Completed response:");

//         if (response.status == "in_progress") {
//             console.log("Response still in progress, skipping handling..");
//             return false;
//         }

//         console.log(JSON.stringify(response, null, 2));

//         let handled = false;
//         // Handle tool requests first
//         handled = (await handleToolRequests(response)) || handled;

//         // Then handle the response messages
//         handled = (await handleResponseMessages(response)) || handled;

//         return handled;
//     } catch (error) {
//         console.error("Error handling completed response:", error);
//     }
// }

// async function ensureHandledCompletedResponse(client, event) {
//     const maxRetries = 8;
//     let attempt = 0;
//     let handled = await handleCompletedResponse(client, event);

//     while (!handled && attempt < maxRetries) {
//         console.log(
//             `Retrying handling of response (attempt ${
//                 attempt + 1
//             } of ${maxRetries})...`
//         );
//         await new Promise((resolve) =>
//             setTimeout(resolve, 2000 * (attempt + 1))
//         );
//         handled = await handleCompletedResponse(client, event);
//         attempt++;
//     }

//     return handled;
// }

// Export for development server
export { chatApp };

// Export Cloud Function for production
export const chat = onRequest(
    {
        region: "us-central1",
        memory: "512MiB",
        timeoutSeconds: 60,
    },
    chatApp
);
