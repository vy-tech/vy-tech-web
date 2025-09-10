import van from "vanjs-core";

import { eventBus } from "./eventbus.js";
import { scoring } from "./scoring/scoring.js";
import { events } from "./data/events.js";
import { summarizer } from "./scoring/summarizer.js";
import { profiler } from "./scoring/profiler.js";
import { activeBoxManager } from "./scoring/activeBoxManager.js";
import { timeUtil } from "./util/time.js";

import { heatmap } from "./viz/heatmap.js";
import { cameramap } from "./viz/cameramap.js";
import { ekg } from "./viz/ekg.js";
import { spider } from "./viz/spider.js";
import { people } from "./viz/people.js";
import { genderDemo, ageDemo } from "./viz/demographics.js";
import { momentlist } from "./viz/momentlist.js";
import { linkedPlayer } from "./viz/linkedPlayer.js";

class Reports {
    constructor() {
        this.hierarchy = this.getHierarchyFromPath() || "raimondi-20250711-01";
        this.currentCamera = 1;
        this.startTimeOffset = this.getTimeOffsetFromHash() || 0;
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;

        this.score = scoring;

        this.transcript = [];
        this.tsIndex = 0;

        this.event = null;
    }

    async loadTranscript() {
        const [token, date] = this.hierarchy.split("-");

        const url = `https://storage.roarscore.ai/production/play/${token}/${date}/transcript-${token}-${date}.txt`;

        try {
            let response = await fetch(url);

            if (response.ok) {
                let lines = await response.text();
                lines = lines.split(/\s*[\r\n]+\s*/);

                let offset = 0;
                let result = [];
                if (/^[\+\-]/.test(lines[0])) {
                    let line = lines.shift();
                    offset = timeUtil.toSeconds(line.substr(1), true);
                    if (line[0] == "-") offset = -offset;
                }

                while (lines.length) {
                    let t = lines.shift();
                    let msg = lines.shift();
                    t = timeUtil.toSeconds(t, true) + offset;
                    result.push({ time: t, msg: msg });
                }

                return result;
            }
        } catch (e) {
            console.log(`While fetching transcript: ${e}`);
        }

        return [];
    }

    async init() {
        this.initListeners();

        await profiler.loadFromFirestore(this.profileId);

        this.event = await events.loadFromFirestore(
            this.hierarchy.replaceAll("-", ":")
        );

        this.addElements();

        await summarizer.ensure(this.hierarchy);

        //momentlist.update();

        this.transcript = await this.loadTranscript();
    }

