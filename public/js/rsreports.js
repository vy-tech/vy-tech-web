import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.5.min.js";
import Score from "./vyscore.js";

class Reports {
  constructor() {}

  async init() {
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
      parentElement || document.getElementById("container") || document.body;

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
              class:
                "w-full md:w-auto md:flex-grow min-w-[200px] max-w-[400px]",
            },
            p(
              {
                class: "text-sm text-gray-600",
                style: "background-color: red",
              },
              "Left column"
            )
          ),

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
                class:
                  "absolute top-0 left-0 w-full h-[calc(100%-30px)] video-js video-js-default-skin",
                controls: true,
                muted: true,
              }),
              canvas({
                id: "report-overlay",
                class:
                  "absolute top-0 left-0 w-full h-[calc(100%-30px)] z-10 hidden",
                width: 1280,
                height: 720,
                style: "background-color: red"
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
              class:
                "w-full md:w-auto md:flex-grow min-w-[200px] max-w-[400px]",
            },
            p(
              {
                class: "text-sm text-gray-600",
                style: "background-color: yellow",
              },
              "Right column"
            )
          )
        )
      )
    );

    var profileId = "UZfcCHb6YvFOijlhRdKk";
    var hierarchy = "raimondi-20250713-01"
    this.playlistUrl = `/playlist/${hierarchy}-720p.m3u8`;
    
    this.player = videojs("report-video");
    this.player.ready(() => {
    
      this.score = new Score();
      this.score.loadProfile(profileId);
      this.hls = new Hls();
      this.hls.attachMedia(this.player.tech_.el_);
      this.hls.loadSource(this.playlistUrl);
      this.hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
        console.log("HLS Fragment changed:", data.frag.url);
      });
      this.hls.on(Hls.Events.LEVEL_LOADED, async (event, data) => {
        const fragments = data.details.fragments;

        var loaded = await this.score.loadPersistedData(`scores-${hierarchy}`);
        
        if (!loaded) {
          await this.score.loadExpressionsFromFragments(fragments);
          await this.score.persistData(`scores-${hierarchy}`);
        }
      });
      
      // Video.js time events
      this.player.on('timeupdate', () => {
        const currentTime = this.player.currentTime();
        console.log('Current time:', currentTime);
        // Your logic here
      });

      // Alternative: seeked event (when user seeks to a new position)
      this.player.on('seeked', () => {
        const currentTime = this.player.currentTime();
        console.log('Seeked to time:', currentTime);
      });

      // Alternative: seeking event (while user is seeking)
      this.player.on('seeking', () => {
        const currentTime = this.player.currentTime();
        console.log('Seeking to time:', currentTime);
      });

      this.player.userActive(true); // Ensure active state
      this.player.controlBar.show(); // Force control bar to show
      

    });

    window.player = this.player;
  }

}

const reports = new Reports();
window.reports = reports;
export { Reports, reports };
