import van from "vanjs-core";
import Fuse from "fuse.js";

import { auth } from "../rsauth.js";
import { ConversationsData } from "../data/conversations.js";
import { eventBus } from "../eventbus.js";
import { progress } from "../ui/progress.js";
import { chatClient } from "../chat/client.js";
import { timeUtil } from "../util/time.js";

class Conversations {
    constructor() {
        this.current = null;
        this.allConversations = []; // Store all conversations from Firestore
        this.conversations = van.state([]); // Filtered conversations for display
        this.data = new ConversationsData();
        this.selectedConversation = van.state(null);
        this.searchTerm = van.state(""); // Search term state

        // Initialize Fuse.js for enhanced search
        this.fuse = null;
        this.fuseOptions = {
            keys: [
                { name: "name", weight: 0.6 },
                { name: "question", weight: 0.3 },
                { name: "summary", weight: 0.1 },
            ],
            threshold: 0.4, // 0 = exact match, 1 = match anything
            includeScore: true,
            minMatchCharLength: 2,
        };

        this.init();
    }

    init() {
        eventBus.addEventListener("auth.ready", async (e) => {
            //await this.setSelectorToCurrentUser(e.detail.user.uid);
            await this.listenToCurrentUser(e.detail.user.uid);
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
            }
        });

