import { FilesData } from "../data/files.js";

import van from "vanjs-core";
import { Modal } from "vanjs-ui";

import { JobsData } from "../data/jobs.js";
import { eventBus } from "../eventbus.js";
import { orgContext } from "../data/orgContext.js";
import storage, { Storage } from "../data/storage.js";
import { database } from "../data/db.js";
import { apiUtil } from "../util/apiUtil.js";

class VideoFiles extends FilesData {
    /**
     * Manages video files associated with an organization.  The navigation element
     * is displayed in the reports UI to allow users to select videos, manage and
     * upload new videos.
     */
    constructor() {
        super();

        this.files = van.state([]);

        eventBus.addEventListener("ui.requestVideoUpload", () => {
            this.showUploadForm();
        });

        eventBus.on("org.changed", async (orgId) => {
            await this.get();
        });

        eventBus.on("videoFiles.updated", async () => {
            await this.get();
        });
    }

    async get() {
        let files = await this.getByContext("video");
        this.files.val = [...files];
        return this.files.val;
    }

    hasFilename(filename) {
        return this.files.val.some((f) => f.filename === filename);
    }

    getIdForFilename(filename) {
        const file = this.files.val.find((f) => f.filename === filename);
        return file ? file.id : null;
    }

    createNavigationElement(options = {}) {
        const { div, a, i, span, button } = van.tags;

        const merged = {
            id: "report-annotation-log",
            class: "w-full h-[90vh] flex flex-col",
            ...options,
        };

        const container = div(merged);
        const buttonContainer = div(
            {
                class: "flex-none h-[24px] flex justify-end mb-1",
            },
            a(
                {
                    href: "#",
                    title: "Upload Video",
                    onclick: () => {
                        eventBus.fire("ui.requestVideoUpload");
                    },
                },
                i({ class: "las la-plus-circle mr-2" })
            )
        );

        const selectedFile = van.state(null);

        const fileRowsContainer = div(
            { class: "flex-1 min-h-0 overflow-auto mt-1" },
            () => {
                const files = this.files.val;
                if (files.length === 0) {
                    return div(
                        { class: "p-4 text-sm text-gray-500" },
                        "No videos uploaded yet."
                    );
                }
                return div(
                    ...files.map((file) =>
                        div(
                            {
                                class: () =>
                                    `relative group flex items-center p-2 rounded cursor-pointer text-sm hover:bg-blue-600${
                                        selectedFile.val?.id === file.id
                                            ? " bg-blue-500 font-semibold"
                                            : ""
                                    }`,
                                onclick: () => {
                                    selectedFile.val = file;
                                    eventBus.fire(
                                        "ui.requestEvent",
                                        file.hierarchy
                                    );
                                    //eventBus.fire("ui.videoSelected", { file });
                                },
                            },
                            i({ class: "las la-video mr-2 flex-shrink-0" }),
                            span({ class: "flex-1 truncate" }, file.filename),
                            button(
                                {
                                    class: "opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-6 h-6 rounded-full bg-gray-600 bg-opacity-75 hover:bg-opacity-90 text-white text-xs flex items-center justify-center flex-shrink-0",
                                    title: "Options",
                                    onclick: (e) => {
                                        e.stopPropagation();
                                        this.showUploadForm(file);
                                    },
                                },
                                "⋯"
                            )
                        )
                    )
                );
            }
        );

        van.add(container, buttonContainer, fileRowsContainer);

        this.get();

        return container;
    }

