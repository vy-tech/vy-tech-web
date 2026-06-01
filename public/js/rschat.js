import { e as eventBus, v as van } from './chunks/eventbus-c5hoJhOF.js';
import { k } from './chunks/marked.esm-DDAYIbNt.js';
import { d as database, g as getApp, b as getAuth } from './chunks/apiUtil-CDq4WBQY.js';
import { E as EventsData } from './chunks/events-DTIA-1Jc.js';
import { H as Hierarchy } from './chunks/hierarchy-HD-XXbBO.js';
import { S as Summarizer, p as progress } from './chunks/summarizer-n6XNy39N.js';
import { A as AnnotationsData } from './chunks/annotations-BN4rneuv.js';
import { a as auth } from './chunks/rsauth-y2JyFrU_.js';
import { t as timeUtil } from './chunks/time-CkvqO9Ha.js';
import './chunks/orgContext-CvnztG5e.js';
import './chunks/storage-Dh8pfopK.js';
import './chunks/van-ui-D8yynE9H.js';

class MessagesData {
    constructor(conversation) {
        this.conversation = conversation;
        this.history = [];
        this.lookup = {};
    }

    async getAll() {
        const results = await database.query("messages", {
            conversation: this.conversation,
        });

        results.sort((a, b) => {
            return a.created - b.created;
        });

        return results;
    }

    async getSince(timestamp) {
        const results = await this.getAll();

        if (timestamp)
            return results.filter((msg) => msg.created.toMillis() > timestamp);

        return results;
    }

    async getRecent(limit = 10) {
        const results = await this.getAll();
        return results.slice(-limit);
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

    asText(messages) {
        return messages
            .map(
                (msg) =>
                    `${
                        msg.type == "tool_response"
                            ? "TOOL"
                            : msg.role.toUpperCase()
                    }: ${msg.content}`
            )
            .join("\n");
    }
}

class MagicBoxTool {
    constructor() {}

    get name() {
        return "magic_box";
    }
    get description() {
        return "Get the current number from the magic box";
    }
    get parameters() {
        return null;
    }

    get supportsCursors() {
        return false;
    }

    async invoke(args = {}) {
        return Math.floor(Math.random() * 100);
    }
}

class EventsTool {
    constructor() {
        this.data = new EventsData();
    }

    get name() {
        return "events_list";
    }

    get description() {
        return "Get a list of available events";
    }
    get parameters() {
        return null;
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        const events = await this.data.getAvailable();

        const result = events.map((event) => ({
            hierarchy: new Hierarchy(event.hierarchy).toEventString(),
            location: event.location,
            name: event.name.replace(/\(Baseball\) /, "").trim(),
            summary: event.summary,
            begin: event.begin.toDate(),
            end: event.end.toDate(),
            duration: event.summary.seconds,
            cameras: event.summary.cameras,
        }));

        return result;
    }
}

class LocationsTool {
    constructor() {}

    get name() {
        return "locations_list";
    }

    get description() {
        return "Get a list of available locations and associated camera information";
    }

    get parameters() {
        return null;
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        return [
            {
                id: "TrzuVvQbPapdTO34Jj0t",
                token: "raimondi",
                name: "Raimondi Park",
                address: "1800 Wood St, Oakland, CA 94607",
                location: [37.815921, -122.293861],
                cameras: [
                    {
                        number: 1,
                        view: "General Admission Seating, First Base Line",
                    },
                    {
                        number: 2,
                        view: "General Admission Seating, Third Base Line",
                    },
                    { number: 3, view: "Reserved Seating, First Base Line" },
                    { number: 4, view: "Reserved Seating, Third Base Line" },
                    { number: 5, view: "Concession Area" },
                ],
            },
        ];
    }
}

class SummarySecondsTool {
    constructor() {}

    get name() {
        return "get_summary_seconds";
    }

    get description() {
        return "Get per second engagement summary for a given hierarchy";
    }

    get parameters() {
        return {
            type: "object",
            properties: {
                hierarchy: {
                    type: "string",
                    description:
                        'The hierarchy identifier ("location:date:camera" eg:"raimondi:20250711:01") for the event to summarize',
                },
                start: {
                    type: "number",
                    description:
                        "The starting second for the summary (inclusive, optional)",
                },
                end: {
                    type: "number",
                    description:
                        "The ending second for the summary (exclusive, optional)",
                },
            },
            required: ["hierarchy"],
        };
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        if (!args.hierarchy) {
            throw new Error("Hierarchy argument is required");
        }

        const hierarchy = new Hierarchy(args.hierarchy);
        const summarizer = new Summarizer();
        const summary = await summarizer.loadFromStorage(
            hierarchy.toString("-")
        );

        const start = args.start !== undefined ? args.start : 0;
        const end = args.end !== undefined ? args.end : summary.length;

        return summary.slice(start, end);
    }
}

class SummaryMinutesTool {
    constructor() {}

    get name() {
        return "get_summary_minutes";
    }
    get description() {
        return "Get per minute engagement summary for a given hierarchy";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                hierarchy: {
                    type: "string",
                    description:
                        'The hierarchy identifier ("location:date:camera" eg:"raimondi:20250711:01") for the event to summarize',
                },
            },
            required: ["hierarchy"],
        };
    }
    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        if (!args.hierarchy) {
            throw new Error("Hierarchy argument is required");
        }

        const hierarchy = new Hierarchy(args.hierarchy);
        const summarizer = new Summarizer();
        const summary = await summarizer.loadFromStorage(
            hierarchy.toString("-")
        );
        const minutesSummary = [];
        for (let i = 0; i < summary.length; i += 60) {
            const minuteSlice = summary.slice(i, i + 60);

            const minuteSum = {
                startTime: minuteSlice[0].startTime,
                endTime: minuteSlice[minuteSlice.length - 1].endTime,
                total: 0,
                people: 0,
                min: 99999999,
                max: -99999999,
                average: 0,
                stddev: 0,
            };

            let sumOfSquares = 0;
            for (const sec of minuteSlice) {
                minuteSum.total += sec.score;
                minuteSum.people += sec.people;
                minuteSum.min = Math.min(minuteSum.min, sec.score);
                minuteSum.max = Math.max(minuteSum.max, sec.score);
                sumOfSquares += sec.score * sec.score;
            }

            minuteSum.average = minuteSum.total / minuteSlice.length;
            minuteSum.people = minuteSum.people / minuteSlice.length;

            // Sample standard deviation (divide by n-1)
            if (minuteSlice.length > 1) {
                const variance =
                    (sumOfSquares -
                        minuteSlice.length *
                            minuteSum.average *
                            minuteSum.average) /
                    (minuteSlice.length - 1);
                minuteSum.stddev = Math.sqrt(variance);
            } else {
                minuteSum.stddev = 0;
            }

            minutesSummary.push(minuteSum);
        }

        return minutesSummary;
    }
}

class AnnotationsTool {
    constructor() {
        this.data = new AnnotationsData();
    }

    get name() {
        return "get_annotations";
    }
    get description() {
        return "Get event annotations (transcripts, game action, non-game events, notes) for a given hierarchy";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                hierarchy: {
                    type: "string",
                    description:
                        'The hierarchy identifier ("location:date" eg:"raimondi:20250711") for the event to get annotations for',
                },
                start: {
                    type: "number",
                    description:
                        "The starting second for the annotations (optional)",
                },
                end: {
                    type: "number",
                    description:
                        "The ending second for the annotations (exclusive, optional)",
                },
            },
            required: ["hierarchy"],
        };
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        if (!args.hierarchy) {
            throw new Error("Hierarchy argument is required");
        }

        const annotations = await this.data.getByHierarchy(args.hierarchy);

        const result = annotations.map((annotation) => ({
            id: annotation.id,
            hierarchy: annotation.hierarchy,
            time: annotation.time,
            type: annotation.type,
            importance: annotation.importance,
            content: annotation.content,
            tags: annotation.tags || [],
        }));

        const start = args.start !== undefined ? args.start : 0;
        const end = args.end !== undefined ? args.end : Number.MAX_SAFE_INTEGER;

        return result.filter((a) => a.time >= start && a.time < end);
    }
}

class WeatherTool {
    constructor() {}

