// Chat crowd-map banner: layout, scrubber and playback controls.
//
// REQUIRES A SIGNED-IN PROFILE — run `npm run e2e:login` once first. The chat
// page is behind Firebase auth, so without a session this suite reports that
// and exits rather than failing misleadingly.
//
// Drives the banner through the ui.showCrowdSnapshot event, exactly as the
// show_crowd_snapshot tool does, so no LLM call or live Firestore read occurs.

import { runSuite, canvasSignature } from "./harness.mjs";

const CANVAS = "#chat-crowdmap canvas";

// Steps shaped like the loader's output: people keyed by camera, ids stable
// across windows so the tween has something to link.
const FIXTURE = `(() => {
    const person = (id, x, h, score) => ({ id, box: { x, y: 600, w: 60, h }, score });
    return Array.from({ length: 8 }, (_, k) => ({
        index: k,
        time: k * 4,
        byCamera: {
            1: [person("a", 200 + k * 300, 140 - k * 10, -900 + k * 220),
                person("b", 3000 - k * 200, 60 + k * 8, 400)],
            3: [person("c", 1200, 100, -200 + k * 100)],
            5: [person("d", 900 + k * 100, 80, 600)],
        },
    }));
})()`;

await runSuite("chat crowd banner", async ({ page, check, goto, screenshot }) => {
    await goto("/chat");

    const ready = await page
        .waitForFunction(() => window._vy_chat && document.getElementById("chat-crowdmap"), {
            timeout: 25000,
        })
        .then(() => true)
        .catch(() => false);

    if (!ready) {
        check(
            "chat page reachable (are you signed in? run `npm run e2e:login`)",
            false,
            "no #chat-crowdmap after 25s"
        );
        return;
    }

    // Banner starts hidden until a snapshot arrives.
    const hidden = await page.evaluate(() =>
        getComputedStyle(document.getElementById("chat-crowdmap")).display
    );
    check("banner hidden before any snapshot", hidden === "none", hidden);

    // Fire the same event the tool fires.
    await page.evaluate((expr) => {
        const steps = eval(expr);
        window._vy_eventBus.fire("ui.showCrowdSnapshot", {
            steps,
            label: "raimondi:20260621 @ 0:00–0:32",
            hierarchy: "raimondi:20260621",
            startTime: 0,
            endTime: 32,
            windowSeconds: 4,
        });
    }, FIXTURE);
    await new Promise((r) => setTimeout(r, 300));

    const shown = await page.evaluate(() => {
        const el = document.getElementById("chat-crowdmap");
        const box = el.getBoundingClientRect();
        return {
            display: getComputedStyle(el).display,
            height: box.height,
            viewport: window.innerHeight,
            steps: window._vy_crowdMap.stepCount(),
        };
    });
    check("banner appears on snapshot", shown.display !== "none", shown.display);
    check("sequence reached the viz", shown.steps === 8, `${shown.steps} steps`);

    // The whole reason for the inline height: it must not swallow the chat.
    // The map itself is 30vh; the allowance on top is the scrubber row, which
    // sits below the canvas rather than over it.
    check(
        "banner is capped near 30vh plus the scrubber row",
        shown.height > 0 && shown.height <= shown.viewport * 0.3 + 48,
        `${Math.round(shown.height)}px of ${shown.viewport}px viewport`
    );

    const chatVisible = await page.evaluate(() => {
        const w = document.getElementById("chat-window");
        return w ? w.getBoundingClientRect().height : 0;
    });
    check("chat window still has room", chatVisible > 100, `${Math.round(chatVisible)}px`);

    // Scrubber + play button should both be present for a multi-step sequence.
    const controls = await page.evaluate(() => {
        const bar = document.querySelector("#chat-crowdmap input[type=range]");
        const btn = document.querySelector("#chat-crowdmap button i.la-play, #chat-crowdmap button i.la-pause");
        const barBox = bar?.getBoundingClientRect();
        const bannerBox = document.getElementById("chat-crowdmap").getBoundingClientRect();
        const canvasBox = document
            .querySelector("#chat-crowdmap canvas")
            .getBoundingClientRect();
        const row = bar?.parentElement?.getBoundingClientRect();
        return {
            hasSlider: !!bar,
            hasPlay: !!btn,
            max: bar?.max,
            sliderInsideBanner: barBox
                ? barBox.bottom <= bannerBox.bottom + 1 && barBox.width > 0
                : false,
            // The point of the layout: no part of the scrubber row overlaps the
            // map, so it can't hide the front rows of cameras 3 and 4.
            belowCanvas: row ? row.top >= canvasBox.bottom - 1 : false,
        };
    });
    check("scrubber rendered", controls.hasSlider);
    check("scrubber spans the sequence", controls.max === "7", `max=${controls.max}`);
    check("play button rendered", controls.hasPlay);
    check("scrubber sits inside the banner", controls.sliderInsideBanner);
    check("scrubber sits fully below the map", controls.belowCanvas);

    // Caption is two lines: the event, then the moment. The fixture passes only
    // a composed "hier @ span" label, so this also covers the split fallback.
    const caption = await page.evaluate(() => ({
        title: document.getElementById("crowdmap-title")?.textContent.trim(),
        time: document.getElementById("crowdmap-time")?.textContent.trim(),
    }));
    check("caption title is the event alone",
        caption.title === "raimondi:20260621", caption.title);
    check("caption time line is separate from the title",
        /^0:00–0:32/.test(caption.time || ""), caption.time);

    // Heading shows the current window time and updates as you scrub.
    const headingAt0 = caption.time;
    await page.evaluate(() => window._vy_chat.showCrowdStep(5));
    await new Promise((r) => setTimeout(r, 100));
    const headingAt5 = await page.evaluate(() =>
        document.getElementById("crowdmap-time")?.textContent.trim()
    );
    check("heading shows a time", /\d+:\d\d/.test(headingAt0 || ""), headingAt0);
    check("heading time follows scrubbing", headingAt0 !== headingAt5,
        `"${headingAt0}" -> "${headingAt5}"`);

    // Score panel: one row per camera with data, plus an overall row, tracking
    // the same step the caption reports.
    const scores = await page.evaluate(() => {
        const model = window._vy_chat.crowdScores();
        const panel = document.getElementById("crowdmap-scores");
        const mapBox = document
            .querySelector("#chat-crowdmap canvas")
            .getBoundingClientRect();
        const panelBox = panel?.getBoundingClientRect();
        return {
            cameras: model.cameras.map((c) => c.camera),
            total: model.total,
            people: model.people,
            rendered: !!panel,
            text: panel?.textContent.replace(/\s+/g, " ").trim(),
            onLeft: panelBox ? panelBox.left < mapBox.left + mapBox.width / 2 : false,
        };
    });
    check("score panel rendered", scores.rendered, scores.text);
    check("score panel covers the cameras with data",
        JSON.stringify(scores.cameras) === "[1,3,5]",
        JSON.stringify(scores.cameras));
    check("score panel is on the left", scores.onLeft);
    check("overall score is weighted across cameras",
        Number.isFinite(scores.total) && scores.people === 4,
        `total=${scores.total} people=${scores.people}`);

    const scoresAt7 = await page.evaluate(() => {
        window._vy_chat.showCrowdStep(7);
        return window._vy_chat.crowdScores().total;
    });
    check("scores follow scrubbing", scoresAt7 !== scores.total,
        `${scores.total} -> ${scoresAt7}`);
    await page.evaluate(() => window._vy_chat.showCrowdStep(5));

    // Play toggles the icon, advances, and loops.
    const before = await canvasSignature(page, CANVAS);
    const played = await page.evaluate(async () => {
        window._vy_crowdMap.stepDurationMs = 200;
        window._vy_chat.toggleCrowdPlay();
        const icon = () => !!document.querySelector("#chat-crowdmap button i.la-pause");
        // van batches DOM updates onto a macrotask, so the icon is still the
        // old one on the tick that flipped the state — yield before reading it.
        await new Promise((r) => setTimeout(r, 0));
        const playingIcon = icon();
        await new Promise((r) => setTimeout(r, 900));
        const midIndex = window._vy_chat.stepIndex.val;
        window._vy_chat.toggleCrowdPlay();
        const playing = window._vy_crowdMap.playing;
        await new Promise((r) => setTimeout(r, 0));
        return {
            playingIcon,
            midIndex,
            pausedIcon: !!document.querySelector("#chat-crowdmap button i.la-play"),
            playing,
        };
    });
    const after = await canvasSignature(page, CANVAS);
    check("play swaps the icon to pause", played.playingIcon);
    check("playback advances the slider", played.midIndex !== 5, `index=${played.midIndex}`);
    check("playback repaints the canvas", before.hash !== after.hash);
    check("pause restores the play icon and stops", played.pausedIcon && !played.playing);

    // Dismissing must tear the loop down.
    const dismissed = await page.evaluate(async () => {
        window._vy_chat.toggleCrowdPlay();
        await new Promise((r) => setTimeout(r, 100));
        document.querySelector("#chat-crowdmap button[title='Hide crowd map']")?.click();
        await new Promise((r) => setTimeout(r, 100));
        return {
            display: getComputedStyle(document.getElementById("chat-crowdmap")).display,
            playing: window._vy_crowdMap.playing,
            raf: window._vy_crowdMap.raf,
        };
    });
    check("dismiss hides the banner", dismissed.display === "none");
    check("dismiss stops playback", !dismissed.playing && dismissed.raf === null);

    // --- Replaying the map when a conversation is reopened -----------------
    // Which call gets replayed is decided from persisted messages, so drive it
    // with message fixtures. toolBox.invoke is stubbed: the selection logic is
    // what's under test, and the real call would fetch chunks for an event.
    const replay = await page.evaluate(async () => {
        const client = window._vy_chatClient;
        const box = window._vy_toolBox;
        const realInvoke = box.invoke;
        const calls = [];
        box.invoke = async (name, args) => {
            calls.push({ name, args });
            return {};
        };

        const request = (line, structured) => ({
            role: "assistant",
            type: "tool_request",
            content: `Requesting tools:\n\n  - ${line}`,
            ...(structured ? { toolCalls: structured } : {}),
        });
        const snapshot = (start) =>
            `show_crowd_snapshot({"hierarchy":"raimondi:20260621","startTime":${start}})`;

        const results = {};

        // Structured field is preferred, and the last visual call wins.
        results.lastWins = client.findLastVisualCall([
            request(snapshot(10), [
                { name: "show_crowd_snapshot", args: '{"startTime":10}' },
            ]),
            request("get_events({})", [{ name: "get_events", args: "{}" }]),
            request(snapshot(90), [
                { name: "show_crowd_snapshot", args: '{"startTime":90}' },
            ]),
        ]);

        // Conversations written before toolCalls existed fall back to the text.
        results.legacy = client.findLastVisualCall([request(snapshot(120))]);

        // A multi-tool request line, and non-visual tools alone.
        results.mixed = client.findLastVisualCall([
            {
                role: "assistant",
                type: "tool_request",
                content: `Requesting tools:\n\n  - get_events({})\n  - ${snapshot(
                    7
                )}`,
            },
        ]);
        results.noneWhenNoVisual = client.findLastVisualCall([
            request("get_events({})"),
            { role: "user", type: "message", content: "show me the crowd" },
        ]);
        results.noneWhenEmpty = client.findLastVisualCall([]);

        // The invoke path passes name + args straight through.
        await client.replayLastVisual([request(snapshot(55))]);
        results.invoked = calls;

        box.invoke = realInvoke;
        return results;
    });

    check("replay picks the last visual call",
        JSON.parse(replay.lastWins?.args || "{}").startTime === 90,
        replay.lastWins?.args);
    check("replay reads legacy messages with no toolCalls field",
        JSON.parse(replay.legacy?.args || "{}").startTime === 120,
        replay.legacy?.args);
    check("replay finds a visual call beside other tools",
        JSON.parse(replay.mixed?.args || "{}").startTime === 7,
        replay.mixed?.args);
    check("replay ignores non-visual tools", replay.noneWhenNoVisual === null);
    check("replay is a no-op on an empty history", replay.noneWhenEmpty === null);
    check("replay invokes the tool with its recorded args",
        replay.invoked.length === 1 &&
            replay.invoked[0].name === "show_crowd_snapshot" &&
            JSON.parse(replay.invoked[0].args).startTime === 55,
        JSON.stringify(replay.invoked));

    // The wiring between the two files: loading a conversation's history has to
    // actually reach replayLastVisual, and only for the history batch — a bug
    // here makes the whole feature a silent no-op or a repeated refetch.
    const wiring = await page.evaluate(async () => {
        const box = window._vy_toolBox;
        const realInvoke = box.invoke;
        let invocations = 0;
        box.invoke = async () => (invocations++, {});

        const messages = window._vy_chat.messages;
        const realData = messages.data;
        const history = [
            {
                id: "m1",
                role: "assistant",
                type: "tool_request",
                content:
                    'Requesting tools:\n\n  - show_crowd_snapshot({"hierarchy":"raimondi:20260621","startTime":42})',
            },
        ];
        messages.data = { history };

        // The history batch replays...
        messages.replayPending = true;
        messages.appendMessages(history);
        await new Promise((r) => setTimeout(r, 50));
        const afterHistory = invocations;

        // ...and a later live batch does not.
        messages.appendMessages([
            { id: "m2", role: "assistant", type: "message", content: "and here it is" },
        ]);
        await new Promise((r) => setTimeout(r, 50));

        box.invoke = realInvoke;
        messages.data = realData;
        return { afterHistory, afterLive: invocations };
    });
    check("loading a conversation replays its last map", wiring.afterHistory === 1,
        `${wiring.afterHistory} invocations`);
    check("later messages don't re-replay", wiring.afterLive === 1,
        `${wiring.afterLive} invocations`);

    // Switching conversations drops the previous map rather than leaving it
    // stranded above an unrelated transcript.
    const switched = await page.evaluate(async () => {
        window._vy_chat.showCrowdSnapshot({
            byCamera: { 1: [{ id: "a", box: { x: 100, y: 600, w: 60, h: 90 }, score: 100 }] },
            hierarchy: "raimondi:20260621",
            startTime: 10,
        });
        await new Promise((r) => setTimeout(r, 50));
        const before = getComputedStyle(document.getElementById("chat-crowdmap")).display;
        window._vy_eventBus.fire("ui.requestConversation", { conversation: "other" });
        await new Promise((r) => setTimeout(r, 50));
        return {
            before,
            after: getComputedStyle(document.getElementById("chat-crowdmap")).display,
        };
    });
    check("switching conversations clears the banner",
        switched.before !== "none" && switched.after === "none",
        `${switched.before} -> ${switched.after}`);

    await screenshot("/tmp/chat-banner.png");
});