    showUploadForm(existingFile = null) {
        const { div, h3, form, label, input, button, progress, p } = van.tags;

        const closed = van.state(false);
        const uploadPct = van.state(0);
        const statusMsg = van.state(
            existingFile
                ? `Current file: ${existingFile.filename}`
                : "Select a video file to upload."
        );
        const uploading = van.state(false);

        let fileInputEl;
        let filenameInputEl;

        const formEl = form(
            { class: "space-y-4" },
            div(
                { class: "flex flex-col space-y-1" },
                label(
                    {
                        for: "videoFile",
                        class: "text-sm font-medium text-gray-700",
                    },
                    "Video File"
                ),
                (fileInputEl = input({
                    id: "videoFile",
                    type: "file",
                    accept: "video/*",
                    class: "text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100",
                    onchange: (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            if (!filenameInputEl.value) {
                                console.log("Setting filename to", file.name);
                                filenameInputEl.value = file.name;
                                filenameInputEl.parentElement.classList.remove(
                                    "hidden"
                                );
                            }
                            statusMsg.val = `Selected: ${file.name}`;
                        } else {
                            statusMsg.val = "Select a video file to upload.";
                        }
                    },
                }))
            ),
            div(
                {
                    class: `flex flex-col space-y-1 ${existingFile ? "" : "hidden"}`,
                },
                label(
                    {
                        for: "videoFilename",
                        class: "text-sm font-medium text-gray-700",
                    },
                    "Filename"
                ),
                (filenameInputEl = input({
                    id: "videoFilename",
                    type: "text",
                    value: existingFile ? existingFile.filename : "",
                    class: "px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                }))
            ),

            // Progress bar — only shown while uploading
            () =>
                uploading.val
                    ? div(
                          { class: "flex flex-col space-y-1" },
                          progress({
                              value: uploadPct,
                              max: 100,
                              class: "w-full h-2",
                          }),
                          p(
                              { class: "text-xs text-gray-500 text-right" },
                              () => `${Math.round(uploadPct.val)}%`
                          )
                      )
                    : div(),
            p(
                { class: "text-sm text-gray-500 mt-1 whitespace-pre-wrap" },
                statusMsg
            ),
            div(
                { class: "flex space-x-3 pt-4" },
                button(
                    {
                        type: "button",
                        class: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                        onclick: async () => {
                            const file = fileInputEl.files?.[0];
                            if (!file) {
                                statusMsg.val = "Please select a file first.";
                                return;
                            }
                            if (
                                this.hasFilename(filenameInputEl.value) &&
                                !existingFile &&
                                !confirm(
                                    "A file with this name already exists. Do you want to overwrite it?"
                                )
                            ) {
                                return;
                            }

                            uploading.val = true;
                            await this.startUpload(
                                file,
                                filenameInputEl.value,
                                uploadPct,
                                statusMsg,
                                closed
                            );
                        },
                    },
                    existingFile ? "Re-upload" : "Upload"
                ),
                existingFile
                    ? button(
                          {
                              type: "button",
                              class: "px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                              onclick: async () => {
                                  await this.deleteFile(existingFile);
                                  closed.val = true;
                              },
                          },
                          "Delete"
                      )
                    : null,
                button(
                    {
                        type: "button",
                        class: "px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
                        onclick: () => {
                            closed.val = true;
                        },
                    },
                    "Cancel"
                )
            )
        );

        van.add(
            document.body,
            Modal(
                {
                    closed,
                    backgroundStyleOverrides: {
                        "align-items": "flex-start",
                        "padding-top": "15vh",
                    },
                },
                div(
                    { class: "p-3 w-[500px] rounded-lg shadow-lg" },
                    h3(
                        {
                            class: "text-lg font-semibold text-gray-900 mb-4 border-b pb-2",
                        },
                        existingFile ? "Manage Video" : "Upload Video"
                    ),
                    formEl
                )
            )
        );
    }

    async startUpload(file, filename, uploadPct, statusMsg, closed) {
        console.log("Starting multipart upload for file:", filename);
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB — S3 minimum part size
        const orgId = orgContext.getCurrentOrgId();
        const jobs = new JobsData();

        try {
            statusMsg.val = "Initiating upload...";
            eventBus.fire("videoUpload.requestingUrl", { file });

            const initResult = await storage.requestMultipartUploadUrl(
                file,
                "videos",
                filename,
                orgId
            );
            const { uploadId, path, storageType } = initResult;
            const uploadStorage = Storage.getInstance(storageType || "seaweed");

            const numParts = Math.ceil(file.size / CHUNK_SIZE);
            const parts = [];
            let bytesUploaded = 0;

            statusMsg.val = "Uploading...";
            eventBus.fire("videoUpload.uploading", { file });

            for (let i = 0; i < numParts; i++) {
                const partNumber = i + 1;
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                const partSize = end - start;
                const bytesAtPartStart = bytesUploaded;

                const uploadUrl = await storage.requestPartUrl(
                    uploadId,
                    path,
                    partNumber,
                    orgId
                );

                const etag = await uploadStorage.uploadToSignedPartUrl(
                    uploadUrl,
                    chunk,
                    (pct) => {
                        const overall =
                            ((bytesAtPartStart + (pct / 100) * partSize) /
                                file.size) *
                            100;
                        uploadPct.val = overall;
                        eventBus.fire("videoUpload.progress", { pct: overall });
                    },
                    start,
                    file.size
                );

                bytesUploaded += partSize;
                parts.push({ PartNumber: partNumber, ETag: etag });
            }

            uploadPct.val = 100;
            statusMsg.val = "Finalizing upload...";
            await storage.requestCompleteMultipartUpload(
                uploadId,
                path,
                parts,
                orgId
            );

            console.log("Saving file record to database...", filename);
            let fileId = this.getIdForFilename(filename);
            fileId = await this.save(
                filename,
                "videos",
                "video",
                file.type,
                fileId
            );

            eventBus.fire("videoUpload.complete", { file });
            eventBus.fire("videoFiles.updated");
            statusMsg.val = "Upload complete.";

            let jobId = await this.requestProcessing(fileId);
            eventBus.fire("videoUpload.processingRequested", { file });

            await jobs.watchJobStatus(jobId, (statusLines) => {
                statusMsg.val = `Processing...\n${statusLines}`;
            });

            statusMsg.val = "Processing complete.";
            console.log("Video upload and processing complete.");
            eventBus.fire("videoUpload.processed", { file });

            window.setTimeout(() => {
                closed.val = true;
            }, 1000);
        } catch (err) {
            statusMsg.val = `Error: ${err.message}`;
            eventBus.fire("videoUpload.error", { file, error: err });
        }
    }

    async requestProcessing(fileId) {
        try {
            let result = await apiUtil.call(
                `/api/file/process/${fileId}`,
                {},
                "POST"
            );
            console.log(`Processing requested for file ${fileId}`);

            return result.jobId;
        } catch (err) {
            console.error(
                `Error requesting processing for file ${fileId}:`,
                err
            );
        }
    }

    async deleteFile(file) {
        await database.delete("files", file.id);

        try {
            const orgId = orgContext.getCurrentOrgId();
            await storage.requestDeleteFile(
                file.filename,
                "videos",
                orgId,
                file.storage
            );
        } catch (err) {
            console.error("Error deleting file from storage:", err);
        }
        eventBus.fire("videoFiles.updated");
    }
}

const videoFiles = new VideoFiles();
export default videoFiles;
export { videoFiles, VideoFiles };