    get name() {
        return "get_weather";
    }
    get description() {
        return "Get the hourly historical weather for the location and day of an event.";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                hierarchy: {
                    type: "string",
                    description:
                        'The hierarchy identifier ("location:date" eg:"raimondi:20250711") for the event to get weather for',
                },
            },
            required: ["hierarchy"],
        };
    }

    get supportsCursors() {
        return false;
    }

    async getAuthHeaders(auth) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("User not authenticated");
        }

        const idToken = await user.getIdToken(true);
        return {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
        };
    }

    async invoke(args = {}, auth = null) {
        if (!args.hierarchy) {
            throw new Error("Hierarchy argument is required");
        }
        if (!auth) {
            throw new Error(
                "Authentication is required to use the Weather tool"
            );
        }
        const authHeaders = await this.getAuthHeaders(auth);

        // Post the request to our chat backend
        const response = await fetch(`/api/chat/tool/weather`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                hierarchy: args.hierarchy,
            }),
        });

        const data = await response.json();
        return data;
    }
}

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

class ToolBox {
    constructor() {
        this.toolsList = [
            new MagicBoxTool(),
            new EventsTool(),
            new LocationsTool(),
            new SummarySecondsTool(),
            new SummaryMinutesTool(),
            new AnnotationsTool(),
            new WeatherTool(),
            new ConversationsTool(),
            new MessagesTool(),
        ];
        this.toolsLookup = {};
        this.toolsList.forEach((tool) => {
            this.toolsLookup[tool.name] = tool;
        });
        this.cursors = {};
        this.auth = null;
    }

    setAuth(auth) {
        this.auth = auth;
    }

    listAvailable() {
        return this.toolsList.map((tool) => {
            const result = {
                type: "function",
                name: tool.name,
                description: tool.description,
            };

            const parameters = tool.parameters;
            if (parameters) {
                result.parameters = { ...parameters };

                if (tool.supportsCursors) {
                    result.parameters.properties.cursor = {
                        type: "string",
                        description:
                            "Cursor identifier for paginated results (optional)",
                    };
                }
            }

            return result;
        });
    }

    async invoke(toolName, args) {
        const tool = this.toolsLookup[toolName];
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }

        // If no args then just invoke the tool
        if (!args) return await tool.invoke({}, this.auth);

        args = typeof args === "object" ? args : JSON.parse(args);

        // If a cursor is provided and we have the results
        // already in memory, return them directly
        if (this.hasCursor(args.cursor)) {
            const cursorData = this.getCursor(args.cursor);
            return cursorData;
        }

        // Otherwise invoke the tool as normal
        let result = await tool.invoke(args, this.auth);
        return result;
    }

    getMessageForResult(result, resultJSON) {
        if (Array.isArray(result)) {
            return `  - Returned ${result.length} rows.`;
        } else if (result.from_cursor) {
            return `  - Returned the next page of ${
                result.page_size || 50
            } results`;
        } else if (result.total_rows) {
            return `  - Returned ${result.rows.length} of ${result.total_rows} rows.`;
        } else if (result.keys && result.rows) {
            return `  - Returned ${result.rows.length} rows.`;
        } else if (typeof result === "object") {
            return `  - Returned ${resultJSON.length} bytes.`;
        }
        return `  - Returned value: ${result}`;
    }

    isRows(result) {
        if (result.keys && result.rows) {
            return true;
        } else if (Array.isArray(result)) {
            // If all values of the first row are "flat" (not objects), treat as rows
            const vals = Object.values(result[0]);
            if (vals.every((v) => typeof v !== "object")) {
                return true;
            }
        }
        return false;
    }

    asRows(result) {
        if (result.keys && result.rows) {
            return result;
        }

        if (result.length === 0) {
            return { keys: [], rows: [] };
        }

        const keys = Object.keys(result[0]);
        const rows = [];

        result.forEach((item) => {
            const row = keys.map((key) => item[key]);
            rows.push(row);
        });

        return { keys: keys, rows: rows };
    }

    /**
     * Generates a unique cursor ID encoding the page number and page size.
     */
    getCursorId(pageNumber = 1, pageSize = 50) {
        let cursorId = [
            Math.random().toString(36).substring(2, 10),
            pageNumber.toString(36),
            pageSize.toString(36),
        ].join("-");

        // If the cursorId already exists, try again
        while (this.cursors[cursorId]) {
            return this.getCursorId(pageNumber, pageSize);
        }

        return cursorId;
    }

    /**
     * Returns the next cursor by decoding and incrementing the page number.
     */
    getNextCursorId(cursor, pageSize = 50) {
        if (!cursor) return this.getCursorId(1, pageSize);

        const parts = cursor.split("-");
        const pageNumber = parseInt(parts[1], 36);
        pageSize = parseInt(parts[2], 36);

        return this.getCursorId(pageNumber + 1, pageSize);
    }

    /**
     * Creates an in-memory cursor by returing a page of results
     * and storing the remaining results for later retrieval.
     */
    makeCursor(tool, result, pageSize = 50) {
        const args = (tool.args && JSON.parse(tool.args)) || {};
        const nextCursorId = this.getNextCursorId(args.cursor, pageSize);

        let startIndex = 0;
        // If the tool args have a cursor but we didn't have that one stored
        // then we start at the page indicated by the cursor
        if (args.cursor && !result.fromCursor) {
            const parts = args.cursor.split("-");
            const pageNumber = parseInt(parts[1], 36);
            pageSize = parseInt(parts[2], 36);

            startIndex = pageNumber * pageSize;
        }

        const rowsToReturn = result.rows.slice(
            startIndex,
            startIndex + pageSize
        );
        const rowsRemaining = result.rows.slice(startIndex + pageSize);
        const totalRows = result.totalRows || result.rows.length;

        this.cursors[nextCursorId] = {
            fromCursor: nextCursorId,
            keys: result.keys,
            rows: rowsRemaining,
            pageSize: pageSize,
            totalRows: totalRows,
        };

        const cursorResult = {
            next_cursor: nextCursorId,
            keys: result.keys,
            rows: rowsToReturn,
            total_rows: totalRows,
            page_size: pageSize,
        };

        if (result.fromCursor) {
            cursorResult.from_cursor = result.fromCursor;
        }

        return cursorResult;
    }

    /** Returns true if a cursor exists */
    hasCursor(cursorId) {
        return cursorId && cursorId in this.cursors;
    }

    /** Returns the cursor data and removes it from storage */
    getCursor(cursorId) {
        const result = this.cursors[cursorId];
        if (!result) {
            throw new Error(`Cursor ${cursorId} not found`);
        }

        delete this.cursors[cursorId];
        return result;
    }

    addRowsResult(output, msgs, tool, result, maxSize) {
        let rowsData = this.asRows(result);
        let rowsJSON = JSON.stringify(rowsData);

        // If the result is too large, create a cursor
        if (rowsJSON.length > maxSize) {
            rowsData = this.makeCursor(tool, rowsData);
            rowsJSON = JSON.stringify(rowsData);
        }

        // Create message for result
        let msg = this.getMessageForResult(rowsData, rowsJSON);
        msgs.push(msg);

        // Add to output
        output.push({
            call_id: tool.call_id,
            output: rowsJSON,
        });
    }

    addObjectResult(output, msgs, tool, result, maxSize) {
        const resultJSON = JSON.stringify(result);
        const msg = this.getMessageForResult(result, resultJSON);

        msgs.push(msg);

        if (resultJSON.length > maxSize) {
            output.push({
                call_id: tool.call_id,
                output: JSON.stringify({ error: "Result too large" }),
            });
        } else {
            output.push({
                call_id: tool.call_id,
                output: resultJSON,
            });
        }
    }

    addResult(output, msgs, tool, result, maxSize) {
        if (this.isRows(result)) {
            this.addRowsResult(output, msgs, tool, result, maxSize);
        } else {
            this.addObjectResult(output, msgs, tool, result, maxSize);
        }
    }

    async invokeAll(tools) {
        const outputMaxSize = 100000 / tools.length;
        const promises = tools.map(({ name, args }) => this.invoke(name, args));
        const results = await Promise.all(promises);
        const output = [];
        let msgs = ["Tool results:", ""];

        for (let i = 0; i < tools.length; i++) {
            this.addResult(output, msgs, tools[i], results[i], outputMaxSize);
        }

        return { content: msgs.join("\n"), output: output };
    }
}

const toolBox = new ToolBox();

if (typeof window !== "undefined") {
    window._vy_toolBox = toolBox;
}

