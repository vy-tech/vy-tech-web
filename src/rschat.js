import van from "vanjs-core";

import { Messages } from "./ui/messages.js";
import { Conversations } from "./ui/conversations.js";
import { eventBus } from "./eventbus.js";
import { crowdMap } from "./viz/crowdMap.js";

class Chat {
    constructor() {
        this.messages = new Messages();
        this.conversations = new Conversations();

        // Crowd sentiment banner. Hidden until a snapshot arrives, so the chat
        // looks unchanged until the assistant actually has a moment to show.
        this.showBanner = van.state(false);
        // Caption, split across two lines: which event, then which moment.
        this.bannerTitle = van.state("");
        this.bannerRange = van.state("");
        // Scrubber position over the loaded window sequence. stepCount 0 means
        // a single instant, so no scrubber is shown.
        this.stepCount = van.state(0);
        this.stepIndex = van.state(0);
        this.playing = van.state(false);
        // Bumped per snapshot. The score panel reads it so a single-instant
        // snapshot (which never moves stepIndex) still re-renders.
        this.dataVersion = van.state(0);
    }

    async init() {
        console.log("Initializing Chat UI...");
        this.addElements();
        await this.messages.init();
        eventBus.on("ui.updateMessages", () => {
            this.scrollToBottom();
        });
        eventBus.on("ui.showCrowdSnapshot", (e) => {
            this.showCrowdSnapshot(e.detail);
        });
        // Switching conversations drops the map with the transcript that
        // explained it. If the incoming conversation has one of its own,
        // ChatClient.replayLastVisual re-fires showCrowdSnapshot once its
        // history loads.
        eventBus.on("ui.requestConversation", () => {
            if (this.showBanner.val) this.hideCrowdSnapshot();
        });
        console.log("rschat Init complete");
    }

    /**
     * Render a crowd snapshot in the banner.
     * @param {Object} detail
     * @param {Object} detail.byCamera - rows keyed by camera number (1-5)
     * @param {string} [detail.label] - caption describing the moment shown
     */
    showCrowdSnapshot(detail = {}) {
        const { steps, byCamera } = detail;

        if (Array.isArray(steps) && steps.length) {
            // Follow the animation so the slider tracks playback.
            crowdMap.onStepChange = (index) => {
                this.stepIndex.val = index;
            };
            const count = crowdMap.setSequence(steps);
            this.stepCount.val = count;
            this.stepIndex.val = 0;
            this.playing.val = false;
        } else {
            // Single-instant form (no sequence) — used by direct callers.
            crowdMap.setAllDetections(byCamera || {});
            this.stepCount.val = 0;
            this.stepIndex.val = 0;
        }

        this.setBannerLabels(detail);
        this.dataVersion.val = this.dataVersion.val + 1;
        this.showBanner.val = true;
    }

    /**
     * Split the caption into "which event" and "which moment". Prefers the
     * structured fields the tool sends; falls back to splitting the composed
     * `label` for callers (and the e2e fixture) that only pass that.
     */
    setBannerLabels(detail = {}) {
        const label = detail.label || "";
        let title = detail.hierarchy || "";
        let range = "";

        if (typeof detail.startTime === "number") {
            range =
                detail.endTime > detail.startTime
                    ? `${this.formatTime(detail.startTime)}–${this.formatTime(
                          detail.endTime
                      )}`
                    : this.formatTime(detail.startTime);
        }

        if (!title || !range) {
            const at = label.lastIndexOf(" @ ");
            if (at > -1) {
                title = title || label.slice(0, at);
                range = range || label.slice(at + 3);
            } else {
                title = title || label;
            }
        }

        this.bannerTitle.val = title;
        this.bannerRange.val = range;
    }

    // Scrub to a step of the loaded sequence. Dragging stops playback so the
    // animation doesn't fight the user's own seeking.
    showCrowdStep(index) {
        if (crowdMap.playing) {
            crowdMap.pause();
            this.playing.val = false;
        }
        const step = crowdMap.showStep(index);
        if (step) this.stepIndex.val = crowdMap.step;
    }

