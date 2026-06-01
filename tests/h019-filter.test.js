// H019 self-tests. Run with: node tests/h019-filter.test.js
//
// Mirrors the Python `vy_filter.py:_self_test()` cases:
//   1. Constant input → constant output
//   2. Step input → critical-damped ramp, no overshoot
//   3. Single-frame impulse → small bounded deflection, decays back
//   4. Two interleaved tracks don't contaminate each other
//   5. Per-emotion τ: Joy (fast) settles faster than Boredom (slow)
//
// Plus a Tracker sanity check: bbox-IoU greedy matching across frames.

import { StateFilter } from "../src/scoring/stateFilter.js";
import { Tracker, bboxIoU } from "../src/scoring/tracker.js";

let failed = 0;
let passed = 0;

function check(cond, msg) {
    if (cond) {
        passed++;
        console.log(`  ✓ ${msg}`);
    } else {
        failed++;
        console.error(`  ✗ ${msg}`);
    }
}

function approxEq(a, b, eps = 1e-9) {
    return Math.abs(a - b) <= eps;
}

function makeRow(frame, time, person, emotions) {
    return {
        frame,
        time,
        person,
        emotions: emotions.map((e) => ({ ...e })),
    };
}

function buildTrack(times, emotionName, scores, person = 0) {
    return times.map((t, i) =>
        makeRow(i, t, person, [{ name: emotionName, score: scores[i] }])
    );
}

console.log("Test 1: constant input → constant output");
{
    const filter = new StateFilter(3.0);
    const rows = buildTrack(
        Array.from({ length: 30 }, (_, i) => i * 0.33),
        "Joy",
        Array.from({ length: 30 }, () => 0.5)
    );
    filter.apply(rows);
    let ok = true;
    for (const r of rows) {
        if (!approxEq(r.emotions[0].score, 0.5, 1e-9)) ok = false;
    }
    check(ok, "all 30 scores preserved within 1e-9");
}

console.log("Test 2: step input → critical-damped ramp, no overshoot");
{
    const filter = new StateFilter(3.0);
    const dt = 0.33;
    const times = Array.from({ length: 65 }, (_, i) => i * dt);
    const scores = times.map((_, i) => (i < 5 ? 0.0 : 1.0));
    const rows = buildTrack(times, "Joy", scores);
    filter.apply(rows);

    const filtered = rows.map((r) => r.emotions[0].score);

    // Pre-step: state stays at 0
    let preOk = true;
    for (let i = 0; i < 5; i++) {
        if (!approxEq(filtered[i], 0.0, 1e-12)) preOk = false;
    }
    check(preOk, "pre-step values exactly 0");

    // Post-step: monotone non-decreasing, no overshoot above 1
    let monoOk = true;
    let noOver = true;
    for (let i = 6; i < filtered.length; i++) {
        if (filtered[i] < filtered[i - 1] - 1e-12) monoOk = false;
        if (filtered[i] > 1.0 + 1e-12) noOver = false;
    }
    check(monoOk, "post-step ramp is monotone non-decreasing");
    check(noOver, "no overshoot above 1.0");

    // Tail approaches 1
    // Tail residual after N samples is (1 + N·dt/τ)·exp(−N·dt/τ); at
    // 60 post-step samples with dt=0.33, τ=3.0 → tail ≈ 0.99, so 0.98 is
    // the right threshold for "approaches 1".
    check(
        filtered[filtered.length - 1] > 0.98,
        `tail reaches ≥0.98 (got ${filtered[filtered.length - 1].toFixed(4)})`
    );
}

console.log("Test 3: single-frame impulse → small bounded deflection");
{
    const filter = new StateFilter(3.0);
    const dt = 0.33;
    const n = 40;
    const times = Array.from({ length: n }, (_, i) => i * dt);
    const scores = times.map((_, i) => (i === 5 ? 1.0 : 0.0));
    const rows = buildTrack(times, "Joy", scores);
    filter.apply(rows);
    const filtered = rows.map((r) => r.emotions[0].score);

    // The impulse sample itself writes-through (first-sight semantics don't
    // apply here — track was seeded by earlier zeros, so the impulse is just
    // a measurement update). State rises a bit, then decays back toward 0.
    let peak = 0;
    let peakIdx = 0;
    for (let i = 5; i < n; i++) {
        if (filtered[i] > peak) {
            peak = filtered[i];
            peakIdx = i;
        }
    }
    check(peak > 0 && peak <= 1.0 + 1e-12, `peak in (0, 1] (got ${peak.toFixed(4)})`);
    check(filtered[n - 1] < peak * 0.5, `tail decays below half-peak (tail=${filtered[n - 1].toFixed(4)}, peak=${peak.toFixed(4)})`);
    check(peakIdx >= 5 && peakIdx < n, `peak occurs at or after the impulse`);
}

