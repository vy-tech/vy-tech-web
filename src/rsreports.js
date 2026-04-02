import van from "vanjs-core";
import { Tabs } from "vanjs-ui";

import { eventBus } from "./eventbus.js";

import { scoring } from "./scoring/scoring.js";
import { summarizer } from "./scoring/summarizer.js";
import { profilesData } from "./data/profiles.js";
import { profiles } from "./ui/profiles.js";
import { activeBoxManager } from "./scoring/activeBoxManager.js";

import { events } from "./ui/events.js";
import { annotations } from "./ui/annotations.js";
import { exporter } from "./ui/exporter.js";

import { Hierarchy } from "./util/hierarchy.js";
import { timeUtil } from "./util/time.js";

import { heatmap } from "./viz/heatmap.js";
import { cameramap } from "./viz/cameramap.js";
import { ekg } from "./viz/ekg.js";
import { spider } from "./viz/spider.js";
import { summaryGraph } from "./viz/summarygraph.js";
import { genderDemo, ageDemo } from "./viz/demographics.js";
//import { momentlist } from "./viz/momentlist.js";
import { linkedPlayer } from "./viz/linkedPlayer.js";
import { annotationLog } from "./viz/annotationlog.js";
//import { summaryEditor } from "./viz/summaryeditor.js";

import { videoFiles } from "./ui/videofiles.js";

class Reports {
    constructor() {
        this.hierarchy = this.getHierarchyFromPath() || null;
        this.currentCamera = 1;
        this.startTimeOffset = this.getTimeOffsetFromHash() || 0;
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.playlistUrl = this.hierarchy
            ? `/playlist/${this.hierarchy.toString("-")}-720p.m3u8`
            : null;

        this.score = scoring;

        this.transcript = [];
        this.tsIndex = 0;

        //this.event = null;
        this.wallclockStartTimeUTC = null;
    }

    async changeHierarchy(hierarchy) {
        console.log("Changing hierarchy to:", hierarchy);

        this.player.pause();

        // TODO FIXME This is super brittle please refactor
        if (!hierarchy) {
            this.hierarchy = null;
            this.playlistUrl = null;
            this.hls.loadSource("");
            activeBoxManager.reset();
            this.score.resetWindow();
            //this.event = events.current = null;
        } else {
            this.hierarchy = new Hierarchy(hierarchy);
            this.playlistUrl = `/playlist/${this.hierarchy.toString("-")}-720p.m3u8`;
            this.startTimeOffset = 0;

            this.hierarchy.camera = 1;
            // this.event = await events.getByHierarchy(
            //     this.hierarchy.toString(":")
            // );
            await summarizer.ensure(this.hierarchy.toString("-"));
            this.changeCamera(1);
        }

        this.resetTitle();
        this.loadSource();

        eventBus.fire("ui.hierarchyChanged", {
            hierarchy: this.hierarchy,
        });
    }

    async init() {
        this.initListeners();

        await profiles.getById(this.profileId);
        // This is kind of hacky, todo fixme
        profilesData.profile = profiles.profile;

        //this.event = await events.getByHierarchy(this.hierarchy?.toString(":"));

        this.addElements();

        await summarizer.ensure(this.hierarchy?.toString("-"));

        eventBus.fire("playback.ready", {
            hierarchy: this.hierarchy?.toString("-"),
        });

        this.resetTitle();
        this.loadSource();
    }

    async loadSource() {
        if (this.hierarchy) {
            if (this.hierarchy.type === "event") {
                const event = await events.getByHierarchy(this.hierarchy);
                eventBus.fire("reports.eventLoaded", { event });
            } else if (this.hierarchy.type === "file") {
                const file = await videoFiles.getByHierarchy(this.hierarchy);
                eventBus.fire("reports.fileLoaded", { file });
            }
        }
    }

    changeCamera(camera) {
        console.log("Camera change requested:", camera);

        this.currentCamera = camera;
        this.hierarchy.camera = camera;
        this.startTimeOffset = this.player.currentTime();
        console.log("Time offset set to:", this.startTimeOffset);
        this.playlistUrl = `/playlist/${this.hierarchy.toString("-")}-720p.m3u8`;
        activeBoxManager.reset();
        this.score.resetWindow();
        this.hls.loadSource(this.playlistUrl);
        this.player.play();

        eventBus.fire("playback.cameraChanged", {
            camera: camera,
            hierarchy: this.hierarchy.toString("-"),
        });
    }

