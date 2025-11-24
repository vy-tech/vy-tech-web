import van from "vanjs-core";
import { auth } from "../rsauth.js";
import { ConversationsData } from "../data/conversations.js";
import { eventBus } from "../eventbus.js";
import { progress } from "../ui/progress.js";
import { chatClient } from "../chat/client.js";

class Conversations {
    constructor() {
        this.current = null;
        this.conversations = van.state([]);
        this.data = new ConversationsData();

        this.init();
    }

    init() {
        eventBus.addEventListener("auth.ready", async (e) => {
            await this.setSelectorToCurrentUser(e.detail.user.uid);
        });

        eventBus.addEventListener("ui.requestResponse", async (e) => {
            if (this.current && this.current.question == "(New Conversation)") {
                const conversationId = this.current.conversation;
                this.data.update(this.current.id, {
                    name: e.detail.content,
                    question: e.detail.content,
                });

                document.getElementById(
                    "convo-select"
                ).selectedOptions[0].text = e.detail.content;

                this.current.name = e.detail.content;
                this.current.question = e.detail.content;

                // await this.setSelectorToCurrentUser(auth.user.uid);
                // this.selectConversation(conversationId);

                // window.setTimeout(() => {
                //     document.getElementById("convo-select").value =
                //         conversationId;
                // }, 100);
            }
        });
    }

    // async startConversation() {
    //     const response = await fetch("/api/chat/start", {
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json",
    //         },
    //     });
    //     const data = await response.json();

    //     return data;
    // }

    // async finishConversation(conversationId) {
    //     await fetch("/api/chat/finish", {
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //             conversation: conversationId,
    //         }),
    //     });
    // }

    async createConversation() {
        const question = "(New Conversation)";
        const uid = auth.user.uid;
        const conversation = await chatClient.startConversation();
        const data = await this.data.create(uid, question, conversation);

        console.log("Created new conversation:", data);
        this.current = data;

        // Cannot just unshift because van state arrays need to be replaced to trigger reactivity
        this.conversations.val = [data, ...this.conversations.val];

        return data;
    }

    selectConversation(conversation) {
        // The select onchange event provides the conversation ID as a string
        // whereas the createConversation method provides the full conversation object
        if (typeof conversation === "string") {
            console.log("Selecting conversation by ID:", conversation);
            this.current = this.conversations.val.find(
                (c) => c.conversation === conversation
            );
        } else {
            console.log("Selecting conversation by object:", conversation);
            this.current = conversation;
        }

        if (this.current) {
            eventBus.fire("ui.requestConversation", this.current);
        }
    }

    async selectNewConversation() {
        const newConversation = await this.createConversation();
        console.log("Selecting new conversation:", newConversation);
        this.selectConversation(newConversation);
    }

    async deleteConversation() {
        if (!this.current) return;

        const conversation = this.current;

        const { closed, pct } = progress.show("Deleting conversation...");

        // Tell backend to finish the conversation
        try {
            console.log(`Finishing conversation ${this.current.conversation}`);
            await chatClient.finishConversation(this.current.conversation);
        } catch (e) {
            console.warn("Failed to finish conversation:", e);
        }

        pct.val = 20;

        console.log(`Deleting conversation ${this.current.id}`);
        // Delete the conversation from the database
        await this.data.delete(this.current.id);
        pct.val = 40;

        console.log(`Updating local conversation list`);
        // Remove the conversation from the local list
        this.conversations.val = this.conversations.val.filter(
            (c) => c.id !== this.current.id
        );

        // Select another conversation or create a new one
        if (this.conversations.val.length > 0) {
            this.selectConversation(this.conversations.val[0]);
        } else {
            await this.selectNewConversation();
        }
        pct.val = 60;

        // Update the selector element
        const selectElement = document.getElementById("convo-select");
        if (selectElement) {
            selectElement.value = this.current.conversation;
        }

        // Notify other components about the deletion
        eventBus.fire("ui.requestDeleteConversation", conversation);
        pct.val = 80;

        eventBus.once("ui.deletedConversationMessages", () => {
            console.log("Conversation messages deleted.");
            pct.val = 100;
            window.setTimeout(() => {
                closed.val = true;
            }, 250);
        });
    }

    async setSelectorToCurrentUser(uid) {
        const conversations = await this.data.getByUid(uid);
        this.conversations.val = conversations;

        if (conversations.length > 0) {
            this.selectConversation(conversations[0]);
        } else {
            await this.selectNewConversation();
        }
    }

    createOptionElement(conversationData) {
        const { option } = van.tags;

        const displayText = conversationData.name || "(Unnamed Conversation)";

        return option(
            {
                value: conversationData.conversation,
            },
            displayText
        );
    }

    createSelectorElement() {
        const { div, select, button } = van.tags;

        const container = div(
            { class: "w-full" },
            div(
                { class: "flex gap-2 items-center" },
                () => {
                    const sel = select({
                        id: "convo-select",
                        class: "flex-1 text-black py-2 px-3 border rounded-l-lg bg-white h-10",
                    });

                    this.conversations.val.forEach((conversationData) =>
                        van.add(sel, this.createOptionElement(conversationData))
                    );

                    sel.addEventListener("change", (e) => {
                        this.selectConversation(e.target.value);
                    });

                    return sel;
                },
                // Plus button to create new conversation
                button(
                    {
                        class: "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-lg flex-shrink-0 h-10",
                        onclick: async () => {
                            await this.selectNewConversation();
                        },
                    },
                    "+"
                ),

                // Plus button to create new conversation
                button(
                    {
                        class: "bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-l-lg rounded-r-lg flex-shrink-0 h-10",
                        onclick: async () => {
                            if (
                                confirm(
                                    "Are you sure you want to delete this converation?"
                                )
                            )
                                await this.deleteConversation();
                        },
                    },
                    "−"
                )
            )
        );

        return container;
    }
}

export default Conversations;
export { Conversations };
