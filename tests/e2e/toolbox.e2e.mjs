// ToolBox result handling: one output per call_id, whatever the tools do.
//
// REQUIRES A SIGNED-IN PROFILE — run `npm run e2e:login` once first. The chat
// page is behind Firebase auth, so without a session this suite reports that
// and exits rather than failing misleadingly.
//
// The model is blocked until every call_id it issued comes back, so a tool that
// throws — or returns a shape the formatters choke on — must still produce an
// output. These drive the real ToolBox with stubbed tool results; no LLM call
// and no Firestore read occur.

import { runSuite } from "./harness.mjs";

await runSuite("toolbox results", async ({ page, check, goto }) => {
    await goto("/chat");

    const ready = await page
        .waitForFunction(() => window._vy_toolBox, { timeout: 25000 })
        .then(() => true)
        .catch(() => false);

    if (!ready) {
        check(
            "chat page reachable (are you signed in? run `npm run e2e:login`)",
            false,
            "no window._vy_toolBox after 25s"
        );
        return;
    }

    const batch = await page.evaluate(async () => {
        const box = window._vy_toolBox;
        const realInvoke = box.invoke.bind(box);
        // Failures are deliberate here, and the harness treats a page console
        // error as a suite failure — so swallow the ones we're provoking.
        const realError = console.error;
        console.error = () => {};

        const circular = {};
        circular.self = circular;

        const shapes = {
            rows: [
                { a: 1, b: 2 },
                { a: 3, b: 4 },
            ],
            thrower: null, // never returned; the stub throws for this name
            emptyList: [],
            nothing: undefined,
            nullish: null,
            object: { hello: "world" },
            circular,
        };

        box.invoke = async (name) => {
            if (name === "thrower") {
                throw new TypeError("event.summary is undefined");
            }
            return shapes[name];
        };

        const tools = Object.keys(shapes).map((name, i) => ({
            name,
            args: "{}",
            call_id: `call_${i}`,
        }));

        let result = null;
        let threw = null;
        try {
            result = await box.invokeAll(tools);
        } catch (error) {
            threw = String(error);
        }

        box.invoke = realInvoke;
        console.error = realError;

        const byName = {};
        (result?.output || []).forEach((entry, i) => {
            byName[tools[i].name] = entry;
        });

        return {
            threw,
            names: tools.map((t) => t.name),
            callIds: (result?.output || []).map((o) => o.call_id),
            byName,
            // One line per call, after the "Tool results:" header and its blank.
            lines: (result?.content || "")
                .split("\n")
                .slice(2)
                .filter((l) => l.startsWith("  - ")).length,
        };
    });

    const parsed = (name) => {
        try {
            return JSON.parse(batch.byName[name]?.output);
        } catch {
            return undefined;
        }
    };

    check("invokeAll survives a throwing tool", batch.threw === null, batch.threw);
    check(
        "every call_id gets exactly one output",
        batch.callIds.length === batch.names.length &&
            batch.callIds.join() ===
                batch.names.map((_, i) => `call_${i}`).join(),
        JSON.stringify(batch.callIds)
    );
    check(
        "one result line per call",
        batch.lines === batch.names.length,
        `${batch.lines} lines for ${batch.names.length} calls`
    );

    // A thrown tool is reported to the model rather than silently dropped.
    check(
        "a throwing tool returns an error output",
        parsed("thrower")?.error === "event.summary is undefined",
        batch.byName.thrower?.output
    );

    // Shapes that used to crash the formatters and take the turn with them.
    check(
        "rows are unchanged",
        JSON.stringify(parsed("rows")) ===
            JSON.stringify({ keys: ["a", "b"], rows: [[1, 2], [3, 4]] }),
        batch.byName.rows?.output
    );
    check(
        "an empty list is not an error",
        batch.byName.emptyList?.output === "[]",
        batch.byName.emptyList?.output
    );
    check(
        "a tool returning nothing reports null, not a failure",
        batch.byName.nothing?.output === "null" &&
            batch.byName.nullish?.output === "null",
        `${batch.byName.nothing?.output} / ${batch.byName.nullish?.output}`
    );
    check(
        "a plain object is unchanged",
        JSON.stringify(parsed("object")) === JSON.stringify({ hello: "world" }),
        batch.byName.object?.output
    );
    check(
        "an unserializable result becomes an error output",
        typeof parsed("circular")?.error === "string",
        batch.byName.circular?.output
    );

    // An unknown tool name throws inside invoke(); that has to surface the same
    // way rather than rejecting the batch.
    const unknown = await page.evaluate(async () => {
        const realError = console.error;
        console.error = () => {};
        const result = await window._vy_toolBox.invokeAll([
            { name: "no_such_tool", args: "{}", call_id: "call_x" },
        ]);
        console.error = realError;
        return result.output;
    });
    check(
        "an unknown tool returns an error output",
        unknown.length === 1 &&
            unknown[0].call_id === "call_x" &&
            /not found/i.test(JSON.parse(unknown[0].output).error || ""),
        JSON.stringify(unknown)
    );

    // events_list regression: an event is "available" from capture, but its
    // summary is written by a later pass, so an unsummarized event reaches the
    // tool and used to throw on event.summary.seconds.
    const events = await page.evaluate(async () => {
        const tool = window._vy_toolBox.toolsLookup["events_list"];
        const realGet = tool.data.getAvailable.bind(tool.data);
        const stamp = (s) => ({ toDate: () => new Date(s * 1000), seconds: s });

        tool.data.getAvailable = async () => [
            {
                hierarchy: "vy:raimondi:20260621:game",
                location: "raimondi",
                name: "(Baseball) Ballers vs Sox",
                begin: stamp(1750000000),
                end: stamp(1750010000),
                summary: { seconds: 9800, cameras: [1, 2, 3, 4, 5] },
            },
            // Captured, not yet summarized.
            {
                hierarchy: "vy:raimondi:20260718:game",
                location: "raimondi",
                name: "(Baseball) Cheer Challenge",
                begin: stamp(1752800000),
                end: stamp(1752810000),
            },
            // Barely anything at all.
            { hierarchy: "vy:raimondi:20260719:game", location: "raimondi" },
        ];

        let rows = null;
        let threw = null;
        try {
            rows = await tool.invoke({});
        } catch (error) {
            threw = String(error);
        }

        tool.data.getAvailable = realGet;
        return { threw, rows: rows && JSON.parse(JSON.stringify(rows)) };
    });

    check(
        "events_list survives an unsummarized event",
        events.threw === null,
        events.threw
    );
    check(
        "unsummarized events are still listed",
        events.rows?.length === 3,
        `${events.rows?.length} rows`
    );
    check(
        "a summarized event keeps its duration and cameras",
        events.rows?.[0]?.duration === 9800 &&
            events.rows?.[0]?.cameras?.length === 5 &&
            events.rows?.[0]?.name === "Ballers vs Sox",
        JSON.stringify(events.rows?.[0])
    );
    check(
        "an unsummarized event reports what it has",
        events.rows?.[1]?.name === "Cheer Challenge" &&
            !!events.rows?.[1]?.begin &&
            events.rows?.[1]?.duration === undefined,
        JSON.stringify(events.rows?.[1])
    );
    check(
        "an event missing dates reports null rather than throwing",
        events.rows?.[2]?.begin === null && events.rows?.[2]?.end === null,
        JSON.stringify(events.rows?.[2])
    );
});