    resetTitle() {
        document.title = "Vy - No Event Selected";
        document.getElementById("report-title").innerText = "No Event Selected";
    }
    setTitle(title) {
        document.title = `Vy - ${title}`;
        document.getElementById("report-title").innerText = title;
    }

    initListeners() {
        eventBus.addEventListener("ui.requestTimeSeek", (e) => {
            let seconds = e.detail.seconds;

            if (!seconds) {
                const requestedTime = e.detail.time;
                seconds = timeUtil.toSeconds(requestedTime);
            }

            this.player.currentTime(seconds);
        });

        eventBus.addEventListener("ui.requestEvent", (e) => {
            const hierarchy = e.detail;
            console.log("Event selected:", hierarchy);

            this.changeHierarchy(hierarchy);
        });

        eventBus.on("ui.requestEditMode", (e) => {
            const editContainer = document.getElementById("report-mode-edit");
            const viewContainer = document.getElementById("report-mode-view");
            editContainer.classList.remove("hidden");
            viewContainer.classList.add("hidden");
        });
        eventBus.on("ui.requestViewMode", (e) => {
            const editContainer = document.getElementById("report-mode-edit");
            const viewContainer = document.getElementById("report-mode-view");

            editContainer.classList.add("hidden");
            viewContainer.classList.remove("hidden");
        });

        eventBus.on("ui.annotations.ready", (e) => {
            this.activeNavTab.val = "Annotations";
        });

        eventBus.on("reports.eventLoaded", (e) => {
            const event = e.detail.event;
            const title = event ? events.getTitle(event) : "Event Not Found";
            document.title = `Vy - ${title}`;
            document.getElementById("report-title").innerText = title;
        });

        eventBus.on("reports.fileLoaded", (e) => {
            const file = e.detail.file;
            const title = file ? file.filename : "File Not Found";
            document.title = `Vy - ${title}`;
            document.getElementById("report-title").innerText = title;
        });
    }

    getHierarchyFromPath() {
        /**
         * Get the hierarchy from the URL path, if present.
         */
        const path = window.location.pathname;
        const parts = path.split("/");
        const hstr = parts.length > 4 ? parts.slice(2).join(":") : null; // returns the hierarchy if present, otherwise null

        return hstr ? new Hierarchy(hstr) : null;
    }

    getTimeOffsetFromHash() {
        if (window.location.hash) {
            const hash = window.location.hash.substring(1); // Remove the '#'
            const parts = hash.split(":");
            let result = 0;
            let multiplier = 1;

            for (let i = parts.length - 1; i >= 0; i--) {
                const value = parseInt(parts[i], 10);
                if (!isNaN(value)) {
                    result += value * multiplier;
                    multiplier *= 60;

                    if (multiplier > 3600) {
                        break; // Limit to 1 hour
                    }
                }
            }
            return result;
        }

        return 0;
    }

    getLeftColumnElements() {
        const { div } = van.tags;

        this.activeNavTab = van.state("Events");

        return div(
            {
                id: "report-left",
                class: "w-full md:w-auto md:flex-grow min-w-[250px] max-w-[350px]",
            },

            Tabs(
                {
                    tabButtonRowClass: "flex",
                    tabButtonRowStyleOverrides: { "background-color": "none" },
                    tabButtonClass:
                        "px-3 py-1.5 text-sm font-medium text-white rounded hover:bg-blue-600",
                    tabButtonStyleOverrides: {
                        "border-style": "none none none none",
                    },
                    tabButtonActiveColor: "rgb(59, 130, 246)",
                    tabButtonHoverColor: "rgb(29, 78, 216)",
                    tabContentClass: "mt-2",
                    activeTab: this.activeNavTab,
                },
                {
                    Events: events.createNavigationElement(
                        this.hierarchy?.toString(":")
                    ),
                    Videos: videoFiles.createNavigationElement(),
                    Annotations: annotationLog.createElement(),
                }
            )
        );
    }