const EXPIRE_TIME = 5 * 60 * 1000; // 5 minutes

class WebHooksData {
    constructor() {
        this.pending = {};
        this.cancelListener = null;
        this.expireTimer = null;
    }

    async restore(uid) {
        const rows = await database.query("webhooks", { uid: uid });
        if (!rows || rows.length === 0) {
            return;
        }
        for (const row of rows) {
            this.pending[row.key] = row.updated.toMillis();
        }
    }

    async listen(callback, expireCallback = null) {
        if (!callback)
            throw new Error(
                "Callback function is required for listening to webhooks."
            );

        this.cancelListener = await database.listen(
            "webhooks",
            async (webhooks) => {
                for (const webhook of webhooks) {
                    if (this.pending[webhook.key] && webhook.payload) {
                        delete this.pending[webhook.key];
                        await database.delete("webhooks", webhook.id);
                        callback(webhook.payload);
                    }
                }
            }
        );

        if (expireCallback) {
            this.expireTimer = setInterval(async () => {
                await this.expire(expireCallback);
            }, EXPIRE_TIME / 10);

            // Initial expire check after 1 second
            setTimeout(async () => {
                await this.expire(expireCallback);
            }, 1000);
        }
    }

    async expire(callback) {
        const now = new Date().getTime();
        for (const key in this.pending) {
            if (now - this.pending[key] > EXPIRE_TIME) {
                delete this.pending[key];
                await database.deleteAll("webhooks", { key: key });
                if (callback) {
                    callback(key);
                }
            }
        }
    }

    stopListening() {
        if (this.cancelListener) {
            this.cancelListener();
            this.cancelListener = null;
        }

        if (this.expireTimer) {
            clearInterval(this.expireTimer);
            this.expireTimer = null;
        }
    }

    async create(key, uid) {
        console.log(`Creating webhook with key: ${key}`);
        const result = await database.set("webhooks", {
            key: key,
            uid: uid,
        });

        this.pending[key] = new Date().getTime();

        return result;
    }

    async resolve(key, payload) {
        console.log(`Resolving webhook with key: ${key}`);
        const webhooks = await database.query("webhooks", { key: key });
        if (webhooks.length === 0) {
            throw new Error(`No webhook found for key: ${key}`);
        }

        const webhook = webhooks[0];
        return await database.update("webhooks", webhook.id, {
            payload: payload,
        });
    }
}

const SUMMARIZE_EVERY_MS = 1 * 60 * 1000;

