import { getAuth } from "firebase/auth";

import { getApp } from "../data/firebase.js";
import { toolBox } from "./tools/toolbox.js";
import { WebHooksData } from "../data/webhooks.js";
import { MessagesData } from "../data/messages.js";
import { eventBus } from "../eventbus.js";

class ChatClient {
    constructor() {
        this.auth = null;
        this.conversation = null;
        this.messages = null;
        this.webhooks = new WebHooksData();
        this.webhooks.listen(
            (e) => this.handleWebhook(e),
            (key) => this.handleWebhookExpire(key)
        );

        getApp().then((app) => {
            console.log("Initializing ChatClient Auth...");
            this.auth = getAuth(app);
            toolBox.setAuth(this.auth);
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("Restoring webhooks for user:", user.uid);
                    this.webhooks.restore(user.uid);
                }
            });
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
            ...options,
        });
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