    getCenterColumnElements() {
        const { div, main, video, canvas, button } = van.tags;

        // Video plus bottom metadata
        return div(
            {
                id: "report-center",
                class: "w-full max-w-4xl flex flex-col",
            },

            div({ id: "report-title" }, "No Event Selected"),

            // Video section
            div(
                { class: "relative w-full pt-[62.8125%] mt-4" },
                video({
                    id: "report-video",
                    class: "!absolute !top-0 !left-0 !w-full !h-auto !aspect-video video-js video-js-default-skin",
                    controls: true,
                    muted: true,
                }),

                // HEATMAP
                heatmap.createElement({
                    class: "absolute top-0 left-0 w-full h-auto aspect-video z-10",
                }),

                div({
                    id: "video-controls",
                    class: "absolute bottom-0 left-0 w-full h-[30px]",
                })
            ),
            div(
                {
                    id: "report-mode-view",
                    class: "text-sm text-gray-700",
                },

                div({
                    id: "report-box-debug",
                    class: "hidden text-sm text-gray-700 bg-white p-2 border",
                }),

                div({ class: "" }, summaryGraph.createElement()),

                div(
                    {
                        class: "w-full h-auto aspect-[calc(16/2.5)] mt-2",
                    },
                    div(
                        {
                            class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                        },

                        genderDemo.createElement({
                            id: "report-viz-demo-gender ",
                        })
                    ),

                    div(
                        {
                            class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                        },

                        ageDemo.createElement({
                            id: "report-viz-demo-age",
                        })
                    )
                )
            )

            /*
            div(
                {
                    class: "text-sm text-gray-700",
                },


                button(
                    {
                        type: "button",
                        class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 ml-4",
                        onclick: () => {
                            eventBus.fire("ui.requestExport");
                        },
                    },
                    "Export as CSV"
                )
            )
            */
        );
    }

    getRightColumnElements() {
        const { div, main, video, canvas, button } = van.tags;

        return div(
            {
                id: "report-right",
                class: "w-full md:w-auto md:flex-grow min-w-[250px] max-w-[350px]",
            },

            // Camera map section
            div(
                {
                    class: "w-full h-auto aspect-[2] relative bg-white",
                },

                // CAMERA MAP
                cameramap.createElement()
            ),
            // EKG section
            div(
                {
                    class: "w-full h-auto aspect-[2] mt-4 relative",
                },

                ekg.createElement()
            ),

            // Spider chart section
            div(
                {
                    class: "w-full h-auto aspect-square mt-4 relative bg-white",
                },

                spider.createElement()
            ),

            // Linked player
            div(
                {
                    id: "report-embed",
                    class: "w-full h-auto aspect-video mt-4 relative",
                },
                linkedPlayer.createElement()
            )
        );
    }