class ChatClient {
    constructor() {
        this.auth = null;
        this.conversation = null;
        this.messages = null;
        this.lastSummarization = null;
        this.webhooks = new WebHooksData();
        this.webhooks.listen(
            (e) => this.handleWebhook(e),
            (key) => this.handleWebhookExpire(key)
        );

        getApp().then((app) => {
            console.log("Initializing ChatClient Auth...");
            this.auth = getAuth(app);
            console.log("Setting Auth in toolBox...");
            toolBox.setAuth(this.auth);
            console.log("Setting up Auth state listener...");
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("Restoring webhooks for user:", user.uid);
                    this.webhooks.restore(user.uid);
                }
            });
            console.log("ChatClient Auth initialized.");
        });
    }

    async getAuthHeaders() {
        const user = this.auth.currentUser;
        if (!user) {
            throw new Error("User not authenticated");
        }

        const idToken = await user.getIdToken(true);
        return {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
        };
    }

    setConversation(conversationId) {
        this.conversation = conversationId;
        this.messages = new MessagesData(this.conversation);
    }

    async startConversation() {
        console.log("Starting new conversation");

        const headers = await this.getAuthHeaders();
        const response = await fetch("/api/chat/start", {
            method: "POST",
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.conversation = data.id;
        this.messages = new MessagesData(this.conversation);

        return this.conversation;
    }

    async restartConversation(conversationId) {
        console.log("Restarting conversation:", conversationId);

        const headers = await this.getAuthHeaders();
        const response = await fetch(`/api/chat/restart/${conversationId}`, {
            method: "POST",
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.conversation = data.conversation.id;
        this.messages = new MessagesData(this.conversation);

        await this.webhooks.create(data.response.id, this.auth.currentUser.uid);

        return this.conversation;
    }

    async finishConversation() {
        if (!this.conversation) {
            console.warn("No active conversation to finish");
            return;
        }

        console.log("Finishing conversation:", this.conversation);

        const headers = await this.getAuthHeaders();
        const response = await fetch("/api/chat/finish", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                conversation: this.conversation,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.conversation = null;
        this.messages = null;

        return data;
    }

    async postMessage(content, type = "message", options = {}) {
        if (!this.conversation) {
            throw new Error(
                "No active conversation. Start a conversation first."
            );
        }

        // POST message to backend API
        console.log("Posting message to backend:", content);

        const headers = await this.getAuthHeaders();
        const response = await fetch("/api/chat/response", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                conversation: this.conversation,
                type: type,
                content: content,
                ...options,
            }),
        });

        if (!response.ok) {
            let reason =
                response.status === 404
                    ? "Conversation not found. It may have been deleted or expired. Please start a new conversation."
                    : "The message failed to send. The conversation may be stuck. Please try starting a new conversation.";

            eventBus.fire("chat.responseFailed", {
                reason: reason,
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        await this.webhooks.create(data.id, this.auth.currentUser.uid);

        return data;
    }

    async handleWebhook(event) {
        console.log("Handling webhook event in ChatClient:", event);

        if (event.type !== "response.completed") {
            console.log("Ignoring non-response.completed event");
            return;
        }

        const responseId = event.data.id;
        const response = await this.getResponseUntilCompleted(responseId);

        if (response.status !== "completed") {
            console.error("Response is not completed. Cannot process.");

            eventBus.fire("chat.responseFailed", {
                failure: `Response status is ${response.status} on webhook complete.`,
                response: response,
            });

            return;
        }

        return await this.processResponse(response);
    }

    async processResponse(response) {
        const outputText = this.getTextFromResponse(response);
        const toolRequests = this.getToolRequestsFromResponse(response);

        if (outputText) {
            console.log("Received output text:", outputText);
            this.addTextMessage(outputText, { responseId: response.id });

            this.summarizeIfNeeded();
        }

        if (toolRequests.length > 0) {
            this.addToolRequestMessage(toolRequests, {
                responseId: response.id,
            });

            console.log("Invoking tools:", toolRequests);
            const toolResponses = await this.invokeTools(toolRequests);
            console.log("Received tool responses:", toolResponses);

            let toolResponse = this.sendToolResponse(toolResponses);
            this.addToolResponseMessage(toolResponses, {
                responseId: toolResponse.id,
            });
        }
    }

    async handleWebhookExpire(key) {
        console.log("Handling webhook expire for key:", key);

        try {
            const response = await this.getResponseUntilCompleted(key);
            console.log("Fetched response for expired webhook:", response);

            if (response.status !== "completed") {
                console.error("Response is not completed. Cannot process.");

                eventBus.fire("chat.responseFailed", {
                    failure: `Response status is ${response.status} after webhook expired`,
                    response: response,
                });

                return;
            }

            await this.processResponse(response);
        } catch (error) {
            console.error("Error getting response:", error);
        }
    }

    async getResponseUntilCompleted(
        responseId,
        interval = 2000,
        timeout = 60000
    ) {
        const startTime = Date.now();

        while (true) {
            if (Date.now() - startTime > timeout) {
                throw new Error("Timeout waiting for response to complete");
            }

            try {
                const response = await this.getResponse(responseId);

                if (response.status === "completed") {
                    return response;
                } else {
                    console.log(
                        `Response ${responseId} not completed yet. Status: ${response.status}`
                    );
                }
            } catch (error) {
                console.error("Error fetching response:", error);
            }

            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }

    async getResponse(responseId) {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`/api/chat/response/${responseId}`, {
            method: "GET",
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    getTextFromResponse(response) {
        const output_text = response.output
            .filter((item) => item.type === "message")
            .flatMap((item) => item.content)
            .filter((contentItem) => contentItem.type === "output_text")
            .map((contentItem) => contentItem.text)
            .join("");

        if (output_text.trim() === "") {
            return null;
        }

        return output_text;
    }

    getToolRequestsFromResponse(response) {
        const tool_requests = response.output.filter(
            (item) => item.type === "function_call"
        );

        return tool_requests.map((tool_request) => ({
            name: tool_request.name,
            args: tool_request.arguments,
            call_id: tool_request.call_id,
        }));
    }

    addTextMessage(text, options = {}) {
        let msg = {
            role: "assistant",
            type: "message",
            content: text,
            ...options,
        };

        this.messages.add(msg);
    }

    addToolRequestMessage(toolRequests, options = {}) {
        const msg = toolRequests.map(
            (toolRequest) => `  - ${toolRequest.name}(${toolRequest.args})`
        );

        this.messages.add({
            role: "assistant",
            type: "tool_request",
            content: ["Requesting tools:", "", ...msg].join("\n"),
            ...options,
        });
    }

    async invokeTools(tools) {
        return await toolBox.invokeAll(tools);
    }

    addToolResponseMessage(toolResponses) {
        this.messages.add({
            role: "user",
            type: "tool_response",
            content: toolResponses.content,
        });
    }

    async sendToolResponse(toolResponses) {
        await this.postMessage(toolResponses.content, "tool_response", {
            output: toolResponses.output,
        });
    }

    summarizeIfNeeded() {
        if (!this.lastSummarization) {
            this.lastSummarization = Date.now();
            return;
        }

        const now = Date.now();
        const elapsed = now - this.lastSummarization;

        if (elapsed > SUMMARIZE_EVERY_MS) {
            console.log(
                `${
                    SUMMARIZE_EVERY_MS / 60000
                } minutes elapsed since last summarization. Summarizing...`
            );
            this.summarize()
                .then((data) => {
                    console.log("Conversation summarized:", data);
                    this.lastSummarization = Date.now();
                })
                .catch((error) => {
                    console.error("Error summarizing conversation:", error);
                });
        }
    }

    async summarize() {
        if (!this.conversation) {
            throw new Error(
                "No active conversation. Start a conversation first."
            );
        }

        // POST request to backend API
        console.log(
            "Requesting summarization of conversation:",
            this.conversation
        );

        const headers = await this.getAuthHeaders();
        const response = await fetch(
            `/api/chat/summarize/${this.conversation}`,
            {
                method: "POST",
                headers: headers,
            }
        );

        if (!response.ok) {
            let reason =
                response.status === 404
                    ? "Conversation not found. It may have been deleted or expired. Please start a new conversation."
                    : "The message failed to send. The conversation may be stuck. Please try starting a new conversation.";

            eventBus.fire("chat.summarizeFailed", {
                reason: reason,
            });
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return data;
    }
}

const chatClient = new ChatClient();

if (typeof window !== "undefined") {
    window._vy_chatClient = chatClient;
}

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
        element.innerHTML = k(message.content, { breaks: true });

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

/**
 * Fuse.js v7.1.0 - Lightweight fuzzy-search (http://fusejs.io)
 *
 * Copyright (c) 2025 Kiro Risk (http://kiro.me)
 * All Rights Reserved. Apache Software License 2.0
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

function isArray(value) {
  return !Array.isArray
    ? getTag(value) === '[object Array]'
    : Array.isArray(value)
}
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value
  }
  let result = value + '';
  return result == '0' && 1 / value == -Infinity ? '-0' : result
}

function toString(value) {
  return value == null ? '' : baseToString(value)
}

function isString(value) {
  return typeof value === 'string'
}

function isNumber(value) {
  return typeof value === 'number'
}

// Adapted from: https://github.com/lodash/lodash/blob/master/isBoolean.js
function isBoolean(value) {
  return (
    value === true ||
    value === false ||
    (isObjectLike(value) && getTag(value) == '[object Boolean]')
  )
}

function isObject(value) {
  return typeof value === 'object'
}

// Checks if `value` is object-like.
function isObjectLike(value) {
  return isObject(value) && value !== null
}

function isDefined(value) {
  return value !== undefined && value !== null
}

function isBlank(value) {
  return !value.trim().length
}

// Gets the `toStringTag` of `value`.
// Adapted from: https://github.com/lodash/lodash/blob/master/.internal/getTag.js
function getTag(value) {
  return value == null
    ? value === undefined
      ? '[object Undefined]'
      : '[object Null]'
    : Object.prototype.toString.call(value)
}

const INCORRECT_INDEX_TYPE = "Incorrect 'index' type";

const LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = (key) =>
  `Invalid value for key ${key}`;

const PATTERN_LENGTH_TOO_LARGE = (max) =>
  `Pattern length exceeds max of ${max}.`;

const MISSING_KEY_PROPERTY = (name) => `Missing ${name} property in key`;

const INVALID_KEY_WEIGHT_VALUE = (key) =>
  `Property 'weight' in key '${key}' must be a positive integer`;

const hasOwn = Object.prototype.hasOwnProperty;

class KeyStore {
  constructor(keys) {
    this._keys = [];
    this._keyMap = {};

    let totalWeight = 0;

    keys.forEach((key) => {
      let obj = createKey(key);

      this._keys.push(obj);
      this._keyMap[obj.id] = obj;

      totalWeight += obj.weight;
    });

    // Normalize weights so that their sum is equal to 1
    this._keys.forEach((key) => {
      key.weight /= totalWeight;
    });
  }
  get(keyId) {
    return this._keyMap[keyId]
  }
  keys() {
    return this._keys
  }
  toJSON() {
    return JSON.stringify(this._keys)
  }
}

function createKey(key) {
  let path = null;
  let id = null;
  let src = null;
  let weight = 1;
  let getFn = null;

  if (isString(key) || isArray(key)) {
    src = key;
    path = createKeyPath(key);
    id = createKeyId(key);
  } else {
    if (!hasOwn.call(key, 'name')) {
      throw new Error(MISSING_KEY_PROPERTY('name'))
    }

    const name = key.name;
    src = name;

    if (hasOwn.call(key, 'weight')) {
      weight = key.weight;

      if (weight <= 0) {
        throw new Error(INVALID_KEY_WEIGHT_VALUE(name))
      }
    }

    path = createKeyPath(name);
    id = createKeyId(name);
    getFn = key.getFn;
  }

  return { path, id, weight, src, getFn }
}

function createKeyPath(key) {
  return isArray(key) ? key : key.split('.')
}

function createKeyId(key) {
  return isArray(key) ? key.join('.') : key
}

function get(obj, path) {
  let list = [];
  let arr = false;

  const deepGet = (obj, path, index) => {
    if (!isDefined(obj)) {
      return
    }
    if (!path[index]) {
      // If there's no path left, we've arrived at the object we care about.
      list.push(obj);
    } else {
      let key = path[index];

      const value = obj[key];

      if (!isDefined(value)) {
        return
      }

      // If we're at the last value in the path, and if it's a string/number/bool,
      // add it to the list
      if (
        index === path.length - 1 &&
        (isString(value) || isNumber(value) || isBoolean(value))
      ) {
        list.push(toString(value));
      } else if (isArray(value)) {
        arr = true;
        // Search each item in the array.
        for (let i = 0, len = value.length; i < len; i += 1) {
          deepGet(value[i], path, index + 1);
        }
      } else if (path.length) {
        // An object. Recurse further.
        deepGet(value, path, index + 1);
      }
    }
  };

  // Backwards compatibility (since path used to be a string)
  deepGet(obj, isString(path) ? path.split('.') : path, 0);

  return arr ? list : list[0]
}

const MatchOptions = {
  // Whether the matches should be included in the result set. When `true`, each record in the result
  // set will include the indices of the matched characters.
  // These can consequently be used for highlighting purposes.
  includeMatches: false,
  // When `true`, the matching function will continue to the end of a search pattern even if
  // a perfect match has already been located in the string.
  findAllMatches: false,
  // Minimum number of characters that must be matched before a result is considered a match
  minMatchCharLength: 1
};

const BasicOptions = {
  // When `true`, the algorithm continues searching to the end of the input even if a perfect
  // match is found before the end of the same input.
  isCaseSensitive: false,
  // When `true`, the algorithm will ignore diacritics (accents) in comparisons
  ignoreDiacritics: false,
  // When true, the matching function will continue to the end of a search pattern even if
  includeScore: false,
  // List of properties that will be searched. This also supports nested properties.
  keys: [],
  // Whether to sort the result list, by score
  shouldSort: true,
  // Default sort function: sort by ascending score, ascending index
  sortFn: (a, b) =>
    a.score === b.score ? (a.idx < b.idx ? -1 : 1) : a.score < b.score ? -1 : 1
};

const FuzzyOptions = {
  // Approximately where in the text is the pattern expected to be found?
  location: 0,
  // At what point does the match algorithm give up. A threshold of '0.0' requires a perfect match
  // (of both letters and location), a threshold of '1.0' would match anything.
  threshold: 0.6,
  // Determines how close the match must be to the fuzzy location (specified above).
  // An exact letter match which is 'distance' characters away from the fuzzy location
  // would score as a complete mismatch. A distance of '0' requires the match be at
  // the exact location specified, a threshold of '1000' would require a perfect match
  // to be within 800 characters of the fuzzy location to be found using a 0.8 threshold.
  distance: 100
};

const AdvancedOptions = {
  // When `true`, it enables the use of unix-like search commands
  useExtendedSearch: false,
  // The get function to use when fetching an object's properties.
  // The default will search nested paths *ie foo.bar.baz*
  getFn: get,
  // When `true`, search will ignore `location` and `distance`, so it won't matter
  // where in the string the pattern appears.
  // More info: https://fusejs.io/concepts/scoring-theory.html#fuzziness-score
  ignoreLocation: false,
  // When `true`, the calculation for the relevance score (used for sorting) will
  // ignore the field-length norm.
  // More info: https://fusejs.io/concepts/scoring-theory.html#field-length-norm
  ignoreFieldNorm: false,
  // The weight to determine how much field length norm effects scoring.
  fieldNormWeight: 1
};

var Config = {
  ...BasicOptions,
  ...MatchOptions,
  ...FuzzyOptions,
  ...AdvancedOptions
};

const SPACE = /[^ ]+/g;

// Field-length norm: the shorter the field, the higher the weight.
// Set to 3 decimals to reduce index size.
function norm(weight = 1, mantissa = 3) {
  const cache = new Map();
  const m = Math.pow(10, mantissa);

  return {
    get(value) {
      const numTokens = value.match(SPACE).length;

      if (cache.has(numTokens)) {
        return cache.get(numTokens)
      }

      // Default function is 1/sqrt(x), weight makes that variable
      const norm = 1 / Math.pow(numTokens, 0.5 * weight);

      // In place of `toFixed(mantissa)`, for faster computation
      const n = parseFloat(Math.round(norm * m) / m);

      cache.set(numTokens, n);

      return n
    },
    clear() {
      cache.clear();
    }
  }
}

class FuseIndex {
  constructor({
    getFn = Config.getFn,
    fieldNormWeight = Config.fieldNormWeight
  } = {}) {
    this.norm = norm(fieldNormWeight, 3);
    this.getFn = getFn;
    this.isCreated = false;

    this.setIndexRecords();
  }
  setSources(docs = []) {
    this.docs = docs;
  }
  setIndexRecords(records = []) {
    this.records = records;
  }
  setKeys(keys = []) {
    this.keys = keys;
    this._keysMap = {};
    keys.forEach((key, idx) => {
      this._keysMap[key.id] = idx;
    });
  }
  create() {
    if (this.isCreated || !this.docs.length) {
      return
    }

    this.isCreated = true;

    // List is Array<String>
    if (isString(this.docs[0])) {
      this.docs.forEach((doc, docIndex) => {
        this._addString(doc, docIndex);
      });
    } else {
      // List is Array<Object>
      this.docs.forEach((doc, docIndex) => {
        this._addObject(doc, docIndex);
      });
    }

    this.norm.clear();
  }
  // Adds a doc to the end of the index
  add(doc) {
    const idx = this.size();

    if (isString(doc)) {
      this._addString(doc, idx);
    } else {
      this._addObject(doc, idx);
    }
  }
  // Removes the doc at the specified index of the index
  removeAt(idx) {
    this.records.splice(idx, 1);

    // Change ref index of every subsquent doc
    for (let i = idx, len = this.size(); i < len; i += 1) {
      this.records[i].i -= 1;
    }
  }
  getValueForItemAtKeyId(item, keyId) {
    return item[this._keysMap[keyId]]
  }
  size() {
    return this.records.length
  }
  _addString(doc, docIndex) {
    if (!isDefined(doc) || isBlank(doc)) {
      return
    }

    let record = {
      v: doc,
      i: docIndex,
      n: this.norm.get(doc)
    };

    this.records.push(record);
  }
  _addObject(doc, docIndex) {
    let record = { i: docIndex, $: {} };

    // Iterate over every key (i.e, path), and fetch the value at that key
    this.keys.forEach((key, keyIndex) => {
      let value = key.getFn ? key.getFn(doc) : this.getFn(doc, key.path);

      if (!isDefined(value)) {
        return
      }

      if (isArray(value)) {
        let subRecords = [];
        const stack = [{ nestedArrIndex: -1, value }];

        while (stack.length) {
          const { nestedArrIndex, value } = stack.pop();

          if (!isDefined(value)) {
            continue
          }

          if (isString(value) && !isBlank(value)) {
            let subRecord = {
              v: value,
              i: nestedArrIndex,
              n: this.norm.get(value)
            };

            subRecords.push(subRecord);
          } else if (isArray(value)) {
            value.forEach((item, k) => {
              stack.push({
                nestedArrIndex: k,
                value: item
              });
            });
          } else ;
        }
        record.$[keyIndex] = subRecords;
      } else if (isString(value) && !isBlank(value)) {
        let subRecord = {
          v: value,
          n: this.norm.get(value)
        };

        record.$[keyIndex] = subRecord;
      }
    });

    this.records.push(record);
  }
  toJSON() {
    return {
      keys: this.keys,
      records: this.records
    }
  }
}

function createIndex(
  keys,
  docs,
  { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}
) {
  const myIndex = new FuseIndex({ getFn, fieldNormWeight });
  myIndex.setKeys(keys.map(createKey));
  myIndex.setSources(docs);
  myIndex.create();
  return myIndex
}

function parseIndex(
  data,
  { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}
) {
  const { keys, records } = data;
  const myIndex = new FuseIndex({ getFn, fieldNormWeight });
  myIndex.setKeys(keys);
  myIndex.setIndexRecords(records);
  return myIndex
}

function computeScore$1(
  pattern,
  {
    errors = 0,
    currentLocation = 0,
    expectedLocation = 0,
    distance = Config.distance,
    ignoreLocation = Config.ignoreLocation
  } = {}
) {
  const accuracy = errors / pattern.length;

  if (ignoreLocation) {
    return accuracy
  }

  const proximity = Math.abs(expectedLocation - currentLocation);

  if (!distance) {
    // Dodge divide by zero error.
    return proximity ? 1.0 : accuracy
  }

  return accuracy + proximity / distance
}

function convertMaskToIndices(
  matchmask = [],
  minMatchCharLength = Config.minMatchCharLength
) {
  let indices = [];
  let start = -1;
  let end = -1;
  let i = 0;

  for (let len = matchmask.length; i < len; i += 1) {
    let match = matchmask[i];
    if (match && start === -1) {
      start = i;
    } else if (!match && start !== -1) {
      end = i - 1;
      if (end - start + 1 >= minMatchCharLength) {
        indices.push([start, end]);
      }
      start = -1;
    }
  }

  // (i-1 - start) + 1 => i - start
  if (matchmask[i - 1] && i - start >= minMatchCharLength) {
    indices.push([start, i - 1]);
  }

  return indices
}

// Machine word size
const MAX_BITS = 32;

function search(
  text,
  pattern,
  patternAlphabet,
  {
    location = Config.location,
    distance = Config.distance,
    threshold = Config.threshold,
    findAllMatches = Config.findAllMatches,
    minMatchCharLength = Config.minMatchCharLength,
    includeMatches = Config.includeMatches,
    ignoreLocation = Config.ignoreLocation
  } = {}
) {
  if (pattern.length > MAX_BITS) {
    throw new Error(PATTERN_LENGTH_TOO_LARGE(MAX_BITS))
  }

  const patternLen = pattern.length;
  // Set starting location at beginning text and initialize the alphabet.
  const textLen = text.length;
  // Handle the case when location > text.length
  const expectedLocation = Math.max(0, Math.min(location, textLen));
  // Highest score beyond which we give up.
  let currentThreshold = threshold;
  // Is there a nearby exact match? (speedup)
  let bestLocation = expectedLocation;

  // Performance: only computer matches when the minMatchCharLength > 1
  // OR if `includeMatches` is true.
  const computeMatches = minMatchCharLength > 1 || includeMatches;
  // A mask of the matches, used for building the indices
  const matchMask = computeMatches ? Array(textLen) : [];

  let index;

  // Get all exact matches, here for speed up
  while ((index = text.indexOf(pattern, bestLocation)) > -1) {
    let score = computeScore$1(pattern, {
      currentLocation: index,
      expectedLocation,
      distance,
      ignoreLocation
    });

    currentThreshold = Math.min(score, currentThreshold);
    bestLocation = index + patternLen;

    if (computeMatches) {
      let i = 0;
      while (i < patternLen) {
        matchMask[index + i] = 1;
        i += 1;
      }
    }
  }

  // Reset the best location
  bestLocation = -1;

  let lastBitArr = [];
  let finalScore = 1;
  let binMax = patternLen + textLen;

  const mask = 1 << (patternLen - 1);

  for (let i = 0; i < patternLen; i += 1) {
    // Scan for the best match; each iteration allows for one more error.
    // Run a binary search to determine how far from the match location we can stray
    // at this error level.
    let binMin = 0;
    let binMid = binMax;

    while (binMin < binMid) {
      const score = computeScore$1(pattern, {
        errors: i,
        currentLocation: expectedLocation + binMid,
        expectedLocation,
        distance,
        ignoreLocation
      });

      if (score <= currentThreshold) {
        binMin = binMid;
      } else {
        binMax = binMid;
      }

      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }

    // Use the result from this iteration as the maximum for the next.
    binMax = binMid;

    let start = Math.max(1, expectedLocation - binMid + 1);
    let finish = findAllMatches
      ? textLen
      : Math.min(expectedLocation + binMid, textLen) + patternLen;

    // Initialize the bit array
    let bitArr = Array(finish + 2);

    bitArr[finish + 1] = (1 << i) - 1;

    for (let j = finish; j >= start; j -= 1) {
      let currentLocation = j - 1;
      let charMatch = patternAlphabet[text.charAt(currentLocation)];

      if (computeMatches) {
        // Speed up: quick bool to int conversion (i.e, `charMatch ? 1 : 0`)
        matchMask[currentLocation] = +!!charMatch;
      }

      // First pass: exact match
      bitArr[j] = ((bitArr[j + 1] << 1) | 1) & charMatch;

      // Subsequent passes: fuzzy match
      if (i) {
        bitArr[j] |=
          ((lastBitArr[j + 1] | lastBitArr[j]) << 1) | 1 | lastBitArr[j + 1];
      }

      if (bitArr[j] & mask) {
        finalScore = computeScore$1(pattern, {
          errors: i,
          currentLocation,
          expectedLocation,
          distance,
          ignoreLocation
        });

        // This match will almost certainly be better than any existing match.
        // But check anyway.
        if (finalScore <= currentThreshold) {
          // Indeed it is
          currentThreshold = finalScore;
          bestLocation = currentLocation;

          // Already passed `loc`, downhill from here on in.
          if (bestLocation <= expectedLocation) {
            break
          }

          // When passing `bestLocation`, don't exceed our current distance from `expectedLocation`.
          start = Math.max(1, 2 * expectedLocation - bestLocation);
        }
      }
    }

    // No hope for a (better) match at greater error levels.
    const score = computeScore$1(pattern, {
      errors: i + 1,
      currentLocation: expectedLocation,
      expectedLocation,
      distance,
      ignoreLocation
    });

    if (score > currentThreshold) {
      break
    }

    lastBitArr = bitArr;
  }

  const result = {
    isMatch: bestLocation >= 0,
    // Count exact matches (those with a score of 0) to be "almost" exact
    score: Math.max(0.001, finalScore)
  };

  if (computeMatches) {
    const indices = convertMaskToIndices(matchMask, minMatchCharLength);
    if (!indices.length) {
      result.isMatch = false;
    } else if (includeMatches) {
      result.indices = indices;
    }
  }

  return result
}

function createPatternAlphabet(pattern) {
  let mask = {};

  for (let i = 0, len = pattern.length; i < len; i += 1) {
    const char = pattern.charAt(i);
    mask[char] = (mask[char] || 0) | (1 << (len - i - 1));
  }

  return mask
}

const stripDiacritics = String.prototype.normalize
    ? ((str) => str.normalize('NFD').replace(/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g, ''))
    : ((str) => str);

class BitapSearch {
  constructor(
    pattern,
    {
      location = Config.location,
      threshold = Config.threshold,
      distance = Config.distance,
      includeMatches = Config.includeMatches,
      findAllMatches = Config.findAllMatches,
      minMatchCharLength = Config.minMatchCharLength,
      isCaseSensitive = Config.isCaseSensitive,
      ignoreDiacritics = Config.ignoreDiacritics,
      ignoreLocation = Config.ignoreLocation
    } = {}
  ) {
    this.options = {
      location,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreDiacritics,
      ignoreLocation
    };

    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;

    this.chunks = [];

    if (!this.pattern.length) {
      return
    }

    const addChunk = (pattern, startIndex) => {
      this.chunks.push({
        pattern,
        alphabet: createPatternAlphabet(pattern),
        startIndex
      });
    };

    const len = this.pattern.length;

    if (len > MAX_BITS) {
      let i = 0;
      const remainder = len % MAX_BITS;
      const end = len - remainder;

      while (i < end) {
        addChunk(this.pattern.substr(i, MAX_BITS), i);
        i += MAX_BITS;
      }

      if (remainder) {
        const startIndex = len - MAX_BITS;
        addChunk(this.pattern.substr(startIndex), startIndex);
      }
    } else {
      addChunk(this.pattern, 0);
    }
  }

  searchIn(text) {
    const { isCaseSensitive, ignoreDiacritics, includeMatches } = this.options;

    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;

    // Exact match
    if (this.pattern === text) {
      let result = {
        isMatch: true,
        score: 0
      };

      if (includeMatches) {
        result.indices = [[0, text.length - 1]];
      }

      return result
    }

    // Otherwise, use Bitap algorithm
    const {
      location,
      distance,
      threshold,
      findAllMatches,
      minMatchCharLength,
      ignoreLocation
    } = this.options;

    let allIndices = [];
    let totalScore = 0;
    let hasMatches = false;

    this.chunks.forEach(({ pattern, alphabet, startIndex }) => {
      const { isMatch, score, indices } = search(text, pattern, alphabet, {
        location: location + startIndex,
        distance,
        threshold,
        findAllMatches,
        minMatchCharLength,
        includeMatches,
        ignoreLocation
      });

      if (isMatch) {
        hasMatches = true;
      }

      totalScore += score;

      if (isMatch && indices) {
        allIndices = [...allIndices, ...indices];
      }
    });

    let result = {
      isMatch: hasMatches,
      score: hasMatches ? totalScore / this.chunks.length : 1
    };

    if (hasMatches && includeMatches) {
      result.indices = allIndices;
    }

    return result
  }
}

class BaseMatch {
  constructor(pattern) {
    this.pattern = pattern;
  }
  static isMultiMatch(pattern) {
    return getMatch(pattern, this.multiRegex)
  }
  static isSingleMatch(pattern) {
    return getMatch(pattern, this.singleRegex)
  }
  search(/*text*/) {}
}

function getMatch(pattern, exp) {
  const matches = pattern.match(exp);
  return matches ? matches[1] : null
}

// Token: 'file

class ExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'exact'
  }
  static get multiRegex() {
    return /^="(.*)"$/
  }
  static get singleRegex() {
    return /^=(.*)$/
  }
  search(text) {
    const isMatch = text === this.pattern;

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, this.pattern.length - 1]
    }
  }
}

// Token: !fire

class InverseExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'inverse-exact'
  }
  static get multiRegex() {
    return /^!"(.*)"$/
  }
  static get singleRegex() {
    return /^!(.*)$/
  }
  search(text) {
    const index = text.indexOf(this.pattern);
    const isMatch = index === -1;

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    }
  }
}

