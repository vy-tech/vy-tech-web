import { getAuth } from "firebase/auth";

import { getApp } from "../data/firebase.js";
import { toolBox } from "./tools/toolbox.js";
import { WebHooksData } from "../data/webhooks.js";
import { MessagesData } from "../data/messages.js";
import { eventBus } from "../eventbus.js";

const SUMMARIZE_EVERY_MS = 1 * 60 * 1000;

// Tools that draw something on screen as well as returning data to the model,
// and so need re-invoking when a conversation is reopened.
const VISUAL_TOOLS = ["show_crowd_snapshot"];

class ChatClient {
    constructor() {
        this.auth = null;
        this.conversation = null;
        this.messages = null;
        this.lastSummarization = null;
        this.webhooks = new WebHooksData();
        this.webhooks.listen(
            (e) => this.handleWebhook(e),
            (key) => this.handleWebhookExpire(key)
        );

        getApp().then((app) => {
            console.log("Initializing ChatClient Auth...");
            this.auth = getAuth(app);
            console.log("Setting Auth in toolBox...");
            toolBox.setAuth(this.auth);
            console.log("Setting up Auth state listener...");
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("Restoring webhooks for user:", user.uid);
                    this.webhooks.restore(user.uid);
                }
            });
            console.log("ChatClient Auth initialized.");
        });
    }

    async getAuthHeaders() {
        const user = this.auth.currentUser;
        if (!user) {
            throw new Error("User not authenticated");
        }

        const idToken = await user.getIdToken(true);
        return {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
        };
    }

    setConversation(conversationId) {
        this.conversation = conversationId;
        this.messages = new MessagesData(this.conversation);
    }

    async startConversation() {
        console.log("Starting new conversation");

        const headers = await this.getAuthHeaders();
        const response = await fetch("/api/chat/start", {
            method: "POST",
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.conversation = data.id;
        this.messages = new MessagesData(this.conversation);

        return this.conversation;
    }

    async restartConversation(conversationId) {
        console.log("Restarting conversation:", conversationId);

        const headers = await this.getAuthHeaders();
        const response = await fetch(`/api/chat/restart/${conversationId}`, {
            method: "POST",
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.conversation = data.conversation.id;
        this.messages = new MessagesData(this.conversation);

        await this.webhooks.create(data.response.id, this.auth.currentUser.uid);

        return this.conversation;
    }

    async finishConversation() {
        if (!this.conversation) {
            console.warn("No active conversation to finish");
            return;
        }

        console.log("Finishing conversation:", this.conversation);

        const headers = await this.getAuthHeaders();
        const response = await fetch("/api/chat/finish", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                conversation: this.conversation,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.conversation = null;
        this.messages = null;

        return data;
    }

    async postMessage(content, type = "message", options = {}) {
        if (!this.conversation) {
            throw new Error(
                "No active conversation. Start a conversation first."
            );
        }

        // POST message to backend API
        console.log("Posting message to backend:", content);

        const headers = await this.getAuthHeaders();
        const response = await fetch("/api/chat/response", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                conversation: this.conversation,
                type: type,
                content: content,
                ...options,
            }),
        });

        if (!response.ok) {
            let reason =
                response.status === 404
                    ? "Conversation not found. It may have been deleted or expired. Please start a new conversation."
                    : "The message failed to send. The conversation may be stuck. Please try starting a new conversation.";

            eventBus.fire("chat.responseFailed", {
                reason: reason,
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        await this.webhooks.create(data.id, this.auth.currentUser.uid);

        return data;
    }

    async handleWebhook(event) {
        console.log("Handling webhook event in ChatClient:", event);

        if (event.type !== "response.completed") {
            console.log("Ignoring non-response.completed event");
            return;
        }

        const responseId = event.data.id;
        const response = await this.getResponseUntilCompleted(responseId);

        if (response.status !== "completed") {
            console.error("Response is not completed. Cannot process.");

            eventBus.fire("chat.responseFailed", {
                failure: `Response status is ${response.status} on webhook complete.`,
                response: response,
            });

            return;
        }

        return await this.processResponse(response);
    }

    async processResponse(response) {
        const outputText = this.getTextFromResponse(response);
        const toolRequests = this.getToolRequestsFromResponse(response);

        if (outputText) {
            console.log("Received output text:", outputText);
            this.addTextMessage(outputText, { responseId: response.id });

            this.summarizeIfNeeded();
        }

        if (toolRequests.length > 0) {
            this.addToolRequestMessage(toolRequests, {
                responseId: response.id,
            });

            console.log("Invoking tools:", toolRequests);
            const toolResponses = await this.invokeTools(toolRequests);
            console.log("Received tool responses:", toolResponses);

            let toolResponse = this.sendToolResponse(toolResponses);
            this.addToolResponseMessage(toolResponses, {
                responseId: toolResponse.id,
            });
        }
    }

    async handleWebhookExpire(key) {
        console.log("Handling webhook expire for key:", key);

        try {
            const response = await this.getResponseUntilCompleted(key);
            console.log("Fetched response for expired webhook:", response);

            if (response.status !== "completed") {
                console.error("Response is not completed. Cannot process.");

                eventBus.fire("chat.responseFailed", {
                    failure: `Response status is ${response.status} after webhook expired`,
                    response: response,
                });

                return;
            }

            await this.processResponse(response);
        } catch (error) {
            console.error("Error getting response:", error);
        }
    }

    async getResponseUntilCompleted(
        responseId,
        interval = 2000,
        timeout = 60000
    ) {
        const startTime = Date.now();

        while (true) {
            if (Date.now() - startTime > timeout) {
                throw new Error("Timeout waiting for response to complete");
            }

            try {
                const response = await this.getResponse(responseId);

                if (response.status === "completed") {
                    return response;
                } else {
                    console.log(
                        `Response ${responseId} not completed yet. Status: ${response.status}`
                    );
                }
            } catch (error) {
                console.error("Error fetching response:", error);
            }

            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }

    async getResponse(responseId) {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`/api/chat/response/${responseId}`, {
            method: "GET",
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    getTextFromResponse(response) {
        const output_text = response.output
            .filter((item) => item.type === "message")
            .flatMap((item) => item.content)
            .filter((contentItem) => contentItem.type === "output_text")
            .map((contentItem) => contentItem.text)
            .join("");

        if (output_text.trim() === "") {
            return null;
        }

        return output_text;
    }

    getToolRequestsFromResponse(response) {
        const tool_requests = response.output.filter(
            (item) => item.type === "function_call"
        );

        return tool_requests.map((tool_request) => ({
            name: tool_request.name,
            args: tool_request.arguments,
            call_id: tool_request.call_id,
        }));
    }

    addTextMessage(text, options = {}) {
        let msg = {
            role: "assistant",
            type: "message",
            content: text,
            ...options,
        };

        this.messages.add(msg);
    }

    addToolRequestMessage(toolRequests, options = {}) {
        const msg = toolRequests.map(
            (toolRequest) => `  - ${toolRequest.name}(${toolRequest.args})`
        );

        this.messages.add({
            role: "assistant",
            type: "tool_request",
            content: ["Requesting tools:", "", ...msg].join("\n"),
            // Stored alongside the rendered text so replaying a call on
            // conversation load doesn't have to parse `content` — that string
            // is a display format, and reformatting it would silently break
            // replay. See parseToolCallsFromContent() for the fallback that
            // covers conversations written before this field existed.
            toolCalls: toolRequests,
            ...options,
        });
    }

    // --- Replaying visual tools on conversation load -----------------------
    //
    // Most tools only feed the model, but show_crowd_snapshot also paints the
    // chat banner. Reopening a conversation restores the transcript, so the
    // banner should come back too — otherwise the assistant is discussing a
    // map that isn't on screen.

    /**
     * Tool calls recorded on a message, preferring the structured field and
     * falling back to the rendered content for older messages.
     */
    getToolCallsFromMessage(message) {
        if (Array.isArray(message.toolCalls)) return message.toolCalls;
        return this.parseToolCallsFromContent(message.content);
    }

    // "  - show_crowd_snapshot({"hierarchy":"raimondi:20260621",...})" per line.
    // Args are always one line of JSON, so the greedy match to the final ")"
    // recovers them intact.
    parseToolCallsFromContent(content) {
        const calls = [];
        for (const line of (content || "").split("\n")) {
            const match = line.match(/^\s*-\s*([A-Za-z0-9_]+)\((.*)\)\s*$/);
            if (match) calls.push({ name: match[1], args: match[2] });
        }
        return calls;
    }

    /**
     * The most recent visual tool call in `messages`, or null.
     *
     * Only the last one matters: the banner shows a single map at a time, so
     * replaying every call in a long conversation would be a burst of fetches
     * for maps nobody sees.
     */
    findLastVisualCall(messages) {
        let last = null;

        for (const message of messages || []) {
            if (message.type !== "tool_request") continue;
            for (const call of this.getToolCallsFromMessage(message)) {
                if (VISUAL_TOOLS.includes(call.name)) last = call;
            }
        }

        return last;
    }

    /**
     * Re-invoke the most recent visual tool call in `messages`, if any.
     *
     * Goes through toolBox so the tool's eventBus side effect fires exactly as
     * it does live; the returned summary is discarded rather than posted, since
     * the model already has it in context from the original exchange.
     */
    async replayLastVisual(messages) {
        const last = this.findLastVisualCall(messages);
        if (!last) return null;

        console.log("Replaying visual tool call:", last);
        try {
            await toolBox.invoke(last.name, last.args);
            return last;
        } catch (error) {
            // A replay failing is not worth blocking the transcript over — the
            // event may have been deleted, or its chunks may no longer load.
            console.error("Error replaying visual tool call:", error);
            return null;
        }
    }

    async invokeTools(tools) {
        return await toolBox.invokeAll(tools);
    }

    addToolResponseMessage(toolResponses) {
        this.messages.add({
            role: "user",
            type: "tool_response",
            content: toolResponses.content,
        });
    }

    async sendToolResponse(toolResponses) {
        await this.postMessage(toolResponses.content, "tool_response", {
            output: toolResponses.output,
        });
    }

    summarizeIfNeeded() {
        if (!this.lastSummarization) {
            this.lastSummarization = Date.now();
            return;
        }

        const now = Date.now();
        const elapsed = now - this.lastSummarization;

        if (elapsed > SUMMARIZE_EVERY_MS) {
            console.log(
                `${
                    SUMMARIZE_EVERY_MS / 60000
                } minutes elapsed since last summarization. Summarizing...`
            );
            this.summarize()
                .then((data) => {
                    console.log("Conversation summarized:", data);
                    this.lastSummarization = Date.now();
                })
                .catch((error) => {
                    console.error("Error summarizing conversation:", error);
                });
        }
    }

    async summarize() {
        if (!this.conversation) {
            throw new Error(
                "No active conversation. Start a conversation first."
            );
        }

        // POST request to backend API
        console.log(
            "Requesting summarization of conversation:",
            this.conversation
        );

        const headers = await this.getAuthHeaders();
        const response = await fetch(
            `/api/chat/summarize/${this.conversation}`,
            {
                method: "POST",
                headers: headers,
            }
        );

        if (!response.ok) {
            let reason =
                response.status === 404
                    ? "Conversation not found. It may have been deleted or expired. Please start a new conversation."
                    : "The message failed to send. The conversation may be stuck. Please try starting a new conversation.";

            eventBus.fire("chat.summarizeFailed", {
                reason: reason,
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return data;
    }
}

const chatClient = new ChatClient();

if (typeof window !== "undefined") {
    window._vy_chatClient = chatClient;
}

export { ChatClient, chatClient };
