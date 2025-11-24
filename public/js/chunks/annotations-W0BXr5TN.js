import { v as van } from './van-t8DywzvC.js';
import { e as eventBus } from './eventbus-B9JUr222.js';
import { P as ProfilesData, A as AnnotationsData, H as Hierarchy, M as Modal, b as progress } from './annotations-DIEmz6Fr.js';
import { d as database } from './db-DioOKqjp.js';
import { t as timeUtil } from './events-2u8ONcFD.js';

class Profiles extends ProfilesData {
    constructor() {
        super();
    }

    async setSelectorToAll() {
        const profiles = await this.getAll();
        this.profileListState.val = profiles;
    }

    createOptionElement(profileData, selected) {
        const { option } = van.tags;

        const displayName = profileData.name || "Unnamed Profile";
        const displayDescription = profileData.description
            ? ` - ${profileData.description}`
            : "";
        const displayText = `${displayName}${displayDescription}`;

        return option(
            {
                value: profileData.id,
                selected: profileData.id == selected,
            },
            displayText
        );
    }

    createSelectorElement(selected) {
        const { div, select } = van.tags;
        this.profileListState = van.state([]);
        this.setSelectorToAll();

        const container = div({ class: "vyprofiles-selector" }, () => {
            const sel = select({
                id: "profile-select",
                class: "w-full text-black p-1",
            });

            this.profileListState.val.forEach((profileData) =>
                van.add(sel, this.createOptionElement(profileData, selected))
            );

            sel.addEventListener("change", (e) => {
                eventBus.dispatchEvent(
                    new CustomEvent("ui.requestProfile", {
                        detail: e.target.value,
                    })
                );
            });

            return sel;
        });

        return container;
    }
}

const profiles = new Profiles();

class Annotations extends AnnotationsData {
    constructor() {
        super();
        this.annotations = [];
        this.hierarchy = null;

        eventBus.addEventListener("ui.addAnnotation", async (e) => {
            this.addAnnotation(e.detail.hierarchy);
        });

        eventBus.addEventListener("ui.editAnnotation", async (e) => {
            const annotation = e.detail.annotation;
            await this.editAnnotation(annotation);
        });

        eventBus.addEventListener("ui.importTranscript", async (e) => {
            const offset =
                (e.detail.event &&
                    e.detail.event.embed &&
                    e.detail.event.embed.offset * -1) ||
                0;

            this.importTranscript(e.detail.hierarchy, offset);
        });
    }

    getCurrent() {
        if (this.annotations && this.hierarchy) {
            return this.annotations;
        }

        throw new Error("No hierarchy loaded");
    }

    async getByHierarchy(hierarchy) {
        let hier = new Hierarchy(hierarchy);
        let h = hier.toEventString();

        if (this.annotations && this.hierarchy === h) {
            return this.annotations;
        }

        this.hierarchy = h;
        this.annotations = await super.getByHierarchy(hierarchy);

        eventBus.fire("annotations.ready", { hierarchy: h });

        return this.annotations;
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = {
            id: "report-annotations",
            class: "w-full h-auto mt-2",
            ...options,
        };

        this.container = div(merged);

        return this.container;
    }

    async addAnnotation(hierarchy) {
        const result = await this.showAnnotationForm();
        if (!result) return;
        const { action, annotation } = result;

        if (action !== "create") {
            console.warn("Unknown action:", action);
            return;
        }

        await this.saveAnnotation(hierarchy, annotation);

        // Fire event to notify that annotations have been updated
        eventBus.fire("annotations.updated", {
            hierarchy: annotation.hierarchy,
        });

        return annotation;
    }

    async editAnnotation(existingAnnotation) {
        if (!existingAnnotation) {
            throw new Error("No annotation provided to edit");
        }

        const result = await this.showAnnotationForm(existingAnnotation);
        if (!result) return;
        const { action, annotation } = result;

        if (action === "update") {
            await this.saveAnnotation(existingAnnotation.hierarchy, annotation);
        } else if (action === "delete") {
            await this.deleteAnnotation(existingAnnotation.id);
        } else {
            console.warn("Unknown action:", action);
            return;
        }

        // Fire event to notify that annotations have been updated
        eventBus.fire("annotations.updated", {
            hierarchy: annotation.hierarchy,
        });
    }