// Token: ^file

class PrefixExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'prefix-exact'
  }
  static get multiRegex() {
    return /^\^"(.*)"$/
  }
  static get singleRegex() {
    return /^\^(.*)$/
  }
  search(text) {
    const isMatch = text.startsWith(this.pattern);

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, this.pattern.length - 1]
    }
  }
}

// Token: !^fire

class InversePrefixExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'inverse-prefix-exact'
  }
  static get multiRegex() {
    return /^!\^"(.*)"$/
  }
  static get singleRegex() {
    return /^!\^(.*)$/
  }
  search(text) {
    const isMatch = !text.startsWith(this.pattern);

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    }
  }
}

// Token: .file$

class SuffixExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'suffix-exact'
  }
  static get multiRegex() {
    return /^"(.*)"\$$/
  }
  static get singleRegex() {
    return /^(.*)\$$/
  }
  search(text) {
    const isMatch = text.endsWith(this.pattern);

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [text.length - this.pattern.length, text.length - 1]
    }
  }
}

// Token: !.file$

class InverseSuffixExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'inverse-suffix-exact'
  }
  static get multiRegex() {
    return /^!"(.*)"\$$/
  }
  static get singleRegex() {
    return /^!(.*)\$$/
  }
  search(text) {
    const isMatch = !text.endsWith(this.pattern);
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    }
  }
}