console.log("Test 4: two interleaved tracks don't contaminate");
{
    const filter = new StateFilter(3.0);
    const dt = 0.33;
    const rows = [];
    for (let i = 0; i < 30; i++) {
        const t = i * dt;
        // track 0 at score=1.0, track 1 at score=0.0, interleaved by frame
        rows.push(makeRow(i, t, 0, [{ name: "Joy", score: 1.0 }]));
        rows.push(makeRow(i, t + 0.001, 1, [{ name: "Joy", score: 0.0 }]));
    }
    filter.apply(rows);
    let ok = true;
    for (const r of rows) {
        const expected = r.person === 0 ? 1.0 : 0.0;
        if (!approxEq(r.emotions[0].score, expected, 1e-9)) ok = false;
    }
    check(ok, "track 0 stays at 1.0, track 1 stays at 0.0");
}

console.log("Test 5: per-emotion τ — Joy settles faster than Boredom");
{
    const config = { Joy: 0.3, Boredom: 3.0, default: 1.0 };
    const dt = 0.33;
    const times = Array.from({ length: 30 }, (_, i) => i * dt);
    const scores = times.map((_, i) => (i < 5 ? 0.0 : 1.0));

    const joyFilter = new StateFilter(config);
    const joyRows = buildTrack(times, "Joy", scores, 0);
    joyFilter.apply(joyRows);

    const boredomFilter = new StateFilter(config);
    const boredomRows = buildTrack(times, "Boredom", scores, 0);
    boredomFilter.apply(boredomRows);

    // 8 samples after the step (~2.6s)
    const idx = 5 + 8;
    const joy = joyRows[idx].emotions[0].score;
    const boredom = boredomRows[idx].emotions[0].score;
    check(
        joy - boredom >= 0.2,
        `Joy ${joy.toFixed(3)} − Boredom ${boredom.toFixed(3)} ≥ 0.2`
    );
}

console.log("Test 6 (Tracker): IoU greedy matching across frames");
{
    const tracker = new Tracker();
    // Two persons across 3 frames; boxes shift slightly each frame.
    const fps = 3;
    const rows = [];
    for (let f = 0; f < 3; f++) {
        rows.push({
            frame: f,
            time: f / fps,
            box: { x: 100 + f * 2, y: 100, w: 80, h: 80 },
            emotions: [],
        });
        rows.push({
            frame: f,
            time: f / fps,
            box: { x: 500 + f * 2, y: 100, w: 80, h: 80 },
            emotions: [],
        });
    }
    tracker.assign(rows, null);
    // Rows from frame 0 should pick up persons 0 and 1 (in some order).
    // Subsequent frames must reuse those two IDs.
    const ids = new Set(rows.map((r) => r.person));
    check(ids.size === 2, `exactly 2 distinct track IDs (got ${ids.size})`);

    // Per frame, IDs should be {0, 1}
    let perFrameOk = true;
    for (let f = 0; f < 3; f++) {
        const frameIds = rows.filter((r) => r.frame === f).map((r) => r.person);
        if (new Set(frameIds).size !== 2) perFrameOk = false;
    }
    check(perFrameOk, "each frame has both persons");
}

console.log("Test 7 (Tracker): bboxIoU correctness");
{
    check(approxEq(bboxIoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 }), 1.0, 1e-9), "identical boxes IoU=1");
    check(bboxIoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 100, w: 10, h: 10 }) === 0, "disjoint boxes IoU=0");
    const iou = bboxIoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 });
    check(approxEq(iou, 50 / 150, 1e-9), `half-overlap IoU=${(50 / 150).toFixed(4)} (got ${iou.toFixed(4)})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
