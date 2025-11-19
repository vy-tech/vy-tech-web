import { MagicBoxTool } from "./magicbox.js";
import { EventsTool } from "./events.js";
import { LocationsTool } from "./locations.js";
import { SummarySecondsTool, SummaryMinutesTool } from "./summaries.js";
import { AnnotationsTool } from "./annotations.js";
import { WeatherTool } from "./weather.js";

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

        if (!args) {
            return await tool.invoke();
        } else {
            args = JSON.parse(args);

            if (args.cursor) {
                const cursorData = this.getCursor(args.cursor);
                return cursorData;
            } else {
                return await tool.invoke(args, this.auth);
            }
        }
    }

    getMessageForResult(result, resultJSON) {
        if (Array.isArray(result)) {
            return `  - Returned ${result.length} rows.`;
        } else if (result.next_cursor) {
            return `  - Returned the next page of 50 results`;
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

    getCursorId() {
        return Math.random().toString(36).substring(2, 10);
    }

    makeCursor(rows, pageSize = 50) {
        let cursorId = this.getCursorId();
        while (this.cursors[cursorId]) {
            cursorId = this.getCursorId();
        }

        const rowsToReturn = rows.rows.slice(0, pageSize);
        const rowsRemaining = rows.rows.slice(pageSize);

        this.cursors[cursorId] = {
            keys: rows.keys,
            rows: rowsRemaining,
            pageSize: pageSize,
        };

        return { next_cursor: cursorId, keys: rows.keys, rows: rowsToReturn };
    }

    getCursor(cursorId) {
        const result = this.cursors[cursorId];
        if (!result) {
            throw new Error(`Cursor ${cursorId} not found`);
        }

        delete this.cursors[cursorId];
        return result;
    }

    addRowsResult(output, msgs, tool, result, maxSize) {
        const rowsData = this.asRows(result);
        const rowsJSON = JSON.stringify(rowsData);
        const msg = this.getMessageForResult(rowsData, rowsJSON);

        msgs.push(msg);

        if (rowsJSON.length > maxSize) {
            const cursorData = this.makeCursor(rowsData);
            output.push({
                call_id: tool.call_id,
                output: JSON.stringify(cursorData),
            });
        } else {
            output.push({
                call_id: tool.call_id,
                output: rowsJSON,
            });
        }
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

export default toolBox;
export { ToolBox, toolBox };
