import van from "vanjs-core";
import { events } from "./rsevents.js";
import { CoreNames, EmotionCoreMap, Score } from "./vyscore.js";
import Viz from "./vyviz.js";

class Reports {
    constructor() {
        this.hierarchy = this.getHierarchyFromPath() || "raimondi-20250711-01";
        this.currentCamera = 1;
        this.startTimeOffset = this.getTimeOffsetFromHash() || 0;
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;

        this.score = new Score();
        this.viz = new Viz();

        this.transcript = [];
        this.tsIndex = 0;

        this.embedVideos = {
            20250711: { id: "AadogpCu63M", offset: -1 * 25 * 60 - 1 },
            20250712: { id: "2xYgquM67sk", offset: -1 * 26 * 60 + 2 },
        };
        this.embedPlayer = null;
        this.embedVideoId = null;
        this.embedOffset = null;

        events.addEventListener("cameraChangeRequest", (e) => {
            const camera = e.detail.camera;
            console.log("Camera change requested:", camera);

            this.currentCamera = camera;
            let newHierarchy = this.hierarchy.split("-").slice(0, 2).join("-");
            newHierarchy += `-${camera.toString().padStart(2, "0")}`;
            this.hierarchy = newHierarchy;
            this.startTimeOffset = this.player.currentTime();
            console.log("Time offset set to:", this.startTimeOffset);
            this.playlistUrl = `/playlist/${this.hierarchy}-720p.m3u8`;
            this.score.resetActiveBoxes();
            this.score.resetWindow();
            this.hls.loadSource(this.playlistUrl);
            this.player.play();
        });

        events.addEventListener("playerSeekRequest", (e) => {
            const time = e.detail.time;

            const seconds = this.timeToSeconds(time);
            this.player.currentTime(seconds);
        });
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
                    offset = this.timeToSeconds(line.substr(1), true);
                    if (line[0] == "-") offset = -offset;
                }

                while (lines.length) {
                    let time = lines.shift();
                    let msg = lines.shift();
                    time = this.timeToSeconds(time, true) + offset;
                    result.push({ time: time, msg: msg });
                }

