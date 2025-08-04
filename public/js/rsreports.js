import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.5.min.js";
import Score from "./vyscore.js";
import Viz from "./vyviz.js";

class Reports {
    constructor() {
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.score = new Score();
        this.viz = new Viz();
    }

    async init() {
        await this.score.loadProfile(this.profileId);
        this.addElements();
    }

    getIdFromPath() {
        /**
         * Get the ID from the URL path, if present.
         */
        const path = window.location.pathname;
        const parts = path.split("/");
        return parts.length > 2 ? parts[2] : null; // returns the ID if present, otherwise null
    }

    addElements(parentElement) {
        const { div, p, main, video, canvas } = van.tags;
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

                    /*
                    // Left column
                    div(
                        {
                            id: "report-left",
                            class: "w-full md:w-auto md:flex-grow min-w-[75px] max-w-[150px]",
                        },
                        p(
                            {
                                class: "text-sm text-gray-600",
                                style: "background-color: red",
                            },
                            "Left column"
                        )
                    ),
                    */

                    // Video plus bottom metadata
                    div(
                        {
                            id: "report-center",
                            class: "w-full max-w-4xl flex flex-col",
                        },
                        div(
                            { class: "relative w-full pt-[62.8125%]" },
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
                                class: "mt-2 text-sm text-gray-700",
                                style: "background-color: green",
                            },
                            p("Bottom metadata goes here")
                        )
                    ),

                    // Right column
                    div(
                        {
                            id: "report-right",
                            class: "w-full md:w-auto md:flex-grow min-w-[300px] max-w-[500px]",
                        },

                        // EKG section
                        div(
                            { class: "w-full h-auto aspect-video" },
                            canvas({
                                id: "report-ekg",
                                class: "w-full h-full",
                                width: 500,
                                height: 281,
                            })
                        ),

                        // Spider chart section
                        div(
                            {
                                class: "w-full h-auto aspect-square, mt-4 bg-white",
                            },
                            canvas({
                                id: "report-spider",
                                class: "w-full h-full",
                                width: 500,
                                height: 500,
                            })
                        )
                    )
                )
            )
        );

        this.addPlayer();
        this.addOverlay();
        this.addEkg();
        this.addSpider();
    }

    addPlayer() {
        var hierarchy = "raimondi-20250712-01";
        this.playlistUrl = `/playlist/${hierarchy}-720p.m3u8`;

        this.player = videojs("report-video");
        this.player.ready(() => {
            this.video = this.player.tech_.el_;

            this.hls = new Hls();
            this.hls.attachMedia(this.player.tech_.el_);
            this.hls.loadSource(this.playlistUrl);

            this.hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
                this.score.handleFragChanged(
                    data.frag.url,
                    data.frag.initSegment.url,
                    data.frag.playlistOffset
                );
            });
            this.hls.on(Hls.Events.LEVEL_LOADED, async (event, data) => {
                const fragments = data.details.fragments;

                // var loaded = await this.score.loadPersistedData(
                //     `scores-${hierarchy}`
                // );
                // //loaded = false;
                // if (!loaded) {
                //     await this.score.loadExpressionsFromFragments(fragments);
                //     await this.score.persistData(`scores-${hierarchy}`);
                //     this.score.checkForGaps();
                // }
            });

            // Correct Video.js event for when video starts playing
            this.player.on("play", () => {
                console.log("Video started playing");
                this.viz.play();
            });

            // Optional: Hide overlay when video is paused
            this.player.on("pause", () => {
                console.log("Video paused");
                this.viz.pause();
            });

            // Video.js time events
            this.player.on("timeupdate", () => {
                const currentTime = this.player.currentTime();

                this.score.handleTimeUpdate(currentTime);
                this.viz.paintHeatmap(this.overlay, this.score.activeBoxes);
                this.viz.paintEkg(this.score.currentScore);
                this.viz.paintSpider(this.score.currentCores);

                this.player.userActive(true); // Ensure active state
                this.player.controlBar.show(); // Force control bar to show

                console.log(
                    `Current time: ${currentTime} score: ${this.score.currentScore} cores: ${this.score.currentCores}`
                );
            });

            // Alternative: seeked event (when user seeks to a new position)
            this.player.on("seeked", () => {
                const currentTime = this.player.currentTime();
                console.log("Seeked to time:", currentTime);
                this.score.handleTimeSeek(currentTime);
                this.viz.reset();
            });

            // Alternative: seeking event (while user is seeking)
            this.player.on("seeking", () => {
                const currentTime = this.player.currentTime();
                console.log("Seeking to time:", currentTime);
            });

            this.player.userActive(true); // Ensure active state
            this.player.controlBar.show(); // Force control bar to show
        });
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
    }

    addEkg() {
        var ekg = document.getElementById("report-ekg");
        this.viz.initEkg(ekg);
    }

    addSpider() {
        var spider = document.getElementById("report-spider");
        this.viz.initSpider(spider);
    }
}

const reports = new Reports();
window.reports = reports;
export { Reports, reports };
