import { database } from "./db.js";

class MessagesData {
    constructor(conversation) {
        this.conversation = conversation;
        this.history = [];
        this.lookup = {};
    }

    static async updateResponse(response_id, updates) {
        const messages = await database.query("messages", {
            response_id: response_id,
        });

        if (messages.length === 0) {
            throw new Error(
                `No message found with response_id: ${response_id}`
            );
        }

        const message = messages[0];
        return await database.update("messages", message.id, updates);
    }

    receive(messages) {
        const newMessages = [];

        for (const message of messages) {
            if (!this.lookup[message.id]) {
                this.history.push(message);
                this.lookup[message.id] = message;
                newMessages.push(message);
            }
        }

        if (newMessages.length > 0 && this.callback) {
            newMessages.sort((a, b) => a.created - b.created);
            this.callback(newMessages);
        }
    }

    async listen(callback) {
        this.callback = callback;
        this.listener = await database.listen(
            "messages",
            (messages) => this.receive(messages),
            {
                conversation: this.conversation,
            }
        );
    }

    stopListening() {
        if (this.listener) {
            database.stop(this.listener);
            this.listener = null;
        }
    }

    async add(messageData) {
        messageData.conversation = this.conversation;
        return await database.set("messages", messageData);
    }

    async update(id, updates) {
        return await database.update("messages", id, updates);
    }

    async deleteConversation(id) {
        let messages = await database.query("messages", { conversation: id });
        for (const message of messages) {
            await database.delete("messages", message.id);
        }
    }
}

export default MessagesData;
export { MessagesData };
