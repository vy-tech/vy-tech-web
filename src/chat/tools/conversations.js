import { ConversationsData } from "../../data/conversations.js";

class ConversationsTool {
    constructor() {
        this.data = new ConversationsData();
    }

    get name() {
        return "get_conversations";
    }

    get description() {
        return "Get conversations associated with this user or retrieve a specific conversation.";
    }

    get parameters() {
        return {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description:
                        "The id of the conversation to retrieve (optional, if not provided retrieves all conversations for the user)",
                },
            },
        };
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}, auth) {
        console.log("Invoking ConversationsTool with args:", args, auth);

        if (args.id) {
            console.log("Fetching conversation by id:", args.id);
            return await this.data.getByConversationId(args.id);
        } else {
            const user = auth?.currentUser;
            if (!user) {
                throw new Error("User not authenticated");
            }

            console.log("Fetching conversations for user:", user.uid);
            return await this.data.getByUserId(user.uid);
        }
    }
}

export default ConversationsTool;
export { ConversationsTool };
