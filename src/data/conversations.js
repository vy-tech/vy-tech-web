import { database } from "./db.js";

class ConversationsData {
    constructor() {}

    async getById(id) {
        return await database.get("conversations", id);
    }

    async getByConversationId(conversationId) {
        const results = await database.query("conversations", {
            conversation: conversationId,
        });

        if (results.length === 0) return null;
        return results[0];
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
        const results = await database.query("conversations", { uid: uid });

        results.sort((a, b) => {
            return b.updated - a.updated;
        });
        return results;
    }
}

export default ConversationsData;
export { ConversationsData };
