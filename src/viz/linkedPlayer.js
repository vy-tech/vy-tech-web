import van from "vanjs-core";

import { events } from "../data/events.js";
import { eventBus } from "../eventbus.js";

class LinkedPlayer {
    constructor() {
        this.container = null;

        eventBus.addEventListener("viz.play", () => {
            if (this.embedPlayer) {
                console.log(this.embedPlayer);
                this.embedPlayer.playVideo();
            }
        });

        eventBus.addEventListener("viz.pause", () => {
            if (this.embedPlayer) {
                this.embedPlayer.pauseVideo();
            }
        });

        eventBus.addEventListener("viz.paint", (e) => {
            this.sync(e.detail.currentTime);
        });
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = { ...options };

        this.container = div(merged);

        return this.container;
    }

    init() {
        const event = events.get();
        const embedVideo = event.embed;

        if (!embedVideo) {
            console.error("No embed available");
            return;
        }

        this.embedVideoId = embedVideo.id;
        this.embedOffset = embedVideo.offset;

        const videoId = this.embedVideoId;
        const origin = window.location.origin;
        this.container.innerHTML =
            '<iframe id="report-embed-player" width="500" height="281" ' +
            'class="w-full h-auto aspect-video" ' +
            `src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${origin}"` +
            ' title="YouTube video player" frameborder="0" allow="web-share"' +
            ' referrerpolicy="strict-origin-when-cross-origin" ' +
            "allowfullscreen></iframe>";
        this.embedPlayer = new YT.Player("report-embed-player");
    }

    sync(currentTime) {
        if (this.embedPlayer) {
            let embedTime = this.embedPlayer.getCurrentTime();
            let embedState = this.embedPlayer.getPlayerState();
            let duration = this.embedPlayer.getDuration();
            let targetTime = currentTime + this.embedOffset;

            if (targetTime < 0 || targetTime > duration) {
                if (embedState == 1) {
                    console.log(
                        `Target time is ${targetTime}, pausing embed..`
                    );
                    this.embedPlayer.pauseVideo();
                    this.embedPlayer.mute();
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
                if (this.embedPlayer.isMuted()) {
                    this.embedPlayer.unMute();
                }
            }
        }
    }
}

const linkedPlayer = new LinkedPlayer();
export default linkedPlayer;
export { linkedPlayer, LinkedPlayer };