                return result;
            }
        } catch (e) {
            console.log(`While fetching transcript: ${e}`);
        }

        return [];
    }

    timeToSeconds(time, isMMSS = false) {
        let parts = time.split(":");
        let seconds = 0;
        let i = 0;

        if (parts.length == 1) {
            return parseFloat(parts);
        } else if (parts.length == 2 && !isMMSS) {
            i = 1;
        } else if (parts.length > 3) {
            throw new Error(`Invalid time ${time}`);
        }

        while (parts.length) {
            let part = parts.pop();
            seconds += parseInt(part) * 60 ** i;
            i += 1;
        }

        //console.log(`${time} => ${seconds}`);
        return seconds;
    }

    async init() {
        await this.score.loadProfile(this.profileId);

        this.addElements();

        await this.score.ensureSummaries(this.hierarchy);
        this.score.findMoments();

        this.addMoments();

        this.transcript = await this.loadTranscript();
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
        const { div, span, a, main, video, canvas, select, option } = van.tags;
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

                        div(
                            {
                                id: "report-moment-1",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(1);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-2",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(2);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-3",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(3);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-4",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(4);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-5",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(5);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-6",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(6);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-7",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(7);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-8",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(8);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-9",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(9);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        ),

                        div(
                            {
                                id: "report-moment-10",
                                class: "mb-2 w-full h-auto aspect-square relative text-black bg-white text-center flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors",
                                onclick: () => {
                                    this.seekMoment(10);
                                },
                            },
                            div({ class: "text-2xl mb-1" }, "▶"),
                            div({ class: "text-sm" }, "0")
                        )
                    ),

                    // Video plus bottom metadata
                    div(
                        {
                            id: "report-center",
                            class: "w-full max-w-4xl flex flex-col",
                        },
                        div(
                            {},
                            select(
                                {
                                    id: "report-event-select",
                                    class: "w-full text-black p-1",
                                    onchange: (e) => {
                                        let path = e.target.value.replaceAll(
                                            "-",
                                            "/"
                                        );
                                        window.location.href = `/reports/${path}`;
                                    },
                                },
                                option(
                                    { value: "raimondi-20250711-01" },
                                    "Fri Jul 11 - Oakland Ballers vs. Rocky Mountain Vibes"
                                ),
                                option(
                                    { value: "raimondi-20250712-01" },
                                    "Sat Jul 12 - Oakland Ballers vs. Rocky Mountain Vibes"
                                )
                            )
                        ),
                        div(
                            { class: "relative w-full pt-[62.8125%] mt-4" },
                            video({
                                id: "report-video",
                                class: "absolute top-0 left-0 w-full h-auto aspect-video video-js video-js-default-skin",

                                controls: true,
                                muted: true,
                            }),
                            canvas({
                                id: "report-overlay",
                                class: "absolute top-0 left-0 w-full h-auto aspect-video z-10",
                                width: 1280,
                                height: 720,
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
                            // div(
                            //     { class: "" },
                            //     canvas({
                            //         id: "report-pct",
                            //         class: "w-full h-auto aspect-[calc(16/4.5)] mt-2",
                            //         width: 1280,
                            //         height: 360,
                            //     })
                            // )

                            div(
                                { class: "" },
                                canvas({
                                    id: "report-ppl",
                                    class: "w-full h-auto aspect-[calc(16/4.5)] mt-2",
                                    width: 1280,
                                    height: 360,
                                })
                            ),

                            div(
                                {
                                    class: "w-full h-auto aspect-[calc(16/2.5)] mt-2",
                                },
                                div(
                                    {
                                        class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                                    },
                                    canvas({
                                        id: "report-demo-gender",
                                        width: 448,
                                        height: 126,
                                    })
                                ),

                                div(
                                    {
                                        class: "w-[50%] h-auto aspect-[calc(8/2.5)] inline-block",
                                    },

                                    canvas({
                                        id: "report-demo-age",
                                        width: 448,
                                        height: 126,
                                    })
                                )
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
                            canvas({
                                id: "report-camera-map",
                                class: "w-full h-full",
                                width: 500,
                                height: 250,
                            })
                        ),
                        // EKG section
                        div(
                            {
                                class: "w-full h-auto aspect-[2] mt-4 relative",
                            },
                            canvas({
                                id: "report-ekg",
                                class: "w-full h-full",
                                width: 500,
                                height: 250,
                            }),
                            div(
                                {
                                    id: "report-ekg-score",
                                    class: "absolute top-0 left-0 p-1 text-xl text-black",
                                },
                                "0"
                            )
                        ),

                        // Spider chart section
                        div(
                            {
                                class: "w-full h-auto aspect-square mt-4 relative bg-white",
                            },
                            canvas({
                                id: "report-spider",
                                class: "w-full h-full",
                                width: 500,
                                height: 500,
                            })
                        ),

                        div({
                            id: "report-embed",
                            class: "w-full h-auto aspect-video mt-4 relative",
                        })
                    )
                )
            )
        );

        console.log(this.hierarchy);
        document.getElementById("report-event-select").value = this.hierarchy;
        this.addPlayer();
        this.addOverlay();
        this.addCameraMap();
        this.addEkg();
        this.addSpider();
        this.addPpl();
        //this.addPct();
        //this.addMoments();
        this.addDemos();
        this.addEmbed();
    }

    addMoments() {
        let i = 1;
        for (const moment of this.score.moments) {
            const momentDiv = document.getElementById(`report-moment-${i}`);
            momentDiv.querySelector(
                "div.text-sm"
            ).textContent = `${moment.label}`;
            i += 1;
        }
    }

    seekMoment(number) {
        const moment = this.score.moments[number - 1];
        if (moment) {
            this.player.currentTime(moment.startTime - 15);
        }
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
                this.viz.play();
                if (this.startTimeOffset > 0) {
                    window.setTimeout(() => {
                        this.player.currentTime(this.startTimeOffset);
                        this.startTimeOffset = 0; // Reset after applying
                    }, 10);
                }

                if (this.embedPlayer) {
                    this.embedPlayer.playVideo();
                }
            });

            // Optional: Hide overlay when video is paused
            this.player.on("pause", () => {
                console.log("Video paused");
                this.viz.pause();

                if (this.embedPlayer) {
                    this.embedPlayer.pauseVideo();
                }
            });

            // Video.js time events
            this.player.on("timeupdate", async () => {
                if (this.isSeeking) return;

                const currentTime = this.player.currentTime();

                await this.score.handleTimeUpdate(currentTime);
                this.viz.paintCameraMap(
                    this.score.summaries,
                    Math.floor(currentTime)
                );
                this.viz.paintActiveHeatmap(
                    this.overlay,
                    this.score.activeBoxes
                );
                // this.viz.paintHeatmap(
                //     this.overlay,
                //     this.score.window,
                //     this.score.windowStartIndex,
                //     this.score.windowEndIndex,
                //     this.score.windowSize
                // );
                this.viz.paintEkg(this.score.currentScore);
                this.viz.paintSpider(this.score.currentCores);
                this.viz.paintPpl(this.score.summaries[this.currentCamera - 1]);
                //this.viz.paintPct(this.score.percentiles);

                this.updateTranscript();
                this.player.userActive(true); // Ensure active state
                this.player.controlBar.show(); // Force control bar to show

                // console.log(
                //     `Current time: ${currentTime} score: ${this.score.currentScore} cores: ${this.score.currentCores}`
                // );

                this.syncEmbed(currentTime);
            });

            // Alternative: seeked event (when user seeks to a new position)
            this.player.on("seeked", async () => {
                this.isSeeking = false;
                const currentTime = this.player.currentTime();
                console.log("Seeked to time:", currentTime);
                await this.score.handleTimeSeek(currentTime);
                this.viz.reset();
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
                "⚾️ " + this.score.formatTime(ts.time, true) + " - " + ts.msg;
        }
    }
    addOverlay() {
        this.overlay = document.getElementById("report-overlay");

        this.overlay.addEventListener("click", (e) => {
            if (this.player.paused()) {
                this.player.play();
            } else {
                this.player.pause();
            }
        });

        this.overlay.addEventListener("mousemove", (event) => {
            const rect = this.overlay.getBoundingClientRect();
            // Calculate the mouse position relative to the canvas
            // and scale it to the original video resolution (3840x2160)
            const x = Math.floor(
                ((event.clientX - rect.left) / rect.width) * 3840
            );
            const y = Math.floor(
                ((event.clientY - rect.top) / rect.height) * 2160
            );

            const box = this.score.boxAt(x, y);

            if (box) {
                // Highlight the box or perform any action
                this.showBoxDebug(box);
            } else {
                this.hideBoxDebug();
            }
        });
    }

    addCameraMap() {
        this.cameraMap = document.getElementById("report-camera-map");
        this.viz.initCameraMap(this.cameraMap);
    }

    addEkg() {
        var ekg = document.getElementById("report-ekg");
        var label = document.getElementById("report-ekg-score");
        this.viz.initEkg(ekg, label);
    }

    addSpider() {
        var spider = document.getElementById("report-spider");
        this.viz.initSpider(spider);
    }

    //addPct() {
    //    var pct = document.getElementById("report-pct");
    //    this.viz.initPct(pct);
    //}

    addPpl() {
        var ppl = document.getElementById("report-ppl");
        this.viz.initPpl(ppl);
    }

    addDemos() {
        var gender = document.getElementById("report-demo-gender");
        this.viz.initDemo(gender, "Gender", ["male", "female"], [60, 40]);

        var age = document.getElementById("report-demo-age");
        this.viz.initDemo(age, "Age", ["adult", "child"], [80, 20]);
    }

    addEmbed() {
        const [token, date, camera] = this.hierarchy.split("-");
        const embedVideo = this.embedVideos[date];

        if (!embedVideo) {
            console.error(`No embed found for ${date}`);
            return;
        }

        this.embedVideoId = embedVideo.id;
        this.embedOffset = embedVideo.offset;

        const videoId = this.embedVideoId;
        document.getElementById("report-embed").innerHTML =
            '<iframe id="report-embed-player" width="500" height="281" ' +
            `src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=https://dev.roarscore.ai"` +
            ' title="YouTube video player" frameborder="0" allow="accelerometer; ' +
            "autoplay; clipboard-write; encrypted-media; gyroscope; " +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            "allowfullscreen></iframe>";
        this.embedPlayer = new YT.Player("report-embed-player");
    }

    syncEmbed(currentTime) {
        if (this.embedPlayer) {
            let embedTime = this.embedPlayer.getCurrentTime();
            let embedState = this.embedPlayer.getPlayerState();
            let targetTime = currentTime + this.embedOffset;

            if (targetTime < 0) {
                if (embedState == 1) {
                    console.log(
                        `Target time is ${targetTime}, pausing embed..`
                    );
                    this.embedPlayer.pauseVideo();
                }
            } else {
                if (Math.abs(targetTime - embedTime) > 1) {
                    console.log(`Seeking embed to ${targetTime}..`);
                    this.embedPlayer.seekTo(targetTime, true);
                }
                if (embedState != 1) {
                    console.log(`Playing embedded video..`);
                    this.embedPlayer.playVideo();
                }
            }
        }
    }

    showBoxDebug(box) {
        const debugDiv = document.getElementById("report-box-debug");
        debugDiv.classList.remove("hidden");

        const profile = this.score.profile.emotions;

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
