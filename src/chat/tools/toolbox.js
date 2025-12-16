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

        // If no args then just invoke the tool
        if (!args) 
            return await tool.invoke();
        
        args = JSON.parse(args);

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
            return `  - Returned the next page of ${result.page_size || 50} results`;
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
        if (!cursor) 
            return this.getCursorId(1, pageSize);

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

        const rowsToReturn = result.rows.slice(startIndex, startIndex + pageSize);
        const rowsRemaining = result.rows.slice(startIndex + pageSize);
        const totalRows = result.totalRows || result.rows.length;

        this.cursors[nextCursorId] = {
            fromCursor: nextCursorId,
            keys: result.keys,
            rows: rowsRemaining,
            pageSize: pageSize,
            totalRows: totalRows
        };

        const cursorResult = { 
            next_cursor: nextCursorId, 
            keys: result.keys, 
            rows: rowsToReturn, 
            total_rows: totalRows,
            page_size: pageSize
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

export default toolBox;
export { ToolBox, toolBox };
