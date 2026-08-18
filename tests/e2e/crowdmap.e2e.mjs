// crowdMap viz: sequence, scrubbing, tweening and playback.
//
// Runs against the no-auth dev harness page (/explore/crowdmap.html), driving
// the viz through window._vy_crowdMap. Nothing here needs a signed-in session.

import { runSuite, canvasSignature } from "./harness.mjs";

const CANVAS = "#stage canvas";

await runSuite("crowdMap viz", async ({ page, check, goto }) => {
    await goto("/explore/crowdmap.html");
    await page.waitForFunction(() => window._vy_crowdMap, { timeout: 20000 });

    // --- baseline render from the bundled sample files --------------------
    const base = await canvasSignature(page, CANVAS);
    check("harness renders a non-blank canvas", base && base.opaque > 0,
        `${base?.opaque} opaque px`);

    // --- sequence loading --------------------------------------------------
    const seq = await page.evaluate(() => {
        const mk = (n, sx, score) =>
            Array.from({ length: n }, (_, i) => ({
                id: `p${i}`,
                box: { x: sx + i * 40, y: 600, w: 60, h: 60 + (i % 50) },
                score,
            }));
        const steps = [0, 1, 2, 3, 4].map((k) => ({
            index: k,
            time: k * 4,
            byCamera: {
                1: mk(20 + k, 500 + k * 200, -800 + k * 400),
                3: mk(12, 900, 500),
                5: mk(8, 1500, -300),
            },
        }));
        const count = window._vy_crowdMap.setSequence(steps);
        return {
            count,
            stepCount: window._vy_crowdMap.stepCount(),
            step: window._vy_crowdMap.step,
            time: window._vy_crowdMap.currentStep()?.time,
            cam1: window._vy_crowdMap.stats[1],
        };
    });
    check("setSequence loads every step", seq.count === 5 && seq.stepCount === 5,
        `count=${seq.count}`);
    check("defaults to the first step", seq.step === 0 && seq.time === 0);
    check("reduces rows to points", seq.cam1?.plotted === 20,
        JSON.stringify(seq.cam1));

    // --- scrubbing ---------------------------------------------------------
    const before = await canvasSignature(page, CANVAS);
    const jumped = await page.evaluate(() => {
        const s = window._vy_crowdMap.showStep(3);
        return { step: window._vy_crowdMap.step, time: s?.time };
    });
    const after = await canvasSignature(page, CANVAS);
    check("showStep selects the requested step",
        jumped.step === 3 && jumped.time === 12, JSON.stringify(jumped));
    check("scrubbing changes the rendering", before.hash !== after.hash);

    const clamp = await page.evaluate(() => {
        window._vy_crowdMap.showStep(999);
        const hi = window._vy_crowdMap.step;
        window._vy_crowdMap.showStep(-5);
        return { hi, lo: window._vy_crowdMap.step };
    });
    check("showStep clamps out-of-range indices",
        clamp.hi === 4 && clamp.lo === 0, JSON.stringify(clamp));

    // --- memory cap --------------------------------------------------------
    const cap = await page.evaluate(() => {
        const many = Array.from({ length: 9000 }, (_, i) => ({
            id: `p${i}`,
            box: { x: (i * 13) % 3840, y: 500, w: 60, h: 80 },
            score: 0,
        }));
        window._vy_crowdMap.setSequence([
            { index: 0, time: 0, byCamera: { 1: many } },
        ]);
        const s = window._vy_crowdMap.stats[1];
        return { ...s, cap: window._vy_crowdMap.maxPointsPerCamera };
    });
    check("per-camera point cap holds", cap.plotted <= cap.cap,
        `${cap.plotted} plotted of ${cap.count} (cap ${cap.cap})`);

    // --- tween linkage -----------------------------------------------------
    const link = await page.evaluate(() => {
        const step = (k, x, h) => ({
            index: k, time: k * 4,
            byCamera: { 1: [
                { id: "p0", box: { x, y: 600, w: 60, h }, score: -1000 + k * 1000 },
                { id: `only${k}`, box: { x: 2000, y: 600, w: 60, h: 80 }, score: 0 },
            ] },
        });
        const cm = window._vy_crowdMap;
        cm.setSequence([step(0, 0, 140), step(1, 1920, 90), step(2, 3840, 40)]);
        const a = cm.sequence[0].points[1].find((p) => p.id === "p0");
        const b = cm.sequence[1].points[1].find((p) => p.id === "p0");
        const last = cm.sequence[2].points[1].find((p) => p.id === "p0");
        const first = cm.sequence[0].points[1].find((p) => p.id === "p0");
        return {
            hasNext: a.hasNext,
            targetMatchesNext: a.nx === b.x && a.ny === b.y,
            moves: a.x !== a.nx && a.y !== a.ny,
            midX: a.x + (a.nx - a.x) * 0.5, trueMidX: (a.x + b.x) / 2,
            midY: a.y + (a.ny - a.y) * 0.5, trueMidY: (a.y + b.y) / 2,
            midS: a.s + (a.ns - a.s) * 0.5, trueMidS: (a.s + b.s) / 2,
            fadeOut: cm.sequence[0].points[1].filter((p) => !p.hasNext).map((p) => p.id),
            entering: cm.sequence[0].entering[1].map((p) => p.id),
            wraps: last.hasNext && last.nx === first.x && last.ny === first.y,
        };
    });
    check("persistent point links to its next position",
        link.hasNext && link.targetMatchesNext);
    check("linked point moves on both axes", link.moves);
    check("position lerps to the true midpoint",
        Math.abs(link.midX - link.trueMidX) < 1e-6 &&
        Math.abs(link.midY - link.trueMidY) < 1e-6);
    check("sentiment lerps too",
        Math.abs(link.midS - link.trueMidS) < 1e-6,
        `mid ${link.midS}`);
    check("unmatched point marked to fade out",
        link.fadeOut.includes("only0"), JSON.stringify(link.fadeOut));
    check("next-only point queued to fade in",
        link.entering.includes("only1"), JSON.stringify(link.entering));
    check("last step links back to the first (seamless loop)", link.wraps);

    // --- playback ----------------------------------------------------------
    const play = await page.evaluate(async () => {
        const cm = window._vy_crowdMap;
        cm.stepDurationMs = 300;
        const seen = [];
        cm.onStepChange = (i) => seen.push(i);
        cm.play();
        const started = cm.playing;
        const p1 = cm.playhead;
        await new Promise((r) => setTimeout(r, 500));
        const p2 = cm.playhead;
        await new Promise((r) => setTimeout(r, 800)); // past the end -> must wrap
        const p3 = cm.playhead;
        cm.pause();
        return { started, p1, p2, p3, seen, len: cm.sequence.length,
                 playing: cm.playing, step: cm.step };
    });
    check("play() starts the loop", play.started);
    check("playhead advances", play.p2 > play.p1,
        `${play.p1.toFixed(2)} -> ${play.p2.toFixed(2)}`);
    check("playback loops rather than running off the end",
        play.p3 >= 0 && play.p3 < play.len, `p3=${play.p3.toFixed(2)}`);
    check("onStepChange reports advancing steps", play.seen.length >= 2,
        JSON.stringify(play.seen));
    // Guards the negative-first-delta bug: a rAF timestamp can predate the
    // performance.now() taken in play(), which drove playhead below zero.
    check("no out-of-range step index reported",
        play.seen.every((i) => i >= 0 && i < play.len),
        JSON.stringify(play.seen));
    check("pause() stops and settles on a whole step",
        !play.playing && Number.isInteger(play.step), `step=${play.step}`);

    const frames = await page.evaluate(() => {
        const cm = window._vy_crowdMap;
        const c = document.querySelector("#stage canvas");
        const hash = () => {
            const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
            let h = 0;
            for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i+1]*3 + d[i+2]*7) | 0;
            return h;
        };
        return [0, 0.25, 0.5, 0.75].map((f) => { cm.paintTween(0, f); return hash(); });
    });
    check("tween renders distinct intermediate frames",
        new Set(frames).size === 4, `${new Set(frames).size}/4 unique`);

    // --- teardown ----------------------------------------------------------
    const cleared = await page.evaluate(async () => {
        const cm = window._vy_crowdMap;
        cm.play();
        const during = cm.playing;
        cm.clear();
        await new Promise((r) => setTimeout(r, 100));
        return { during, playing: cm.playing, raf: cm.raf, len: cm.sequence.length };
    });
    check("clear() stops playback and drops the sequence",
        cleared.during && !cleared.playing && cleared.raf === null && cleared.len === 0,
        JSON.stringify(cleared));
});