        eventBus.addEventListener(
            "ui.requestRestartConversation",
            async (e) => {
                await this.selectRestartConversation();
            }
        );
    }

    // Update Fuse index when conversations change
    updateFuseIndex() {
        this.fuse = new Fuse(this.allConversations, this.fuseOptions);
    }

    // Method to filter conversations based on search term
    filterConversations() {
        const searchTerm = this.searchTerm.val.trim();

        if (!searchTerm) {
            this.conversations.val = [...this.allConversations];
        } else if (this.fuse) {
            console.log("Searching with fuse..");
            const results = this.fuse.search(searchTerm);
            // Extract items from Fuse results and sort by relevance score
            this.conversations.val = results.map((result) => result.item);
        } else {
            console.log("Searching by substring..");
            // Fallback to simple filtering if Fuse isn't ready
            this.conversations.val = this.allConversations.filter((conv) => {
                const name = (conv.name || "").toLowerCase();
                const question = (conv.question || "").toLowerCase();
                const summary = (conv.summary || "").toLowerCase();
                const search = searchTerm.toLowerCase();

                return (
                    name.includes(search) ||
                    question.includes(search) ||
                    summary.includes(search)
                );
            });
        }
    }

    async createConversation() {
        const question = "(New Conversation)";
        const uid = auth.user.uid;
        const conversation = await chatClient.startConversation();
        const data = await this.data.create(uid, question, conversation);

        console.log("Created new conversation:", data);
        this.current = data;

        // Add to all conversations
        this.allConversations = [data, ...this.allConversations];
        // Clear search filter so new conversation is visible
        this.searchTerm.val = "";
        // Update Fuse search index
        this.updateFuseIndex();
        // Update filtered conversations
        this.filterConversations();

        return data;
    }

    async restartConversation() {
        if (!this.current) return;

        const question = this.current.question;
        const uid = auth.user.uid;
        const cid = this.current.conversation;
        const newCid = await chatClient.restartConversation(cid);

        const data = await this.data.create(uid, question, newCid);

        console.log("Restarted conversation:", data);
        this.current = data;

        // Add to all conversations
        this.allConversations = [data, ...this.allConversations];
        // Clear search filter so restarted conversation is visible
        this.searchTerm.val = "";
        // Update Fuse search index
        this.updateFuseIndex();
        // Update filtered conversations
        this.filterConversations();

        return data;
    }

    selectConversation(conversation) {
        // The select onchange event provides the conversation ID as a string
        // whereas the createConversation method provides the full conversation object
        if (typeof conversation === "string") {
            console.log("Selecting conversation by ID:", conversation);
            // Search in all conversations first, then filtered
            this.current =
                this.allConversations.find(
                    (c) => c.conversation === conversation
                ) ||
                this.conversations.val.find(
                    (c) => c.conversation === conversation
                );
            this.selectedConversation.val = conversation;
        } else {
            console.log("Selecting conversation by object:", conversation);
            this.current = conversation;
            this.selectedConversation.val = conversation.conversation;
        }

        if (this.current) {
            eventBus.fire("ui.requestConversation", this.current);
        }
    }

    async selectNewConversation() {
        const newConversation = await this.createConversation();
        console.log("Selecting new conversation:", newConversation);
        this.selectConversation(newConversation);
        // Scroll to top to show the new conversation
        setTimeout(() => this.scrollToTop(), 100);
    }

    async selectRestartConversation() {
        const restartedConversation = await this.restartConversation();
        console.log("Selecting restarted conversation:", restartedConversation);
        this.selectConversation(restartedConversation);
        // Scroll to top to show the restarted conversation
        setTimeout(() => this.scrollToTop(), 100);
    }

    scrollToTop() {
        // Find the conversations list container and scroll it to the top
        const conversationsContainer = document.getElementById(
            "conversations-sidebar-list"
        );
        if (conversationsContainer) {
            conversationsContainer.scrollTop = 0;
        }
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
        // Remove from all conversations
        this.allConversations = this.allConversations.filter(
            (c) => c.id !== this.current.id
        );
        // Update Fuse search index
        this.updateFuseIndex();
        // Update filtered conversations
        this.filterConversations();

        // Select another conversation or create a new one
        if (this.conversations.val.length > 0) {
            this.selectConversation(this.conversations.val[0]);
        } else if (this.allConversations.length > 0) {
            // If filtered list is empty but we have conversations, select from all
            this.selectConversation(this.allConversations[0]);
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

    async listenToCurrentUser(uid) {
        await this.setSelectorToCurrentUser(uid);

        this.data.listenByUserId(uid, async (changedConversations) => {
            console.log(
                "Received updated conversations for user:",
                uid,
                changedConversations
            );

            for (const c of changedConversations) {
                const index = this.allConversations.findIndex(
                    (conv) => conv.id === c.id
                );
                if (index !== -1) {
                    // Update existing conversation
                    this.allConversations[index] = c;
                } else {
                    // New conversation added
                    this.allConversations = [c, ...this.allConversations];
                }
            }

            // Sort conversations by updated time
            this.allConversations.sort((a, b) => b.updated - a.updated);

            // Update Fuse search index
            this.updateFuseIndex();
            // Update filtered conversations
            this.filterConversations();
        });
    }

    async setSelectorToCurrentUser(uid) {
        const conversations = await this.data.getByUid(uid);
        conversations.sort((a, b) => b.updated - a.updated);

        // Store all conversations
        this.allConversations = conversations;
        // Initialize Fuse search index
        this.updateFuseIndex();

        // If there's already a "New Conversation", select it; otherwise, create one
        let toSelect = conversations.find(
            (c) => c.name === "(New Conversation)"
        );
        if (toSelect) {
            this.selectConversation(toSelect);
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

    createConversationItem(conversationData) {
        const { div, span, button } = van.tags;

        const displayText = conversationData.name || "(Unnamed Conversation)";
        const isSelected = () =>
            this.selectedConversation.val === conversationData.conversation;

        const result = div(
            {
                class: () => `
                    flex items-center justify-between p-3 cursor-pointer rounded-lg mb-2
                    transition-colors duration-200 group
                    ${
                        isSelected()
                            ? "bg-blue-100 border-l-4 border-blue-500 text-blue-900"
                            : "hover:bg-gray-50 border-l-4 border-transparent"
                    }
                `,
                onclick: () =>
                    this.selectConversation(conversationData.conversation),
            },
            div(
                { class: "flex-1 min-w-0" },
                div(
                    {
                        class: () => `
                            text-sm font-medium line-clamp-2
                            ${isSelected() ? "text-blue-900" : "text-gray-900"}
                        `,
                        title: displayText,
                    },
                    displayText
                ),
                div(
                    { class: "text-xs text-gray-500 mt-1" },
                    timeUtil.formatTimeAgo(conversationData.updated)
                )
            ),
            // Delete button (only show on hover)
            button(
                {
                    class: "opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50",
                    onclick: async (e) => {
                        e.stopPropagation();
                        if (
                            confirm(
                                "Are you sure you want to delete this conversation?"
                            )
                        ) {
                            const previousCurrent = this.current;
                            this.current = conversationData;
                            await this.deleteConversation();
                            if (
                                this.conversations.val.includes(
                                    conversationData
                                )
                            ) {
                                this.current = previousCurrent;
                            }
                        }
                    },
                },
                van.tags.i({ class: "las la-trash text-xs" })
            )
        );

        return result;
    }

    createSidebarElement() {
        const { div, button, h3, input } = van.tags;

        return div(
            {
                class: "w-80 bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-300",
            },
            // Header with title and collapse button
            div(
                {
                    class: "flex items-center justify-between p-4 border-b border-gray-200",
                },

                div(
                    h3(
                        {
                            class: "text-lg font-semibold text-gray-900",
                        },
                        "Conversations"
                    )
                )
            ),

            // Search/Filter input (hidden when collapsed)
            div(
                { class: "p-4 border-b border-gray-200" },
                input({
                    type: "text",
                    placeholder: "Search conversations...",
                    class: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900",
                    value: this.searchTerm,
                    oninput: (e) => {
                        this.searchTerm.val = e.target.value;
                        this.filterConversations();
                    },
                })
            ),
            // New conversation button (hidden when collapsed)
            div(
                { class: "p-4" },
                button(
                    {
                        class: "w-full bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2",
                        onclick: async () => {
                            await this.selectNewConversation();
                        },
                    },
                    van.tags.i({ class: "las la-plus" }),
                    "New Conversation"
                )
            ),

            // Conversations list
            div(
                {
                    id: "conversations-sidebar-list",
                    class: "flex-1 overflow-y-auto p-4",
                },
                () => {
                    return this.conversations.val.length > 0
                        ? div(
                              this.conversations.val.map((conv) =>
                                  this.createConversationItem(conv)
                              )
                          )
                        : div(
                              { class: "text-center text-gray-500 py-8" },
                              div(
                                  { class: "text-4xl mb-2" },
                                  van.tags.i({ class: "las la-comments" })
                              ),
                              this.searchTerm.val
                                  ? div("No matching conversations")
                                  : div("No conversations yet"),
                              div(
                                  { class: "text-sm" },
                                  this.searchTerm.val
                                      ? "Try a different search term"
                                      : "Create one to get started!"
                              )
                          );
                }
            )
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
                                    "Are you sure you want to delete this conversation?"
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