    changeCamera(camera) {
        console.log("Camera change requested:", camera);

        this.currentCamera = camera;
        let newHierarchy = this.hierarchy.split("-").slice(0, 2).join("-");
        newHierarchy += `-${camera.toString().padStart(2, "0")}`;
        this.hierarchy = newHierarchy;
        this.startTimeOffset = this.player.currentTime();
        console.log("Time offset set to:", this.startTimeOffset);
        this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;
        activeBoxManager.reset();
        this.score.resetWindow();
        this.hls.loadSource(this.playlistUrl);
        this.player.play();

        eventBus.fire("viz.cameraChanged", { camera: camera });
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

            const pathname = `/reports/${hierarchy.replaceAll(":", "/")}`;
            window.location.pathname = pathname;
        });
    }

    getHierarchyFromPath() {
        /**
         * Get the hierarchy from the URL path, if present.
         */
        const path = window.location.pathname;
        const parts = path.split("/");
        return parts.length > 4 ? parts.slice(2, 5).join("-") : null; // returns the hierarchy if present, otherwise null
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

    addElements(parentElement) {
        const { div, main, video, canvas, button } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                div(
                    {
                        id: "report-container",
                        class: "flex flex-col md:flex-row gap-4 items-start",
                    },

                    // Left column
                    div(
                        {
                            id: "report-left",
                            class: "w-full md:w-auto md:flex-grow min-w-[50px] max-w-[60px]",
                        },

                        momentlist.createElement()
                    ),

                    // Video plus bottom metadata
                    div(
                        {
                            id: "report-center",
                            class: "w-full max-w-4xl flex flex-col",
                        },

                        // Event selector
                        events.createSelectorElement(
                            this.hierarchy.replaceAll("-", ":")
                        ),

                        // Video section
                        div(
                            { class: "relative w-full pt-[62.8125%] mt-4" },
                            video({
                                id: "report-video",
                                class: "absolute top-0 left-0 w-full h-auto aspect-video video-js video-js-default-skin",

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
                                class: "text-sm text-gray-700",
                            },
                            div(
                                {
                                    id: "report-current-play",
                                    class: "text-sm text-gray-700 bg-white border mt-[-15px] p-2",
                                },
                                "⚾️ [No Transcript Available]"
                            ),

                            div({
                                id: "report-box-debug",
                                class: "hidden text-sm text-gray-700 bg-white p-2 border",
                            }),

                            div({ class: "" }, people.createElement()),

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
                        ),

                        div(
                            {
                                class: "text-sm text-gray-700",
                            },
                            button(
                                {
                                    type: "button",
                                    class: "mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600",
                                    onclick: () => {
                                        eventBus.fire(
                                            "ui.requestSummaryRebuild",
                                            {
                                                hierarchy: this.hierarchy,
                                            }
                                        );
                                    },
                                },
                                "Rebuild Summary"
                            )
                        )
                    ),

                    // Right column
                    div(
                        {
                            id: "report-right",
                            class: "w-full md:w-auto md:flex-grow min-w-[300px] max-w-[500px]",
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
                    )
                )
            )
        );

        console.log(this.hierarchy);
        document.getElementById("report-event-select").value = this.hierarchy;
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
            this.hls.loadSource(this.playlistUrl);

            this.hls.on(Hls.Events.LEVEL_LOADED, async (event, data) => {
                const fragments = data.details.fragments;
                this.fragments = fragments;

                await this.score.initLoadSchedule(fragments);
            });

            // Correct Video.js event for when video starts playing
            this.player.on("play", () => {
                console.log("Video started playing");
                eventBus.fire("viz.play");

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
                eventBus.fire("viz.pause");
            });

            // Video.js time events
            this.player.on("timeupdate", async () => {
                if (this.isSeeking) return;

                const currentTime = this.player.currentTime();

                eventBus.fire("viz.paint", { currentTime: currentTime });

                await this.score.handleTimeUpdate(currentTime);

                this.updateTranscript();
                this.player.userActive(true); // Ensure active state
                this.player.controlBar.show(); // Force control bar to show

                // console.log(
                //     `Current time: ${currentTime} score: ${this.score.currentScore} cores: ${this.score.currentCores}`
                // );
            });

            // Alternative: seeked event (when user seeks to a new position)
            this.player.on("seeked", async () => {
                this.isSeeking = false;
                const currentTime = this.player.currentTime();
                console.log("Seeked to time:", currentTime);
                await this.score.handleTimeSeek(currentTime);
                eventBus.fire("viz.timeSeek", { currentTime: currentTime });
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

    updateTranscript() {
        const currentTime = this.player.currentTime();
        if (!this.transcript || !this.transcript.length) return;

        if (
            this.transcript &&
            this.transcript[this.tsIndex].time > currentTime
        ) {
            this.tsIndex = 0;
        }

        while (
            this.transcript &&
            this.tsIndex < this.transcript.length - 1 &&
            this.transcript[this.tsIndex].time <= currentTime
        ) {
            this.tsIndex += 1;
        }

        if (
            this.transcript &&
            this.transcript[this.tsIndex] &&
            this.tsIndex > 0
        ) {
            const ts = this.transcript[this.tsIndex - 1];
            document.getElementById("report-current-play").innerText =
                "⚾️ " + timeUtil.format(ts.time, true) + " - " + ts.msg;
        }
    }

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

        const profile = profiler.profile.emotions;

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
window.reports = reports;
export { Reports, reports };
