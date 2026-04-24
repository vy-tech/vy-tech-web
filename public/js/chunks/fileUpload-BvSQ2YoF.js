import { v as van, e as eventBus } from './eventbus-c5hoJhOF.js';
import { F as FilesData } from './files-Du20HlMg.js';
import { d as database, a as apiUtil } from './apiUtil-CDq4WBQY.js';
import { o as orgContext } from './orgContext-CvnztG5e.js';
import { s as storage } from './storage-Dh8pfopK.js';
import { t as timeUtil, H as Hierarchy } from './hierarchy-BeeefNz4.js';

class JobsData {
    async getByFile(fileId) {
        return await database.query("jobs", { refType: "file", refId: fileId });
    }

    async getByRef(refType, refId, type) {
        const filters = { refType, refId };
        if (type) filters.type = type;
        return await database.query("jobs", filters);
    }

    async resetRejectedByOrg(oid) {
        const rejected = await database.query("jobs", {
            oid,
            status: "rejected",
        });
        for (const job of rejected) {
            await database.update("jobs", job.id, { status: "requested" });
            if (job.refType === "file" && job.refId) {
                await database.atomicUpdate(
                    "files",
                    job.refId,
                    "status",
                    "rejected",
                    "processing"
                );
            }
        }
        return rejected.length;
    }

    async queueJob(refType, refId, type, uid, oid, location = null) {
        const jobDoc = {
            refType: refType,
            refId: refId,
            type: type,
            status: "requested",
            uid: uid,
            oid: oid,
            location: location,
        };

        return await database.set("jobs", jobDoc);
    }

    async getJobTree(jobId) {
        const jobs = [];

        const getJob = async (id, depth) => {
            const jobData = await database.get("jobs", id);
            if (!jobData) return;

            jobs.push({ ...jobData, depth });

            if (jobData.children && jobData.children.length > 0) {
                for (const childId of jobData.children) {
                    await getJob(childId, depth + 1);
                }
            }
        };

        await getJob(jobId, 0);

        return jobs;
    }

    watchJobStatus(jobId, onChange) {
        return new Promise((resolve, reject) => {
            const status = {};
            const watched = {};

            const notify = () => {
                const keys = Object.keys(status).sort().reverse();
                onChange(keys.map((key) => status[key]).join("\n"));
            };

            const watchJob = async (id, depth) => {
                if (watched[id]) return;
                watched[id] = true;

                const indent = "  ".repeat(depth);

                const unsub = await database.watch(
                    "jobs",
                    id,
                    async (jobData) => {
                        if (jobData.status === "completed") {
                            delete status[id];
                        } else {
                            status[id] =
                                `${indent}${jobData.type} - ${jobData.status}${jobData.message ? ": " + jobData.message : ""}`;
                        }

                        if (jobData.children && jobData.children.length > 0) {
                            for (const childId of jobData.children) {
                                await watchJob(childId, depth + 1);
                            }
                        }

                        notify();

                        if (
                            jobData.status === "completed" ||
                            jobData.status === "failed"
                        ) {
                            unsub();
                            if (id === jobId) {
                                if (jobData.status === "completed") {
                                    resolve();
                                } else if (jobData.status === "failed") {
                                    reject(
                                        new Error(
                                            `Job ${jobId} failed: ${jobData.message}`
                                        )
                                    );
                                }
                            }
                        }
                    }
                );
            };

            watchJob(jobId, 0);
        });
    }
}

// Registry of supported upload types. Add a new entry here (and a matching
// backend entry in src/functions/file/index.js PROCESSORS) to expose a new
// file type in the Uploads view.
const UPLOAD_TYPES = {
    video: {
        context: "video",
        label: "Video",
        pluralLabel: "Videos",
        destinationPath: "videos",
        accept: "video/*",
        mimeFilter: (file) => file.type.startsWith("video/"),
        requestProcessing: true,
        processorEndpoint: "/api/file/process/",
    },
};

