import van from "vanjs-core";
import { marked } from "marked";

import MessagesData from "../data/messages.js";
import { eventBus } from "../eventbus.js";
import { chatClient } from "../chat/client.js";

class Messages {
    constructor() {
        this.conversation = null;
        this.data = null;
        this.list = null;
        this.indicator = null;
    }

    async init() {
        eventBus.addEventListener("ui.requestConversation", async (e) => {
            console.log("Received requestConversation event:", e.detail);
            this.conversation = e.detail.conversation;

            if (this.data) {
                this.data.stopListening();
            }

            this.list.innerHTML = "";
            this.data = new MessagesData(this.conversation);
            this.data.listen((messages) => this.appendMessages(messages));

            chatClient.setConversation(this.conversation);
        });

        eventBus.addEventListener("ui.requestDeleteConversation", async (e) => {
            console.log("Received requestDeleteConversation event:", e.detail);

            if (this.data && this.conversation === e.detail.conversation) {
                console.log(
                    `Stopping listener for conversation ${e.detail.conversation}`
                );
                this.data.stopListening();
                this.data = null;
                this.conversation = null;
                this.list.innerHTML = "";
            }

            let data = new MessagesData(e.detail.conversation);
            console.log(
                `Deleting messages for conversation ${e.detail.conversation}`
            );
            await data.deleteConversation(e.detail.conversation);

            eventBus.fire("ui.deletedConversationMessages", {
                conversation: e.detail.conversation,
            });
        });

        eventBus.on("chat.responseFailed", (e) => {
            console.log("Handling chat.responseFailed event:", e);
            this.showIndicator(
                e.detail.reason ||
                    "We haven't received a response after a long delay. Please try sending another message.",
                "error"
            );
        });
    }

    showIndicator(message, icon = null) {
        const icons = {
            warning: "⚠️",
            info: "ℹ️",
            error: "❌",
        };

        const indicatorText = document.getElementById("indicator-text");
        const indicatorIcon = document.getElementById("indicator-icon");
        const indicatorSpinner = document.getElementById("indicator-spinner");
        indicatorText.innerText = message;

        if (icon) {
            if (icon === "loading") {
                indicatorSpinner.classList.remove("hidden");
                indicatorIcon.classList.add("hidden");
            } else {
                indicatorIcon.innerText = icons[icon] || icon;
                indicatorSpinner.classList.add("hidden");
                indicatorIcon.classList.remove("hidden");
            }
        } else {
            indicatorSpinner.classList.add("hidden");
            indicatorIcon.classList.add("hidden");
        }

        this.indicator.classList.remove("hidden");
    }

    hideIndicator() {
        this.indicator.classList.add("hidden");
    }

    createElements(options = {}) {
        const { div, ul, li, span } = van.tags;

        let merged = {
            id: "messages-list",
            class: `messages-list list-none p-0 m-0 ${options.class || ""}`,
            ...options,
        };

        this.list = ul(merged);

        this.indicator = div(
            {
                id: "indicator",
                class: "flex items-center justify-center mt-4 mb-2 hidden",
            },
            div(
                {
                    class: "flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg",
                },
                div({
                    id: "indicator-spinner",
                    class: "w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin hidden",
                }),
                div(
                    {
                        id: "indicator-icon",
                        class: "w-4 h-4 text-yellow-500 flex items-center justify-center hidden",
                    },
                    "⚠️"
                ),
                span(
                    {
                        id: "indicator-text",
                        class: "text-gray-700 dark:text-gray-300 font-medium",
                    },
                    "..."
                )
            )
        );

        const container = div(
            { class: "flex-1 overflow-auto mb-4" },
            this.list,
            this.indicator
        );

        return container;
    }

    // async postMessage(content, type = "message", options = {}) {
    //     // POST message to backend API
    //     console.log("Posting message to backend:", content);
    //     const response = await fetch("/api/chat/response", {
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //             conversation: this.conversation,
    //             type: type,
    //             content: content,
    //             tools: toolBox.listAvailable(),
    //             ...options,
    //         }),
    //     });
    //     const data = await response.json();
    //     return data;
    // }

    async addMessage(content, type = "message", options = {}) {
        console.log("Adding message:", content);
        return await this.data.add({
            role: "user",
            type: type,
            content: content,
            ...options,
        });
    }

    async sendMessage(content, type = "message", options = {}) {
        let messageId = await this.addMessage(content, type, options);
        let response = await chatClient.postMessage(content, type, options);

        console.log(messageId);
        await this.data.update(messageId, { responseId: response.id });
        eventBus.fire("ui.requestResponse", {
            conversation: this.conversation,
            type: type,
            content: content,
            ...options,
        });
    }

    // handleNewMessages(messages) {
    //     this.appendMessages(messages);
    //     //this.handleToolRequests(messages);
    // }

    // handleUpdatedMessages(messages) {
    //     this.updateMessages(messages);
    //     this.handleToolRequests(messages);
    // }

    updateMessageContent(element, message) {
        element.innerHTML = marked(message.content, { breaks: true });

        if (message.role === "system") {
            element.className =
                "bg-gray-100 text-gray-700 p-3 rounded block max-w-5xl mx-auto italic text-sm font-mono message-content";
        } else {
            element.className =
                message.role === "user"
                    ? "bg-blue-500 text-white p-2 rounded inline-block message-content"
                    : "bg-gray-300 text-black p-2 rounded inline-block message-content";
        }

        if (message.type === "tool_request") {
            element.className += " italic text-sm font-mono ml-6 text-gray-600";
        } else if (message.type === "tool_response") {
            element.className += " italic text-sm font-mono mr-6 text-gray-300";
        }
    }

    // updateMessages(messages) {
    //     messages.forEach((message) => {
    //         const spanElement = document.getElementById(
    //             `message-${message.id}`
    //         );
    //         if (spanElement) {
    //             this.updateMessageContent(spanElement, message);
    //         }
    //     });
    // }

    appendMessages(messages) {
        const { li, span } = van.tags;

        messages.forEach((message) => {
            if (
                message.content === undefined ||
                message.content === null ||
                message.content === ""
            )
                return;

            const spanElement = span({
                id: `message-${message.id}`,
            });
            this.updateMessageContent(spanElement, message);

            const messageElement = li(
                {
                    class:
                        message.role === "user"
                            ? "text-right mb-2"
                            : "text-left mb-2",
                },
                spanElement
            );

            van.add(this.list, messageElement);
        });

        if (this.waitingTimer) {
            clearInterval(this.waitingTimer);
            this.waitingTimer = null;
        }

        this.hideIndicator();

        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const lastRole = lastMessage.role;
            const lastAge = lastMessage.updated
                ? new Date().getTime() - lastMessage.updated.seconds * 1000
                : 0;

            console.log("Last message role and age:", lastRole, lastAge);

            if (lastRole === "user" && lastAge > 5 * 60 * 1000) {
                this.showIndicator(
                    "We haven't received a response from your last message. Try sending another message to retry.",
                    "warning"
                );
            } else if (lastRole === "user" || lastRole === "system") {
                this.showIndicator("Waiting for response...", "loading");
                let startWaitTime =
                    lastMessage.updated?.toMillis() || new Date().getTime();

                this.waitingTimer = window.setInterval(() => {
                    const age = (new Date().getTime() - startWaitTime) / 1000;

                    this.showIndicator(
                        `Still waiting for response... ${age.toFixed(0)}s`,
                        "loading"
                    );
                }, 5000);
            }
        }

        eventBus.fire("ui.updateMessages", { messages: messages });
    }
}

export default Messages;
export { Messages };