    addElements(parentElement) {
        const { div, main } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-full p-4 overflow-auto" },
                div(
                    {
                        id: "report-container",
                        class: "flex flex-col md:flex-row gap-4 items-start",
                    },

                    this.getLeftColumnElements(),

                    this.getCenterColumnElements(),

                    this.getRightColumnElements()
                )
            )
        );

        this.addPlayer();
        this.addHeatmapListeners();
        this.addCameraMapListeners();

        // TODO Move to event (DOM needs to be added before initializing YT)
        linkedPlayer.init();
    }

    addPlayer() {
        this.player = videojs("report-video");
        this.player.ready(() => {
            this.video = this.player.tech_.el_;

            this.hls = new Hls();
            this.hls.attachMedia(this.player.tech_.el_);

            if (this.playlistUrl) this.hls.loadSource(this.playlistUrl);

            this.hls.on(Hls.Events.LEVEL_LOADED, async (event, data) => {
                const fragments = data.details.fragments;
                this.fragments = fragments;

                this.wallclockStartTimeUTC = fragments[0].programDateTime;

                await this.score.initLoadSchedule(fragments);

                eventBus.fire("playback.loaded", {
                    duration: data.details.totalduration,
                    fragments: fragments,
                    wallclockStartTimeUTC: this.wallclockStartTimeUTC,
                });
            });

            // Correct Video.js event for when video starts playing
            this.player.on("play", () => {
                console.log("Video started playing");
                eventBus.fire("playback.play");

                if (this.startTimeOffset > 0) {
                    window.setTimeout(() => {
                        this.player.currentTime(this.startTimeOffset);
                        this.startTimeOffset = 0; // Reset after applying
                    }, 10);
                }
            });

            // Optional: Hide overlay when video is paused
            this.player.on("pause", () => {
                console.log("Video paused");
                eventBus.fire("playback.pause");
            });

            // Video.js time events
            this.player.on("timeupdate", async () => {
                if (this.isSeeking) return;

                const detail = {
                    currentTime: this.player.currentTime(),
                    duration: this.player.duration(),
                };

                eventBus.fire("playback.timeupdate", detail);

                await this.score.handleTimeUpdate(detail.currentTime);

                this.player.userActive(true); // Ensure active state
                this.player.controlBar.show(); // Force control bar to show
            });

            // Alternative: seeked event (when user seeks to a new position)
            this.player.on("seeked", async () => {
                this.isSeeking = false;
                const currentTime = this.player.currentTime();
                console.log("Seeked to time:", currentTime);
                await this.score.handleTimeSeek(currentTime);
                eventBus.fire("playback.timeseek", {
                    currentTime: currentTime,
                });
            });

            // Alternative: seeking event (while user is seeking)
            this.player.on("seeking", () => {
                this.isSeeking = true;
                const currentTime = this.player.currentTime();
                console.log("Seeking to time:", currentTime);
            });

            this.player.userActive(true); // Ensure active state
            this.player.controlBar.show(); // Force control bar to show
        });
    }

    // updateTranscript() {
    //     const currentTime = this.player.currentTime();
    //     if (!this.transcript || !this.transcript.length) return;

    //     if (
    //         this.transcript &&
    //         this.transcript[this.tsIndex].time > currentTime
    //     ) {
    //         this.tsIndex = 0;
    //     }

    //     while (
    //         this.transcript &&
    //         this.tsIndex < this.transcript.length - 1 &&
    //         this.transcript[this.tsIndex].time <= currentTime
    //     ) {
    //         this.tsIndex += 1;
    //     }

    //     if (
    //         this.transcript &&
    //         this.transcript[this.tsIndex] &&
    //         this.tsIndex > 0
    //     ) {
    //         const ts = this.transcript[this.tsIndex - 1];
    //         document.getElementById("report-current-play").innerText =
    //             "⚾️ " + timeUtil.format(ts.time, true) + " - " + ts.msg;
    //     }
    // }

    addHeatmapListeners() {
        eventBus.addEventListener("heatmap.click", (e) => {
            if (this.player.paused()) {
                this.player.play();
            } else {
                this.player.pause();
            }
        });

        eventBus.addEventListener("heatmap.mousemove", (e) => {
            const box = this.score.boxAt(e.detail.x, e.detail.y);

            if (box) {
                // Highlight the box or perform any action
                this.showBoxDebug(box);
            } else {
                this.hideBoxDebug();
            }
        });
    }

    addCameraMapListeners() {
        eventBus.addEventListener("ui.requestCamera", (e) => {
            this.changeCamera(e.detail.camera);
        });
    }

    showBoxDebug(box) {
        const debugDiv = document.getElementById("report-box-debug");
        debugDiv.classList.remove("hidden");

        const profile = profiles.profile.emotions;

        let html =
            '<table class="w-full"><tr><th>Emotion</th><th>Core</th><th>Confidence</th><th>Profile</th><th>Score</th></tr>';

        for (const emotion of box.row.emotions) {
            const score = emotion.score || 0;

            if (!emotion.coreName) continue;

            html +=
                `<tr><td>${emotion.name}</td>` +
                `<td>${emotion.coreName}</td>` +
                `<td>${emotion.confidence.toFixed(4)}</td>` +
                `<td>${profile[emotion.name]}</td>` +
                `<td>${score.toFixed(0)}</td></tr>`;
        }
        html +=
            `<tr><td colspan="4">t=${box.row.time.toFixed(4)}s</td>` +
            `<td><b>${box.row.score.toFixed(0)}</b></td></tr>`;
        html += "</table>";

        html += `<table class="w-full mt-2"><tr><th>Core</th><th>Score</th></tr>`;
        for (let coreName in box.row.cores) {
            const coreScore = box.row.cores[coreName].score.toFixed(0);
            html += `<tr><td>${coreName}</td><td>${coreScore}</td></tr>`;
        }
        html += "</table>";

        debugDiv.innerHTML = html;
    }

    hideBoxDebug() {
        const debugDiv = document.getElementById("report-box-debug");
        debugDiv.classList.add("hidden");
    }
}

const reports = new Reports();

if (typeof window !== "undefined") {
    window._vy_reports = reports;
}

export { Reports, reports };
