import { database } from "./db.js";

class ConversationsData {
    constructor() {}

    async getById(id) {
        console.log("Getting conversation by ID:", id);
        return await database.get("conversations", id);
    }

    async getByConversationId(conversationId) {
        console.log("Getting conversation by conversation ID:", conversationId);
        const results = await database.query("conversations", {
            conversation: conversationId,
        });

        if (results.length === 0) return null;
        return results[0];
    }

    async getByUserId(userId) {
        console.log("Getting conversations for user ID:", userId);
        return await database.query("conversations", { uid: userId });
    }

    async listenByUserId(userId, callback) {
        console.log("Listening to conversations for user ID:", userId);
        return await database.listen("conversations", callback, {
            uid: userId,
        });
    }

    async getAllConversations() {
        console.log("Getting all conversations");
        return await database.query("conversations");
    }

    async create(uid, question, conversation) {
        const conversationData = {
            uid: uid,
            name: question,
            question: question,
            conversation: conversation,
            status: "active",
        };

        await database.set("conversations", conversationData);

        return conversationData;
    }

    async update(id, updates) {
        return await database.update("conversations", id, updates);
    }

    async delete(id) {
        return await database.delete("conversations", id);
    }

    async getByUid(uid) {
        console.log("Getting conversations for UID:", uid);
        const results = await database.query("conversations", { uid: uid });

        results.sort((a, b) => {
            return b.updated - a.updated;
        });
        console.log("Found conversations:", results);
        return results;
    }
}

export default ConversationsData;
export { ConversationsData };