    toggleCrowdPlay() {
        this.playing.val = crowdMap.togglePlay();
    }

    // Second caption line: the span being shown and, once there's a sequence,
    // where in it you are. Reading stepIndex/stepCount here is what makes van
    // re-render it as you scrub or as playback advances.
    bannerTimeLine() {
        const index = this.stepIndex.val;
        const range = this.bannerRange.val;
        if (!this.stepCount.val) return range;
        const step = crowdMap.sequence && crowdMap.sequence[index];
        return step ? `${range} · ${this.formatTime(step.time)}` : range;
    }

    /**
     * Per-camera sentiment for the window on screen, plus an overall figure.
     *
     * Read from the sequence by index rather than from crowdMap.stats: during
     * playback the map swaps its own stats inside the rAF tick, so going
     * through the index keeps the numbers matched to the step the caption and
     * scrubber are reporting.
     *
     * The overall score is weighted by plotted points, not a mean of the five
     * camera means — a wedge with two people shouldn't count as much as one
     * with forty.
     */
    crowdScores() {
        // Reactive dependencies. Both are read unconditionally so van
        // re-renders on a scrub *and* on a fresh single-instant snapshot.
        const index = this.stepIndex.val;
        this.dataVersion.val;

        const step = this.stepCount.val
            ? crowdMap.sequence && crowdMap.sequence[index]
            : null;
        const stats = (step && step.stats) || crowdMap.stats || {};

        const cameras = [];
        let weighted = 0;
        let plotted = 0;
        let people = 0;

        for (const camera of [1, 2, 3, 4, 5]) {
            const stat = stats[camera];
            if (!stat || !stat.plotted) continue;
            cameras.push({
                camera,
                score: Math.round(stat.mean),
                people: stat.count,
            });
            weighted += stat.mean * stat.plotted;
            plotted += stat.plotted;
            people += stat.count;
        }

        return {
            cameras,
            people,
            total: plotted ? Math.round(weighted / plotted) : 0,
        };
    }

    // Left-side score readout. Sits in the letterbox beside the map — the seat
    // map is 2:1 and the banner rarely is, so there's usually dead space there.
    //
    // Always returns an element, hidden when there's nothing plotted, rather
    // than returning null for the empty case: van drops a binding whose
    // function returned null (keepConnected filters bindings on
    // `_dom?.isConnected`), and this one renders empty on first paint, so a
    // null would mean the panel never appears at all.
    crowdScorePanel() {
        const { div, span } = van.tags;
        const { cameras, total, people } = this.crowdScores();

        // Same hue ramp as the plotted dots, so a number and its dots agree.
        const swatch = (score) =>
            span({
                class: "inline-block w-2 h-2 rounded-full flex-shrink-0",
                style: `background: hsl(${crowdMap.scoreToHue(
                    score
                )}, 90%, 45%);`,
            });

        const row = (label, score, count, emphasis) =>
            div(
                {
                    class: `flex items-center gap-1.5 ${
                        emphasis ? "font-semibold" : ""
                    }`,
                },
                swatch(score),
                span({ class: "w-8" }, label),
                span({ class: "w-12 text-right" }, `${score}`),
                span({ class: "w-12 text-right text-gray-500" }, `${count}`)
            );

        return div(
            {
                id: "crowdmap-scores",
                class: "absolute top-1 left-2 bg-white/85 rounded px-2 py-1 text-sm text-gray-800 tabular-nums",
                style: cameras.length ? "" : "display: none;",
            },
            div(
                { class: "flex items-center gap-1.5 text-gray-500 mb-0.5" },
                span({ class: "inline-block w-2 flex-shrink-0" }),
                span({ class: "w-8" }, "Cam"),
                span({ class: "w-12 text-right" }, "Score"),
                // Distinct tracks in the window, which overcounts a headcount —
                // see the note on approximatePeople in the tool.
                span(
                    {
                        class: "w-12 text-right",
                        title: "Approximate people seen during this window",
                    },
                    "People"
                )
            ),
            ...cameras.map((c) => row(`${c.camera}`, c.score, c.people)),
            div({ class: "border-t border-gray-300 my-0.5" }),
            row("All", total, people, true)
        );
    }