class FuzzyMatch extends BaseMatch {
  constructor(
    pattern,
    {
      location = Config.location,
      threshold = Config.threshold,
      distance = Config.distance,
      includeMatches = Config.includeMatches,
      findAllMatches = Config.findAllMatches,
      minMatchCharLength = Config.minMatchCharLength,
      isCaseSensitive = Config.isCaseSensitive,
      ignoreDiacritics = Config.ignoreDiacritics,
      ignoreLocation = Config.ignoreLocation
    } = {}
  ) {
    super(pattern);
    this._bitapSearch = new BitapSearch(pattern, {
      location,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreDiacritics,
      ignoreLocation
    });
  }
  static get type() {
    return 'fuzzy'
  }
  static get multiRegex() {
    return /^"(.*)"$/
  }
  static get singleRegex() {
    return /^(.*)$/
  }
  search(text) {
    return this._bitapSearch.searchIn(text)
  }
}

// Token: 'file

class IncludeMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'include'
  }
  static get multiRegex() {
    return /^'"(.*)"$/
  }
  static get singleRegex() {
    return /^'(.*)$/
  }
  search(text) {
    let location = 0;
    let index;

    const indices = [];
    const patternLen = this.pattern.length;

    // Get all exact matches
    while ((index = text.indexOf(this.pattern, location)) > -1) {
      location = index + patternLen;
      indices.push([index, location - 1]);
    }

    const isMatch = !!indices.length;

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices
    }
  }
}

