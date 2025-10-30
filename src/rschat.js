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
        this.addElements();
        await this.messages.init();
        eventBus.on("ui.updateMessages", () => {
            this.scrollToBottom();
        });
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
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-full h-full flex flex-col items-center" },
                div(
                    { class: "w-full p-4 flex flex-col h-full" },
                    div(
                        { class: "flex space-x-4 flex-shrink-0 mb-4" },
                        this.conversations.createSelectorElement()
                    ),
                    div(
                        {
                            id: "chat-window",
                            class: "flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-4",
                        },
                        this.messages.createElements()
                    ),
                    div(
                        { class: "flex mt-4 flex-shrink-0" },
                        input({
                            id: "chat-input",
                            type: "text",
                            class: "border p-2 w-full text-black rounded-l-lg",
                            placeholder: "Type a message...",
                            onkeydown: async (e) => {
                                if (e.key === "Enter") {
                                    await this.sendTextInput();
                                }
                            },
                        }),
                        button(
                            {
                                class: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-lg",
                                onclick: async () => await this.sendTextInput(),
                            },
                            "Send"
                        )
                    )
                )
            )
        );
    }
}

const chat = new Chat();
export { Chat, chat };