    stepLabel() {
        if (!this.stepCount.val) return "";
        return `${this.stepIndex.val + 1} / ${this.stepCount.val}`;
    }

    formatTime(seconds) {
        const s = Math.max(0, Math.floor(seconds || 0));
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;
        const pad = (n) => n.toString().padStart(2, "0");
        // Events run past an hour, so don't let minutes climb to "73:20".
        return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
    }

    hideCrowdSnapshot() {
        this.showBanner.val = false;
        // clear() stops the rAF loop, so dismissing the banner can't leave an
        // animation running against a hidden canvas.
        crowdMap.clear();
        this.playing.val = false;
        this.stepCount.val = 0;
        // Drop the score panel with the data it described, so a later snapshot
        // can't flash the previous event's numbers before its own arrive.
        this.dataVersion.val = this.dataVersion.val + 1;
    }

    scrollToBottom() {
        const chatWindow = document.getElementById("chat-window");
        if (chatWindow) {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    }

    async sendTextInput() {
        const inputElement = document.getElementById("chat-input");
        const message = inputElement.value;
        if (message.trim() === "") return;

        // Display user message in chat window
        inputElement.value = "";

        // Send message to backend
        await this.messages.sendMessage(message);
    }

    addElements(parentElement) {
        const { a, div, main, h1, input, button } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-full h-full flex" },
                // Main chat area - takes full width on mobile, partial on desktop
                div(
                    { class: "flex-1 flex flex-col p-4" },
                    // Mobile dropdown (hidden on lg+ screens)
                    div(
                        {
                            class: "flex space-x-4 flex-shrink-0 mb-4 lg:hidden",
                        },
                        this.conversations.createSelectorElement()
                    ),
                    // Crowd sentiment banner — a top strip showing where the
                    // crowd was and how it felt at a moment the assistant
                    // chose. Hidden until a ui.showCrowdSnapshot event fires.
                    div(
                        {
                            id: "chat-crowdmap",
                            class: "w-full flex-shrink-0 mb-4 rounded-lg overflow-hidden bg-white flex flex-col",
                            // Height is set inline rather than via a Tailwind
                            // class: the banner must never grow to eat the
                            // conversation, and an inline style can't be missed
                            // by a stale CSS build or a cached stylesheet.
                            //
                            // The map keeps its 30vh; the scrubber row is added
                            // on top of that rather than laid over the canvas,
                            // because a video-player-style overlay covers the
                            // front rows of cameras 3 and 4.
                            style: () =>
                                this.showBanner.val
                                    ? "height: calc(30vh + 2.25rem);"
                                    : "display: none;",
                        },
                        // Map area. Relative so the caption, close button and
                        // score readout can sit over the canvas — the seat map
                        // is 2:1 and the banner rarely is, so `object-fit:
                        // contain` usually leaves empty margin on both sides.
                        div(
                            { class: "relative flex-1 min-h-0" },
                            crowdMap.createElement({
                                class: "block mx-auto",
                                style: "width: 100%; height: 100%; object-fit: contain;",
                            }),
                            () => this.crowdScorePanel(),
                            div(
                                {
                                    class: "absolute top-1 right-2 flex items-start gap-2",
                                },
                                div(
                                    {
                                        class: "bg-white/85 rounded px-2 py-1 text-right",
                                    },
                                    div(
                                        {
                                            id: "crowdmap-title",
                                            class: "text-sm font-medium text-gray-800",
                                        },
                                        () => this.bannerTitle.val
                                    ),
                                    div(
                                        {
                                            id: "crowdmap-time",
                                            class: "text-xs text-gray-600 tabular-nums",
                                        },
                                        () => this.bannerTimeLine()
                                    )
                                ),
                                button(
                                    {
                                        class: "text-gray-500 hover:text-gray-800 bg-white/85 rounded px-2 py-1 text-sm",
                                        title: "Hide crowd map",
                                        onclick: () => this.hideCrowdSnapshot(),
                                    },
                                    van.tags.i({ class: "las la-times" })
                                )
                            )
                        ),
                        // Scrubber — only when the tool returned a sequence of
                        // time windows rather than a single instant.
                        div(
                            {
                                class: "flex-shrink-0 flex items-center gap-2 px-2 py-1 border-t border-gray-200 bg-white",
                                style: () =>
                                    this.stepCount.val > 1
                                        ? ""
                                        : "display: none;",
                            },
                            button(
                                {
                                    class: "text-gray-700 hover:text-black px-1",
                                    title: () =>
                                        this.playing.val ? "Pause" : "Play",
                                    onclick: () => this.toggleCrowdPlay(),
                                },
                                van.tags.i({
                                    class: () =>
                                        this.playing.val
                                            ? "las la-pause"
                                            : "las la-play",
                                })
                            ),
                            input({
                                type: "range",
                                class: "flex-1",
                                min: 0,
                                max: () => Math.max(0, this.stepCount.val - 1),
                                value: () => this.stepIndex.val,
                                oninput: (e) =>
                                    this.showCrowdStep(
                                        parseInt(e.target.value, 10)
                                    ),
                            }),
                            div(
                                {
                                    class: "text-sm text-gray-700 tabular-nums whitespace-nowrap",
                                },
                                () => this.stepLabel()
                            )
                        )
                    ),
                    // Chat messages area
                    div(
                        {
                            id: "chat-window",
                            class: "flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-4",
                        },
                        this.messages.createElements()
                    ),
                    // Input area
                    div(
                        {
                            class: "mt-4 flex-shrink-0 bg-white border rounded-lg p-3 shadow-sm",
                        },
                        // Top row - text input
                        div(
                            { class: "mb-3" },
                            input({
                                id: "chat-input",
                                type: "text",
                                class: "w-full text-black bg-transparent outline-none placeholder-gray-500",
                                placeholder: "Type a message...",
                                onkeydown: async (e) => {
                                    if (e.key === "Enter") {
                                        await this.sendTextInput();
                                    }
                                },
                            })
                        ),
                        // Bottom row - buttons
                        div(
                            { class: "flex justify-between items-center" },
                            // Left column - action buttons
                            div(
                                { class: "flex space-x-2" },
                                button(
                                    {
                                        class: "text-gray-500 hover:text-gray-700 p-1 rounded",
                                        title: "Attach file",
                                        onclick: () => {
                                            // TODO: Implement attach functionality
                                            console.log("Attach clicked");
                                        },
                                    },
                                    van.tags.i({ class: "las la-paperclip" })
                                ),
                                button(
                                    {
                                        class: "text-gray-500 hover:text-gray-700 p-1 rounded",
                                        title: "Restart conversation",
                                        onclick: () => {
                                            console.log("Restart clicked");

                                            if (
                                                confirm(
                                                    "This starts a new conversation that continues where this one left off.  " +
                                                        "Use this if the current conversation is stuck." +
                                                        "\n\n" +
                                                        "Restart the conversation?"
                                                )
                                            ) {
                                                eventBus.fire(
                                                    "ui.requestRestartConversation"
                                                );
                                            }
                                        },
                                    },
                                    van.tags.i({ class: "las la-redo-alt" })
                                )
                            ),
                            // Right column - send button
                            button(
                                {
                                    class: "bg-blue-500 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-md text-sm",
                                    onclick: async () =>
                                        await this.sendTextInput(),
                                },
                                "Send"
                            )
                        )
                    )
                ),
                // Desktop sidebar (hidden on mobile, shown on lg+ screens)
                div(
                    { class: "hidden lg:flex" },
                    this.conversations.createSidebarElement()
                )
            )
        );
    }
}

const chat = new Chat();

// Exposed for console debugging, matching the window._vy_* convention used by
// rsreports/rsadmin/toolbox. Handy for inspecting banner state (stepCount,
// stepIndex) and driving the scrubber without a tool call.
if (typeof window !== "undefined") {
    window._vy_chat = chat;
    window._vy_crowdMap = crowdMap;
}

export { Chat, chat };
