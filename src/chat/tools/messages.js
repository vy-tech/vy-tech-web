import { MessagesData } from "../../data/messages.js";

class MessagesTool {
    constructor() {}

    get name() {
        return "get_messages";
    }

    get description() {
        return "Get messages associated with a conversation.";
    }

    get parameters() {
        return {
            type: "object",
            properties: {
                conversation: {
                    type: "string",
                    description:
                        'The id of the conversation to retrieve messages for (starts with "conv_")',
                },

                since: {
                    type: "number",
                    description:
                        "A timestamp (in milliseconds since epoch) to retrieve messages created after this time (optional)",
                },
            },
            required: ["conversation"],
        };
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}, auth) {
        if (!args.conversation) {
            throw new Error("Conversation argument is required");
        }

        let data = new MessagesData(args.conversation);

        return args.since
            ? await data.getSince(args.since)
            : await data.getAll();
    }
}

export default MessagesTool;
export { MessagesTool };
