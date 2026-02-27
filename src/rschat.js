import van from "vanjs-core";

import { Messages } from "./ui/messages.js";
import { Conversations } from "./ui/conversations.js";
import { eventBus } from "./eventbus.js";

class Chat {
    constructor() {
        this.messages = new Messages();
        this.conversations = new Conversations();
    }

    async init() {
        console.log("Initializing Chat UI...");
        this.addElements();
        await this.messages.init();
        eventBus.on("ui.updateMessages", () => {
            this.scrollToBottom();
        });
        console.log("rschat Init complete");
    }

    scrollToBottom() {
        const chatWindow = document.getElementById("chat-window");
        if (chatWindow) {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    }

    async sendTextInput() {
        const inputElement = document.getElementById("chat-input");
        const message = inputElement.value;
        if (message.trim() === "") return;

        // Display user message in chat window
        inputElement.value = "";

        // Send message to backend
        await this.messages.sendMessage(message);
    }

    addElements(parentElement) {
        const { a, div, main, h1, input, button } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-full h-full flex" },
                // Main chat area - takes full width on mobile, partial on desktop
                div(
                    { class: "flex-1 flex flex-col p-4" },
                    // Mobile dropdown (hidden on lg+ screens)
                    div(
                        {
                            class: "flex space-x-4 flex-shrink-0 mb-4 lg:hidden",
                        },
                        this.conversations.createSelectorElement()
                    ),
                    // Chat messages area
                    div(
                        {
                            id: "chat-window",
                            class: "flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-4",
                        },
                        this.messages.createElements()
                    ),
                    // Input area
                    div(
                        {
                            class: "mt-4 flex-shrink-0 bg-white border rounded-lg p-3 shadow-sm",
                        },
                        // Top row - text input
                        div(
                            { class: "mb-3" },
                            input({
                                id: "chat-input",
                                type: "text",
                                class: "w-full text-black bg-transparent outline-none placeholder-gray-500",
                                placeholder: "Type a message...",
                                onkeydown: async (e) => {
                                    if (e.key === "Enter") {
                                        await this.sendTextInput();
                                    }
                                },
                            })
                        ),
                        // Bottom row - buttons
                        div(
                            { class: "flex justify-between items-center" },
                            // Left column - action buttons
                            div(
                                { class: "flex space-x-2" },
                                button(
                                    {
                                        class: "text-gray-500 hover:text-gray-700 p-1 rounded",
                                        title: "Attach file",
                                        onclick: () => {
                                            // TODO: Implement attach functionality
                                            console.log("Attach clicked");
                                        },
                                    },
                                    van.tags.i({ class: "las la-paperclip" })
                                ),
                                button(
                                    {
                                        class: "text-gray-500 hover:text-gray-700 p-1 rounded",
                                        title: "Restart conversation",
                                        onclick: () => {
                                            console.log("Restart clicked");

                                            if (
                                                confirm(
                                                    "This starts a new conversation that continues where this one left off.  " +
                                                        "Use this if the current conversation is stuck." +
                                                        "\n\n" +
                                                        "Restart the conversation?"
                                                )
                                            ) {
                                                eventBus.fire(
                                                    "ui.requestRestartConversation"
                                                );
                                            }
                                        },
                                    },
                                    van.tags.i({ class: "las la-redo-alt" })
                                )
                            ),
                            // Right column - send button
                            button(
                                {
                                    class: "bg-blue-500 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-md text-sm",
                                    onclick: async () =>
                                        await this.sendTextInput(),
                                },
                                "Send"
                            )
                        )
                    )
                ),
                // Desktop sidebar (hidden on mobile, shown on lg+ screens)
                div(
                    { class: "hidden lg:flex" },
                    this.conversations.createSidebarElement()
                )
            )
        );
    }
}

const chat = new Chat();
export { Chat, chat };