    showAnnotationForm(existingAnnotation = null) {
        const defaultTime = timeUtil.playbackTime;
        const hasWallclockTime = timeUtil.wallclockStartTime !== null;

        return new Promise((resolve, reject) => {
            const { div, h3, form, label, input, select, button, option } =
                van.tags;

            // State to track which time mode is selected
            let timeMode = van.state("video"); // "video" or "wallclock"

            let closed = van.state(false);
            let formEl = form(
                { class: "space-y-4" },

                // Time mode selector - only show if wallclock time is available and not editing
                !existingAnnotation && hasWallclockTime
                    ? div(
                          { class: "flex flex-col space-y-1" },
                          label(
                              {
                                  for: "timeMode",
                                  class: "text-sm font-medium text-gray-700 w-20",
                              },
                              "Time Mode"
                          ),
                          select(
                              {
                                  name: "timeMode",
                                  class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white",
                                  onchange: (e) => {
                                      timeMode.val = e.target.value;
                                  },
                              },
                              option(
                                  { value: "video", selected: true },
                                  "Video Time (seconds)"
                              ),
                              option(
                                  { value: "wallclock" },
                                  "Wallclock Time (Pacific Time)"
                              )
                          )
                      )
                    : null,

                // Time input - changes based on mode and availability
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "time",
                            class: "text-sm font-medium text-gray-700 w-80",
                        },
                        () => {
                            if (existingAnnotation) return "Time (seconds)";
                            if (!hasWallclockTime) return "Time (seconds)";
                            return timeMode.val === "video"
                                ? "Time (seconds)"
                                : "Wallclock Time (Pacific Time)";
                        }
                    ),
                    input({
                        name: "time",
                        value: () => {
                            // If editing, always show as video time
                            if (existingAnnotation) {
                                return timeUtil.format(
                                    existingAnnotation.time,
                                    true
                                );
                            }

                            if (!hasWallclockTime || timeMode.val === "video") {
                                return timeUtil.format(defaultTime, true);
                            } else {
                                return timeUtil.playbackLocalString;
                            }
                        },
                        type: "text",
                        class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                        placeholder: () => {
                            if (existingAnnotation || !hasWallclockTime)
                                return "e.g., 125.5 or 2:05.5";
                            return timeMode.val === "video"
                                ? "e.g., 125.5 or 2:05.5"
                                : "e.g., 12/15/2023 14:30:00";
                        },
                    })
                ),

                // Helper text
                div({ class: "text-xs text-gray-500" }, () => {
                    if (existingAnnotation || !hasWallclockTime) {
                        return "Enter time in seconds (e.g., 125.5) or HH:MM:SS format (e.g., 2:05.5)";
                    }
                    return timeMode.val === "video"
                        ? "Enter time in seconds (e.g., 125.5) or MM:SS format (e.g., 2:05.5)"
                        : "Enter date/time in MM/DD/YYYY HH:MM:SS format (Pacific Time)";
                }),

                // Type of annotation (transcript, action, event, note)
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "type",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Type"
                    ),
                    select(
                        {
                            name: "type",
                            class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white",
                        },
                        option(
                            {
                                value: "transcript",
                                selected:
                                    existingAnnotation?.type === "transcript",
                            },
                            "Transcript"
                        ),
                        option(
                            {
                                value: "action",
                                selected: existingAnnotation?.type === "action",
                            },
                            "Game Action"
                        ),
                        option(
                            {
                                value: "event",
                                selected: existingAnnotation?.type === "event",
                            },
                            "Non-Game Event"
                        ),
                        option(
                            {
                                value: "note",
                                selected:
                                    !existingAnnotation ||
                                    existingAnnotation?.type === "note",
                            },
                            "Note"
                        )
                    )
                ),

                // Importance (low, medium, high, critical)
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "importance",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Importance"
                    ),
                    select(
                        {
                            name: "importance",
                            class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white",
                        },
                        option(
                            {
                                value: "low",
                                selected:
                                    existingAnnotation?.importance === "low",
                            },
                            "Low"
                        ),
                        option(
                            {
                                value: "medium",
                                selected:
                                    !existingAnnotation ||
                                    existingAnnotation?.importance === "medium",
                            },
                            "Medium"
                        ),
                        option(
                            {
                                value: "high",
                                selected:
                                    existingAnnotation?.importance === "high",
                            },
                            "High"
                        ),
                        option(
                            {
                                value: "critical",
                                selected:
                                    existingAnnotation?.importance ===
                                    "critical",
                            },
                            "Critical"
                        )
                    )
                ),

                // Text content (string)
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "content",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Content"
                    ),
                    input({
                        name: "content",
                        value: existingAnnotation?.content || "",
                        class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                    })
                ),

                // Submit and Cancel buttons
                div(
                    { class: "flex space-x-3 pt-4" },
                    button(
                        {
                            type: "button",
                            class: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                            onclick: async () => {
                                try {
                                    if (existingAnnotation) {
                                        // Update existing annotation
                                        const updatedAnnotation =
                                            this.getAnnotationData(formEl);

                                        updatedAnnotation.id =
                                            existingAnnotation.id;
                                        closed.val = true;
                                        resolve({
                                            action: "update",
                                            annotation: updatedAnnotation,
                                        });
                                    } else {
                                        // Create new annotation
                                        const annotation =
                                            this.getAnnotationData(formEl);
                                        closed.val = true;
                                        resolve({
                                            action: "create",
                                            annotation,
                                        });
                                    }
                                } catch (error) {
                                    reject(error);
                                }
                            },
                        },
                        existingAnnotation
                            ? "Update Annotation"
                            : "Create Annotation"
                    ),
                    // Delete button (only when editing)
                    ...(existingAnnotation
                        ? [
                              button(
                                  {
                                      type: "button",
                                      class: "px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                                      onclick: async () => {
                                          if (
                                              confirm(
                                                  "Are you sure you want to delete this annotation?"
                                              )
                                          ) {
                                              try {
                                                  closed.val = true;
                                                  resolve({
                                                      action: "delete",
                                                      annotation:
                                                          existingAnnotation,
                                                  });
                                              } catch (error) {
                                                  reject(error);
                                              }
                                          }
                                      },
                                  },
                                  "Delete"
                              ),
                          ]
                        : []),
                    button(
                        {
                            type: "button",
                            class: "px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
                            onclick: () => {
                                closed.val = true;
                                resolve(null);
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
                            "align-items": "flex-start", // Align to top instead of center
                            "padding-top": "15vh", // Add some padding from the top
                        },
                    },
                    div(
                        { class: "p-3 w-[750px] rounded-lg shadow-lg" },
                        h3(
                            {
                                class: "text-lg font-semibold text-gray-900 mb-4 border-b pb-2",
                            },
                            existingAnnotation
                                ? "Edit Annotation"
                                : "Create Annotation"
                        ),
                        formEl
                    )
                )
            );
        });
    }

    getAnnotationData(formEl) {
        const hasWallclockTime = timeUtil.wallclockStartTime !== null;

        const formData = new FormData(formEl);
        const timeMode = formData.get("timeMode") || "video";
        const timeInput = formData.get("time") || "";
        const type = formData.get("type") || "note";
        const importance = formData.get("importance") || "medium";
        const content = formData.get("content") || "";

        let time = 0;

        if (timeMode === "video" || !hasWallclockTime) {
            // Parse as video time (seconds or MM:SS format)
            time = timeUtil.toSeconds(timeInput) || 0;
        } else {
            // Parse as wallclock time and convert to video time
            time = timeUtil.toSecondsFromLocalString(timeInput);
        }

        // Extract tags from content as an array
        const tags = content
            .split(/\s+/)
            .filter((word) => word.startsWith("#"))
            .map((tag) => tag.slice(1));

        const annotation = {
            time,
            type,
            importance,
            content,
            tags,
        };

        return annotation;
    }

    async importTranscript(hierarchy, defaultOffset = 0) {
        // Show the import transcript form
        const annotations = await this.showImportTranscriptForm(defaultOffset);

        // If we get annotations back, save them
        if (annotations && annotations.length > 0) {
            await this.deleteTranscript(hierarchy);
            await this.saveTranscript(hierarchy, annotations);

            // Fire event to notify that annotations have been updated
            eventBus.fire("annotations.updated", {
                hierarchy: hierarchy,
            });
        }
    }

    async showImportTranscriptForm(defaultOffset = 0) {
        return new Promise((resolve, reject) => {
            const { div, h3, form, label, input, button, textarea } = van.tags;

            let closed = van.state(false);
            let formEl = form(
                { class: "space-y-4" },

                // Time offset in seconds
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "offset",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Offset Time (seconds)"
                    ),
                    input({
                        name: "offset",
                        value: timeUtil.format(defaultOffset, true),
                        type: "text",
                        class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                    })
                ),

                // Text content (string)
                div(
                    { class: "flex flex-col space-y-1" },
                    label(
                        {
                            for: "transcript",
                            class: "text-sm font-medium text-gray-700 w-20",
                        },
                        "Transcript"
                    ),
                    textarea({
                        name: "transcript",
                        value: "",
                        class: "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900",
                    })
                ),

                // Submit and Cancel buttons
                div(
                    { class: "flex space-x-3 pt-4" },
                    button(
                        {
                            type: "button",
                            class: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                            onclick: async () => {
                                try {
                                    const transcript =
                                        this.getTranscriptData(formEl);
                                    closed.val = true;
                                    resolve(transcript);
                                } catch (error) {
                                    reject(error);
                                }
                            },
                        },
                        "Import Transcript"
                    ),
                    button(
                        {
                            type: "button",
                            class: "px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
                            onclick: () => {
                                closed.val = true;
                                resolve(null);
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
                            "align-items": "flex-start", // Align to top instead of center
                            "padding-top": "15vh", // Add some padding from the top
                        },
                    },
                    div(
                        { class: "p-3 w-[500px] rounded-lg shadow-lg" },
                        h3(
                            {
                                class: "text-lg font-semibold text-gray-900 mb-4 border-b pb-2",
                            },
                            "Create Annotation"
                        ),
                        formEl
                    )
                )
            );
        });
    }

    getTranscriptData(formEl) {
        const formData = new FormData(formEl);
        const offset = timeUtil.toSeconds(formData.get("offset")) || 0;
        const transcriptText = formData.get("transcript") || "";

        // Split transcriptText into lines, then parse each line for time and text
        const lines = transcriptText.split("\n");
        const annotations = [];
        let currentTime = offset;

        lines.forEach((line) => {
            // Match [mm:ss] or [hh:mm:ss] at start of line
            const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)$/);

            if (match) {
                const timeStr = match[1];
                currentTime = timeUtil.toSeconds(timeStr, true) + offset;
            } else {
                annotations.push({
                    time: currentTime,
                    type: "transcript",
                    importance: "medium",
                    content: line.trim(),
                });
            }
        });

        return annotations;
    }

    async deleteTranscript(hierarchy) {
        const { closed, pct } = progress.show(
            "Deleting Existing Transcript..."
        );

        await super.deleteTranscript(hierarchy, pct, closed);

        closed.val = true;
    }

    async saveTranscript(hierarchy, annotations) {
        const { closed, pct } = progress.show("Importing Transcript...");

        await super.saveTranscript(hierarchy, annotations, pct, closed);

        closed.val = true;
    }

    async getAvailable() {
        const events = await database.query(
            "events",
            { status: "available" },
            "begin"
        );
        return events;
    }
}

const annotations = new Annotations();

export { annotations as a, profiles as p };
//# sourceMappingURL=annotations-W0BXr5TN.js.map