// ❗Order is important. DO NOT CHANGE.
const searchers = [
  ExactMatch,
  IncludeMatch,
  PrefixExactMatch,
  InversePrefixExactMatch,
  InverseSuffixExactMatch,
  SuffixExactMatch,
  InverseExactMatch,
  FuzzyMatch
];

const searchersLen = searchers.length;

// Regex to split by spaces, but keep anything in quotes together
const SPACE_RE = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
const OR_TOKEN = '|';

// Return a 2D array representation of the query, for simpler parsing.
// Example:
// "^core go$ | rb$ | py$ xy$" => [["^core", "go$"], ["rb$"], ["py$", "xy$"]]
function parseQuery(pattern, options = {}) {
  return pattern.split(OR_TOKEN).map((item) => {
    let query = item
      .trim()
      .split(SPACE_RE)
      .filter((item) => item && !!item.trim());

    let results = [];
    for (let i = 0, len = query.length; i < len; i += 1) {
      const queryItem = query[i];

      // 1. Handle multiple query match (i.e, once that are quoted, like `"hello world"`)
      let found = false;
      let idx = -1;
      while (!found && ++idx < searchersLen) {
        const searcher = searchers[idx];
        let token = searcher.isMultiMatch(queryItem);
        if (token) {
          results.push(new searcher(token, options));
          found = true;
        }
      }

      if (found) {
        continue
      }

      // 2. Handle single query matches (i.e, once that are *not* quoted)
      idx = -1;
      while (++idx < searchersLen) {
        const searcher = searchers[idx];
        let token = searcher.isSingleMatch(queryItem);
        if (token) {
          results.push(new searcher(token, options));
          break
        }
      }
    }

    return results
  })
}

// These extended matchers can return an array of matches, as opposed
// to a singl match
const MultiMatchSet = new Set([FuzzyMatch.type, IncludeMatch.type]);

/**
 * Command-like searching
 * ======================
 *
 * Given multiple search terms delimited by spaces.e.g. `^jscript .python$ ruby !java`,
 * search in a given text.
 *
 * Search syntax:
 *
 * | Token       | Match type                 | Description                            |
 * | ----------- | -------------------------- | -------------------------------------- |
 * | `jscript`   | fuzzy-match                | Items that fuzzy match `jscript`       |
 * | `=scheme`   | exact-match                | Items that are `scheme`                |
 * | `'python`   | include-match              | Items that include `python`            |
 * | `!ruby`     | inverse-exact-match        | Items that do not include `ruby`       |
 * | `^java`     | prefix-exact-match         | Items that start with `java`           |
 * | `!^earlang` | inverse-prefix-exact-match | Items that do not start with `earlang` |
 * | `.js$`      | suffix-exact-match         | Items that end with `.js`              |
 * | `!.go$`     | inverse-suffix-exact-match | Items that do not end with `.go`       |
 *
 * A single pipe character acts as an OR operator. For example, the following
 * query matches entries that start with `core` and end with either`go`, `rb`,
 * or`py`.
 *
 * ```
 * ^core go$ | rb$ | py$
 * ```
 */
class ExtendedSearch {
  constructor(
    pattern,
    {
      isCaseSensitive = Config.isCaseSensitive,
      ignoreDiacritics = Config.ignoreDiacritics,
      includeMatches = Config.includeMatches,
      minMatchCharLength = Config.minMatchCharLength,
      ignoreLocation = Config.ignoreLocation,
      findAllMatches = Config.findAllMatches,
      location = Config.location,
      threshold = Config.threshold,
      distance = Config.distance
    } = {}
  ) {
    this.query = null;
    this.options = {
      isCaseSensitive,
      ignoreDiacritics,
      includeMatches,
      minMatchCharLength,
      findAllMatches,
      ignoreLocation,
      location,
      threshold,
      distance
    };

    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;
    this.query = parseQuery(this.pattern, this.options);
  }

  static condition(_, options) {
    return options.useExtendedSearch
  }

  searchIn(text) {
    const query = this.query;

    if (!query) {
      return {
        isMatch: false,
        score: 1
      }
    }

    const { includeMatches, isCaseSensitive, ignoreDiacritics } = this.options;

    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;

    let numMatches = 0;
    let allIndices = [];
    let totalScore = 0;

    // ORs
    for (let i = 0, qLen = query.length; i < qLen; i += 1) {
      const searchers = query[i];

      // Reset indices
      allIndices.length = 0;
      numMatches = 0;

      // ANDs
      for (let j = 0, pLen = searchers.length; j < pLen; j += 1) {
        const searcher = searchers[j];
        const { isMatch, indices, score } = searcher.search(text);

        if (isMatch) {
          numMatches += 1;
          totalScore += score;
          if (includeMatches) {
            const type = searcher.constructor.type;
            if (MultiMatchSet.has(type)) {
              allIndices = [...allIndices, ...indices];
            } else {
              allIndices.push(indices);
            }
          }
        } else {
          totalScore = 0;
          numMatches = 0;
          allIndices.length = 0;
          break
        }
      }

      // OR condition, so if TRUE, return
      if (numMatches) {
        let result = {
          isMatch: true,
          score: totalScore / numMatches
        };

        if (includeMatches) {
          result.indices = allIndices;
        }

        return result
      }
    }

    // Nothing was matched
    return {
      isMatch: false,
      score: 1
    }
  }
}

const registeredSearchers = [];

function register(...args) {
  registeredSearchers.push(...args);
}

function createSearcher(pattern, options) {
  for (let i = 0, len = registeredSearchers.length; i < len; i += 1) {
    let searcherClass = registeredSearchers[i];
    if (searcherClass.condition(pattern, options)) {
      return new searcherClass(pattern, options)
    }
  }

  return new BitapSearch(pattern, options)
}

const LogicalOperator = {
  AND: '$and',
  OR: '$or'
};

const KeyType = {
  PATH: '$path',
  PATTERN: '$val'
};

const isExpression = (query) =>
  !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);

const isPath = (query) => !!query[KeyType.PATH];