const STATUS_STYLES = {
    available: {
        label: "Available",
        class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    processing: {
        label: "Processing",
        class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        spinner: true,
    },
    failed: {
        label: "Failed",
        class: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
    deleted: {
        label: "Deleted",
        class: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
    },
    rejected: {
        label: "Rejected",
        class: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    },
};

function effectiveStatus(file) {
    if (file.status) return file.status;
    if (file.deleteRequested) return "deleted";
    return "available";
}

function formatBytes(bytes) {
    if (bytes == null || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let i = -1;
    let n = bytes;
    do {
        n /= 1024;
        i++;
    } while (n >= 1024 && i < units.length - 1);
    return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

function reportsUrlFor(file) {
    if (!file.hierarchy) return null;
    try {
        return "/reports/" + new Hierarchy(file.hierarchy).toFileString("/");
    } catch (err) {
        console.warn("Could not build reports URL for", file, err);
        return null;
    }
}

class FileUploadPanel {
    /**
     * Inline upload + management panel for a single file type.
     * Config shape: see UPLOAD_TYPES above.
     */
    constructor(config) {
        this.config = config;
        this.fileMap = new Map();
        this.files = van.state([]);
        this.showDeleted = van.state(false);
        this.formOpen = van.state(false);
        this.editingFile = van.state(null);
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
                console.warn("Error tearing down files listener:", err);
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
                    this.files.val = Array.from(this.fileMap.values()).sort(
                        (a, b) => {
                            const ta = a.created?.toMillis
                                ? a.created.toMillis()
                                : a.created || 0;
                            const tb = b.created?.toMillis
                                ? b.created.toMillis()
                                : b.created || 0;
                            return tb - ta;
                        }
                    );
                },
                { oid: orgId, context: this.config.context }
            );
        } catch (err) {
            console.error("Failed to subscribe to files:", err);
        }
    }

    visibleFiles() {
        const show = this.showDeleted.val;
        return this.files.val.filter((f) =>
            show ? true : effectiveStatus(f) !== "deleted"
        );
    }

    deletedCount() {
        return this.files.val.filter(
            (f) => effectiveStatus(f) === "deleted"
        ).length;
    }

    hasFilename(filename) {
        return this.files.val.some(
            (f) =>
                f.filename === filename && effectiveStatus(f) !== "deleted"
        );
    }

    getIdForFilename(filename) {
        const file = this.files.val.find(
            (f) =>
                f.filename === filename && effectiveStatus(f) !== "deleted"
        );
        return file ? file.id : null;
    }

    openNew() {
        this.editingFile.val = null;
        this.formOpen.val = true;
    }

    openExisting(file) {
        this.editingFile.val = file;
        this.formOpen.val = true;
    }

    close() {
        this.formOpen.val = false;
        this.editingFile.val = null;
    }

    createElement(options = {}) {
        const { div, h2, i, span, button, label, input } = van.tags;
        const cfg = this.config;

        const merged = {
            class: "w-full flex flex-col",
            ...options,
        };

        const container = div(merged);

        const header = div(
            { class: "flex items-center justify-between mb-3" },
            h2(
                { class: "text-xl font-semibold dark:text-white" },
                cfg.pluralLabel
            ),
            button(
                {
                    class: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2",
                    onclick: () => this.openNew(),
                },
                i({ class: "las la-cloud-upload-alt text-xl" }),
                `Upload ${cfg.label}`
            )
        );

        const toolbar = div(
            {
                class: "flex items-center justify-end text-sm text-gray-600 dark:text-gray-400 mb-2 gap-2",
            },
            () => {
                const n = this.deletedCount();
                if (n === 0) return span();
                return label(
                    {
                        class: "inline-flex items-center gap-2 cursor-pointer select-none",
                    },
                    input({
                        type: "checkbox",
                        checked: this.showDeleted,
                        onchange: (e) =>
                            (this.showDeleted.val = e.target.checked),
                        class: "rounded",
                    }),
                    `Show deleted (${n})`
                );
            }
        );

        const list = div(
            {
                class: "border rounded-md divide-y dark:border-gray-700 dark:divide-gray-700 bg-white dark:bg-gray-800",
            },
            () => {
                const files = this.visibleFiles();
                if (files.length === 0) {
                    return div(
                        {
                            class: "p-4 text-sm text-gray-500 dark:text-gray-400",
                        },
                        `No ${cfg.pluralLabel.toLowerCase()} uploaded yet. Click "Upload ${cfg.label}" to add your first one.`
                    );
                }
                return div(...files.map((f) => this.renderRow(f)));
            }
        );

        const formArea = div({ class: "mt-4" }, () =>
            this.formOpen.val ? this.createForm() : div()
        );

        van.add(container, header, formArea, toolbar, list);
        return container;
    }

    renderRow(file) {
        const { div, a, span, button, i } = van.tags;
        const status = effectiveStatus(file);
        const styles = STATUS_STYLES[status] || STATUS_STYLES.available;
        const isDeleted = status === "deleted";
        const url = status === "available" ? reportsUrlFor(file) : null;

        const filenameNode = url
            ? a(
                  {
                      href: url,
                      class: "flex-1 truncate text-blue-600 dark:text-blue-400 hover:underline",
                  },
                  file.filename
              )
            : span(
                  {
                      class: `flex-1 truncate ${
                          isDeleted
                              ? "line-through text-gray-500 dark:text-gray-400"
                              : "dark:text-gray-200"
                      }`,
                  },
                  file.filename
              );

        const badge = span(
            {
                class: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles.class}`,
            },
            styles.spinner
                ? i({ class: "las la-spinner la-spin" })
                : null,
            styles.label
        );

        const uploadedAt = file.created
            ? timeUtil.formatTimeAgo(file.created)
            : "";
        const durationStr =
            file.duration != null ? timeUtil.format(file.duration) : "";
        const sizeStr = formatBytes(file.size);

        const manageBtn = isDeleted
            ? null
            : button(
                  {
                      class: "ml-2 px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200",
                      onclick: () => this.openExisting(file),
                  },
                  "Manage"
              );

        return div(
            {
                class: `grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 p-3 text-sm ${
                    isDeleted
                        ? "opacity-60"
                        : "hover:bg-gray-50 dark:hover:bg-gray-900"
                }`,
            },
            i({ class: "las la-file-video text-lg flex-shrink-0" }),
            filenameNode,
            badge,
            span(
                { class: "text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums w-16" },
                sizeStr
            ),
            span(
                { class: "text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums w-14" },
                durationStr
            ),
            span(
                {
                    class: "text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap",
                    title: file.created?.toDate
                        ? file.created.toDate().toISOString()
                        : "",
                },
                uploadedAt
            ),
            manageBtn
        );
    }

    createForm() {
        const { div, h3, form, label, input, button, progress, p, i } = van.tags;
        const cfg = this.config;
        const existingFile = this.editingFile.val;

        const uploadPct = van.state(0);
        const statusMsg = van.state(
            existingFile
                ? `Current file: ${existingFile.filename}`
                : `Select a ${cfg.label.toLowerCase()} file to upload.`
        );
        const uploading = van.state(false);

        if (existingFile) {
            this.watchRelatedJobs(existingFile.id, statusMsg);
        }

        let fileInputEl;
        let filenameInputEl;

        const formEl = form(
            { class: "space-y-4" },
            div(
                { class: "flex flex-col space-y-1" },
                label(
                    {
                        for: "upload-file-input",
                        class: "text-sm font-medium text-gray-700 dark:text-gray-300",
                    },
                    `${cfg.label} File`
                ),
                (fileInputEl = input({
                    id: "upload-file-input",
                    type: "file",
                    accept: cfg.accept,
                    class: "text-sm text-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100",
                    onchange: (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            if (!filenameInputEl.value) {
                                filenameInputEl.value = file.name;
                                filenameInputEl.parentElement.classList.remove(
                                    "hidden"
                                );
                            }
                            statusMsg.val = `Selected: ${file.name} (${formatBytes(file.size)})`;
                        } else {
                            statusMsg.val = `Select a ${cfg.label.toLowerCase()} file to upload.`;
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
                        for: "upload-filename-input",
                        class: "text-sm font-medium text-gray-700 dark:text-gray-300",
                    },
                    "Filename"
                ),
                (filenameInputEl = input({
                    id: "upload-filename-input",
                    type: "text",
                    value: existingFile ? existingFile.filename : "",
                    class: "px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                }))
            ),
            () =>
                uploading.val && uploadPct.val < 100
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
                {
                    class: "text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap",
                },
                statusMsg
            ),
            () =>
                uploading.val
                    ? div()
                    : div(
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
                            if (cfg.mimeFilter && !cfg.mimeFilter(file)) {
                                statusMsg.val = `File type ${file.type || "(unknown)"} is not supported for ${cfg.label.toLowerCase()} uploads.`;
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
                                statusMsg
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
                                  if (
                                      !confirm(
                                          `Delete "${existingFile.filename}"? This cannot be undone.`
                                      )
                                  ) {
                                      return;
                                  }
                                  await this.deleteFile(existingFile);
                                  this.close();
                              },
                          },
                          "Delete"
                      )
                    : null,
                button(
                    {
                        type: "button",
                        class: "px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
                        onclick: () => this.close(),
                    },
                    "Cancel"
                )
            )
        );

        return div(
            {
                class: "p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700 mb-4",
            },
            div(
                {
                    class: "flex items-center justify-between mb-4 border-b pb-2 dark:border-gray-700",
                },
                h3(
                    {
                        class: "text-lg font-semibold text-gray-900 dark:text-white",
                    },
                    existingFile
                        ? `Manage ${cfg.label}`
                        : `Upload ${cfg.label}`
                ),
                button(
                    {
                        type: "button",
                        "aria-label": "Close",
                        class: "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none",
                        onclick: () => this.close(),
                    },
                    i({ class: "las la-times text-xl" })
                )
            ),
            formEl
        );
    }

    async startUpload(file, filename, uploadPct, statusMsg) {
        const cfg = this.config;
        const orgId = orgContext.getCurrentOrgId();
        const files = new FilesData();
        const jobs = new JobsData();

        try {
            statusMsg.val = "Requesting upload URL...";
            eventBus.fire(`${cfg.context}Upload.requestingUrl`, { file });

            const uploadUrl = await storage.requestUploadUrl(
                file,
                cfg.destinationPath,
                filename,
                orgId,
                file.type,
                "firebase"
            );

            statusMsg.val = "Uploading...";
            eventBus.fire(`${cfg.context}Upload.uploading`, { file });

            await storage.uploadToSignedUrl(
                uploadUrl,
                file,
                file.type,
                (pct) => {
                    uploadPct.val = pct;
                    eventBus.fire(`${cfg.context}Upload.progress`, { pct });
                }
            );

            uploadPct.val = 100;
            statusMsg.val = "Saving file record...";

            let fileId = this.getIdForFilename(filename);
            fileId = await files.save(
                filename,
                cfg.destinationPath,
                cfg.context,
                file.type,
                fileId,
                "firebase",
                {
                    size: file.size,
                    status: cfg.requestProcessing
                        ? "processing"
                        : "available",
                }
            );

            eventBus.fire(`${cfg.context}Upload.complete`, { file });

            if (cfg.requestProcessing) {
                const jobId = await this.requestProcessing(fileId);
                eventBus.fire(`${cfg.context}Upload.processingRequested`, {
                    file,
                });

                if (jobId) {
                    await jobs.watchJobStatus(jobId, (statusLines) => {
                        statusMsg.val = `Processing...\n${statusLines}`;
                    });
                    statusMsg.val = "Processing complete.";
                    eventBus.fire(`${cfg.context}Upload.processed`, { file });
                }
            } else {
                statusMsg.val = "Upload complete.";
            }

            window.setTimeout(() => this.close(), 1000);
        } catch (err) {
            statusMsg.val = `Error: ${err.message}`;
            eventBus.fire(`${cfg.context}Upload.error`, { file, error: err });
        }
    }

    async watchRelatedJobs(fileId, statusMsg) {
        const cfg = this.config;
        if (!cfg.requestProcessing) return;
        const jobs = new JobsData();
        try {
            const related = await jobs.getByRef("file", fileId);
            const topJob = related.find((j) => j.type === "ProcessFootage");
            if (!topJob) return;

            await jobs.watchJobStatus(topJob.id, (statusLines) => {
                statusMsg.val = `Processing...\n${statusLines}`;
            });
            statusMsg.val = "Processing complete.";
        } catch (err) {
            statusMsg.val = `Error: ${err.message}`;
        }
    }

    async requestProcessing(fileId) {
        const cfg = this.config;
        try {
            const result = await apiUtil.call(
                `${cfg.processorEndpoint}${fileId}`,
                {},
                "POST"
            );
            return result.jobId;
        } catch (err) {
            console.error(
                `Error requesting processing for file ${fileId}:`,
                err
            );
        }
    }

    async deleteFile(file) {
        const files = new FilesData();
        try {
            await files.update(file.id, {
                status: "deleted",
                deletedAt: Date.now(),
            });
            await storage.requestDeleteFile(file.id);
        } catch (err) {
            console.error("Error requesting file deletion:", err);
        }
    }
}

export { FileUploadPanel as F, UPLOAD_TYPES as U, effectiveStatus as e };
//# sourceMappingURL=fileUpload-BvSQ2YoF.js.map
