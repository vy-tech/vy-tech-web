import { FilesData } from "../data/files.js";

import van from "vanjs-core";

import { database } from "../data/db.js";
import { eventBus } from "../eventbus.js";
import { orgContext } from "../data/orgContext.js";
import { effectiveStatus } from "./fileUpload.js";

class VideoFiles extends FilesData {
    /**
     * Selector for video files in the reports UI. Upload and management now
     * live in the top-level /uploads view (src/rsuploads.js).
     */
    constructor() {
        super();

        this.fileMap = new Map();
        this.files = van.state([]);
        this.selectedFile = van.state(null);
        this.unsubscribe = null;
        this.subscribedOrg = null;

        eventBus.on("org.changed", () => {
            this.subscribe();
        });

        this.subscribe();
    }

    async subscribe() {
        const orgId = orgContext.getCurrentOrgId();
        if (!orgId) return;
        if (this.subscribedOrg === orgId && this.unsubscribe) return;

        if (this.unsubscribe) {
            try {
                this.unsubscribe();
            } catch (err) {
                console.warn("Error tearing down videofiles listener:", err);
            }
            this.unsubscribe = null;
        }

        this.fileMap = new Map();
        this.files.val = [];
        this.subscribedOrg = orgId;

        try {
            this.unsubscribe = await database.listen(
                "files",
                (changed) => {
                    for (const doc of changed) {
                        this.fileMap.set(doc.id, doc);
                    }
                    this.files.val = Array.from(this.fileMap.values()).filter(
                        (f) => effectiveStatus(f) === "available"
                    );
                },
                { oid: orgId, context: "video" }
            );
        } catch (err) {
            console.error("Failed to subscribe to video files:", err);
        }
    }

    createNavigationElement(options = {}) {
        const { div, a, i, span } = van.tags;

        const merged = {
            id: "report-annotation-log",
            class: "w-full h-[90vh] flex flex-col",
            ...options,
        };

        const container = div(merged);

        const fileRowsContainer = div(
            { class: "flex-1 min-h-0 overflow-auto mt-1" },
            () => {
                const files = this.files.val;
                if (files.length === 0) {
                    return div(
                        { class: "p-4 text-sm text-gray-500" },
                        "No videos available. Go to ",
                        a(
                            {
                                href: "/uploads",
                                class: "text-blue-500 hover:underline",
                            },
                            "Uploads"
                        ),
                        " to add your first video."
                    );
                }
                return div(
                    ...files.map((file) =>
                        div(
                            {
                                class: () =>
                                    `relative group flex items-center p-2 rounded cursor-pointer text-sm hover:bg-blue-600${
                                        this.selectedFile.val?.id === file.id
                                            ? " bg-blue-500 font-semibold"
                                            : ""
                                    }`,
                                onclick: () => {
                                    this.selectedFile.val = file;
                                    eventBus.fire(
                                        "ui.requestEvent",
                                        file.hierarchy
                                    );
                                },
                            },
                            i({ class: "las la-video mr-2 flex-shrink-0" }),
                            span({ class: "flex-1 truncate" }, file.filename)
                        )
                    )
                );
            }
        );

        van.add(container, fileRowsContainer);
        return container;
    }
}

const videoFiles = new VideoFiles();
export default videoFiles;
export { videoFiles, VideoFiles };