const isLeaf = (query) =>
  !isArray(query) && isObject(query) && !isExpression(query);

const convertToExplicit = (query) => ({
  [LogicalOperator.AND]: Object.keys(query).map((key) => ({
    [key]: query[key]
  }))
});

// When `auto` is `true`, the parse function will infer and initialize and add
// the appropriate `Searcher` instance
function parse(query, options, { auto = true } = {}) {
  const next = (query) => {
    let keys = Object.keys(query);

    const isQueryPath = isPath(query);

    if (!isQueryPath && keys.length > 1 && !isExpression(query)) {
      return next(convertToExplicit(query))
    }

    if (isLeaf(query)) {
      const key = isQueryPath ? query[KeyType.PATH] : keys[0];

      const pattern = isQueryPath ? query[KeyType.PATTERN] : query[key];

      if (!isString(pattern)) {
        throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key))
      }

      const obj = {
        keyId: createKeyId(key),
        pattern
      };

      if (auto) {
        obj.searcher = createSearcher(pattern, options);
      }

      return obj
    }

    let node = {
      children: [],
      operator: keys[0]
    };

    keys.forEach((key) => {
      const value = query[key];

      if (isArray(value)) {
        value.forEach((item) => {
          node.children.push(next(item));
        });
      }
    });

    return node
  };

  if (!isExpression(query)) {
    query = convertToExplicit(query);
  }

  return next(query)
}

// Practical scoring function
function computeScore(
  results,
  { ignoreFieldNorm = Config.ignoreFieldNorm }
) {
  results.forEach((result) => {
    let totalScore = 1;

    result.matches.forEach(({ key, norm, score }) => {
      const weight = key ? key.weight : null;

      totalScore *= Math.pow(
        score === 0 && weight ? Number.EPSILON : score,
        (weight || 1) * (ignoreFieldNorm ? 1 : norm)
      );
    });

    result.score = totalScore;
  });
}

function transformMatches(result, data) {
  const matches = result.matches;
  data.matches = [];

  if (!isDefined(matches)) {
    return
  }

  matches.forEach((match) => {
    if (!isDefined(match.indices) || !match.indices.length) {
      return
    }

    const { indices, value } = match;

    let obj = {
      indices,
      value
    };

    if (match.key) {
      obj.key = match.key.src;
    }

    if (match.idx > -1) {
      obj.refIndex = match.idx;
    }

    data.matches.push(obj);
  });
}

function transformScore(result, data) {
  data.score = result.score;
}

function format(
  results,
  docs,
  {
    includeMatches = Config.includeMatches,
    includeScore = Config.includeScore
  } = {}
) {
  const transformers = [];

  if (includeMatches) transformers.push(transformMatches);
  if (includeScore) transformers.push(transformScore);

  return results.map((result) => {
    const { idx } = result;

    const data = {
      item: docs[idx],
      refIndex: idx
    };

    if (transformers.length) {
      transformers.forEach((transformer) => {
        transformer(result, data);
      });
    }

    return data
  })
}

class Fuse {
  constructor(docs, options = {}, index) {
    this.options = { ...Config, ...options };

    if (
      this.options.useExtendedSearch &&
      false
    ) ;

    this._keyStore = new KeyStore(this.options.keys);

    this.setCollection(docs, index);
  }

  setCollection(docs, index) {
    this._docs = docs;

    if (index && !(index instanceof FuseIndex)) {
      throw new Error(INCORRECT_INDEX_TYPE)
    }

    this._myIndex =
      index ||
      createIndex(this.options.keys, this._docs, {
        getFn: this.options.getFn,
        fieldNormWeight: this.options.fieldNormWeight
      });
  }

  add(doc) {
    if (!isDefined(doc)) {
      return
    }

    this._docs.push(doc);
    this._myIndex.add(doc);
  }

  remove(predicate = (/* doc, idx */) => false) {
    const results = [];

    for (let i = 0, len = this._docs.length; i < len; i += 1) {
      const doc = this._docs[i];
      if (predicate(doc, i)) {
        this.removeAt(i);
        i -= 1;
        len -= 1;

        results.push(doc);
      }
    }

    return results
  }

  removeAt(idx) {
    this._docs.splice(idx, 1);
    this._myIndex.removeAt(idx);
  }

  getIndex() {
    return this._myIndex
  }

  search(query, { limit = -1 } = {}) {
    const {
      includeMatches,
      includeScore,
      shouldSort,
      sortFn,
      ignoreFieldNorm
    } = this.options;

    let results = isString(query)
      ? isString(this._docs[0])
        ? this._searchStringList(query)
        : this._searchObjectList(query)
      : this._searchLogical(query);

    computeScore(results, { ignoreFieldNorm });

    if (shouldSort) {
      results.sort(sortFn);
    }

    if (isNumber(limit) && limit > -1) {
      results = results.slice(0, limit);
    }

    return format(results, this._docs, {
      includeMatches,
      includeScore
    })
  }

  _searchStringList(query) {
    const searcher = createSearcher(query, this.options);
    const { records } = this._myIndex;
    const results = [];

    // Iterate over every string in the index
    records.forEach(({ v: text, i: idx, n: norm }) => {
      if (!isDefined(text)) {
        return
      }

      const { isMatch, score, indices } = searcher.searchIn(text);

      if (isMatch) {
        results.push({
          item: text,
          idx,
          matches: [{ score, value: text, norm, indices }]
        });
      }
    });

    return results
  }

  _searchLogical(query) {

    const expression = parse(query, this.options);

    const evaluate = (node, item, idx) => {
      if (!node.children) {
        const { keyId, searcher } = node;

        const matches = this._findMatches({
          key: this._keyStore.get(keyId),
          value: this._myIndex.getValueForItemAtKeyId(item, keyId),
          searcher
        });

        if (matches && matches.length) {
          return [
            {
              idx,
              item,
              matches
            }
          ]
        }

        return []
      }

      const res = [];
      for (let i = 0, len = node.children.length; i < len; i += 1) {
        const child = node.children[i];
        const result = evaluate(child, item, idx);
        if (result.length) {
          res.push(...result);
        } else if (node.operator === LogicalOperator.AND) {
          return []
        }
      }
      return res
    };

    const records = this._myIndex.records;
    const resultMap = {};
    const results = [];

    records.forEach(({ $: item, i: idx }) => {
      if (isDefined(item)) {
        let expResults = evaluate(expression, item, idx);

        if (expResults.length) {
          // Dedupe when adding
          if (!resultMap[idx]) {
            resultMap[idx] = { idx, item, matches: [] };
            results.push(resultMap[idx]);
          }
          expResults.forEach(({ matches }) => {
            resultMap[idx].matches.push(...matches);
          });
        }
      }
    });

    return results
  }

  _searchObjectList(query) {
    const searcher = createSearcher(query, this.options);
    const { keys, records } = this._myIndex;
    const results = [];

    // List is Array<Object>
    records.forEach(({ $: item, i: idx }) => {
      if (!isDefined(item)) {
        return
      }

      let matches = [];

      // Iterate over every key (i.e, path), and fetch the value at that key
      keys.forEach((key, keyIndex) => {
        matches.push(
          ...this._findMatches({
            key,
            value: item[keyIndex],
            searcher
          })
        );
      });

      if (matches.length) {
        results.push({
          idx,
          item,
          matches
        });
      }
    });

    return results
  }
  _findMatches({ key, value, searcher }) {
    if (!isDefined(value)) {
      return []
    }

    let matches = [];

    if (isArray(value)) {
      value.forEach(({ v: text, i: idx, n: norm }) => {
        if (!isDefined(text)) {
          return
        }

        const { isMatch, score, indices } = searcher.searchIn(text);

        if (isMatch) {
          matches.push({
            score,
            key,
            value: text,
            idx,
            norm,
            indices
          });
        }
      });
    } else {
      const { v: text, n: norm } = value;

      const { isMatch, score, indices } = searcher.searchIn(text);

      if (isMatch) {
        matches.push({ score, key, value: text, norm, indices });
      }
    }

    return matches
  }
}

Fuse.version = '7.1.0';
Fuse.createIndex = createIndex;
Fuse.parseIndex = parseIndex;
Fuse.config = Config;

{
  Fuse.parseQuery = parse;
}

{
  register(ExtendedSearch);
}

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
                this.current.conversation;
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
//# sourceMappingURL=rschat.js.map
