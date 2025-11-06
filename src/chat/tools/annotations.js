import { AnnotationsData } from "../../data/annotations.js";

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

export default AnnotationsTool;
export { AnnotationsTool };
