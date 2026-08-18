import { chunksData } from "./chunk.js";
import { profilesData } from "./profiles.js";
import { Score } from "../scoring/scoring.js";
import { Tracker } from "../scoring/tracker.js";
import { Hierarchy } from "../util/hierarchy.js";

// Default width of one scrub step, in seconds. Detections arrive ~3/sec, so a
// few seconds is enough to have seen everyone present without smearing across
// real movement.
const DEFAULT_WINDOW_SECONDS = 4;

/**
 * Load expression detections for a hierarchy over a time range, addressed
 * through the chunks API rather than an HLS playlist.
 *
 * The playback path discovers expression URLs by parsing them off the HLS
 * fragment init-segment query string (Score.createLoadSchedule) — that is built
 * around a single player driving a single camera, and needs a playlist load per
 * camera just to learn where the JSON lives. Chunk docs already carry
 * `expressionsPath` + `storage`, so any consumer that isn't a player (the chat
 * crowd map, offline analysis) can go straight to the data.
 *
 * Chunks are one minute long and keyed by `minuteOfDay`; video time is mapped
 * onto that axis via the first chunk's `creationTime`, matching the convention
 * in src/ga/scenario.js.
 */
class ExpressionsData {
    constructor() {
        // hierarchy string -> Promise<chunks[]>. The promise (not the result)
        // is cached so concurrent per-camera loads share one Firestore query.
        this.chunkCache = new Map();
    }

    async getChunks(hierarchy) {
        if (!(hierarchy instanceof Hierarchy)) {
            hierarchy = new Hierarchy(hierarchy);
        }
        const key = hierarchy.toString();

        if (!this.chunkCache.has(key)) {
            this.chunkCache.set(
                key,
                chunksData.getByHierarchy(hierarchy).then((chunks) => {
                    chunks = chunks || [];
                    chunks.sort((a, b) => a.minuteOfDay - b.minuteOfDay);
                    return chunks;
                })
            );
        }
        return await this.chunkCache.get(key);
    }

    clearCache() {
        this.chunkCache.clear();
    }

    // Video time (seconds from event start) -> minuteOfDay.
    minuteOfDayFor(firstCreationTime, videoTime) {
        const start = new Date(firstCreationTime);
        const target = new Date(start.getTime() + videoTime * 1000);
        return target.getUTCHours() * 60 + target.getUTCMinutes();
    }

    // A chunk's start offset, in video-time seconds from the event start.
    chunkOffset(firstCreationTime, chunkCreationTime) {
        return (
            (new Date(chunkCreationTime) - new Date(firstCreationTime)) / 1000.0
        );
    }

    /**
     * Detection rows for [startTime, endTime] on one hierarchy (camera
     * included). Rows carry `time` on the event clock and, when a scoring
     * profile is loaded, a computed `score`.
     *
     * @param {Hierarchy|string} hierarchy
     * @param {number} startTime seconds from event start
     * @param {number} endTime seconds from event start
     * @param {number} maxRows soft cap on rows returned; chunks are evenly
     *   sampled to stay under it so a wide range can't balloon memory.
     */
    async loadRange(hierarchy, startTime, endTime, maxRows = 4000) {
        const chunks = await this.getChunks(hierarchy);
        if (!chunks.length) return [];

        if (endTime < startTime) [startTime, endTime] = [endTime, startTime];

        const first = chunks[0].creationTime;
        const startMinute = this.minuteOfDayFor(first, startTime);
        const endMinute = this.minuteOfDayFor(first, endTime);

        const wanted = chunks.filter(
            (c) => c.minuteOfDay >= startMinute && c.minuteOfDay <= endMinute
        );
        if (!wanted.length) return [];

        // Budget the cap across the chunks we're about to read, so the result
        // is bounded regardless of how wide the requested range is.
        const perChunkCap = Math.max(1, Math.floor(maxRows / wanted.length));

        const scoring = new Score();
        const profile = profilesData.profile;
        const out = [];

        for (const chunk of wanted) {
            const url = chunk.getExpressionsUrl && chunk.getExpressionsUrl();
            if (!url) continue;

            // A chunk's full row set is transient — it is filtered and sampled
            // here, and goes out of scope before the next chunk is read.
            const rows = await scoring.loadDetections(url);
            if (!rows || !rows.length) continue;

            scoring.applyTime(rows, this.chunkOffset(first, chunk.creationTime));

            // applyProfile computes row.score (and rescales emotion.score in
            // place). Without a loaded profile it would throw on
            // `profile.emotions`, so skip it and let consumers fall back to
            // their own scoring of the untouched emotions.
            if (profile && profile.emotions) {
                scoring.applyProfile(rows, profile);
            }

            // A zero-width request (endTime omitted, so end === start) can't be
            // served by a range filter: row.time is frame/fps + chunkOffset and
            // will essentially never equal the requested second exactly. Snap
            // to the single nearest frame instead — that's the "instant" case.
            const selected =
                endTime > startTime
                    ? rows.filter(
                          (row) => row.time >= startTime && row.time <= endTime
                      )
                    : this.nearestFrame(rows, startTime);

            out.push(...this.sample(selected, perChunkCap));
        }

        return out;
    }

    /**
     * Detections for [startTime, endTime] as a sequence of time windows, with
     * each person collapsed to a single entry per window.
     *
     * This is the scrubbing/animation shape. Flattening a span into one cloud
     * plots every per-frame detection, so one person visible for a minute
     * becomes ~180 dots — not a headcount, and because depth is derived from
     * box height, per-frame height jitter smears them along the camera axis.
     * Bucketing by window and averaging each person's boxes fixes both: one
     * dot per person, and an averaged box height that damps the jitter.
     *
     * Stable `person` IDs are carried through so the view can animate a person
     * between windows rather than popping. Note the tracker only guarantees
     * identity *within* a chunk (one minute), so IDs change across a chunk
     * boundary — see Tracker._namespaceChunkIds.
     *
     * @returns {Promise<Array>} [{ index, time, people: [{id, box, score, detections}] }]
     */
    async loadWindows(
        hierarchy,
        startTime,
        endTime,
        windowSeconds = DEFAULT_WINDOW_SECONDS,
        maxRows = 20000
    ) {
        const chunks = await this.getChunks(hierarchy);
        if (!chunks.length) return [];

        if (endTime < startTime) [startTime, endTime] = [endTime, startTime];

        const first = chunks[0].creationTime;
        const startMinute = this.minuteOfDayFor(first, startTime);
        const endMinute = this.minuteOfDayFor(first, endTime);

        const wanted = chunks.filter(
            (c) => c.minuteOfDay >= startMinute && c.minuteOfDay <= endMinute
        );
        if (!wanted.length) return [];

        const scoring = new Score();
        const profile = profilesData.profile;
        // One tracker across all chunks so its per-chunk ID namespacing keeps
        // IDs globally unique for this load.
        //
        // timeGapS is raised from the 0.5s default because that default is
        // tuned for consecutive video frames, not detection cadence. Rows here
        // arrive ~0.33s apart (p50 0.33s, max 0.65s in the samples), so one
        // missed detection puts a person's next sighting ~0.66s out — past
        // 0.5s — and their track breaks. Measured over both samples, going
        // 0.5 -> 2.0 cuts distinct tracks roughly in half (calm-few 166 -> 87,
        // cheering-many 2880 -> 1313) and plateaus after that.
        const tracker = new Tracker({ timeGapS: 2.0 });
        const perChunkCap = Math.max(1, Math.floor(maxRows / wanted.length));

        // window index -> Map(personId -> accumulator)
        const windows = new Map();

        for (const chunk of wanted) {
            const url = chunk.getExpressionsUrl && chunk.getExpressionsUrl();
            if (!url) continue;

            const rows = await scoring.loadDetections(url);
            if (!rows || !rows.length) continue;

            scoring.applyTime(rows, this.chunkOffset(first, chunk.creationTime));
            if (profile && profile.emotions) {
                scoring.applyProfile(rows, profile);
            }
            // Assigns `person` by bbox-IoU when the pipeline didn't supply it.
            tracker.assign(rows, null, url);

            const inRange = rows.filter(
                (row) => row.time >= startTime && row.time <= endTime
            );

            for (const row of this.sample(inRange, perChunkCap)) {
                if (!row.box) continue;
                const index = Math.floor(
                    (row.time - startTime) / windowSeconds
                );
                if (!windows.has(index)) windows.set(index, new Map());
                const people = windows.get(index);

                // Rows with no identity can't be collapsed; keep them distinct
                // so they're still drawn rather than merged into one blob.
                const id =
                    typeof row.person === "number"
                        ? row.person
                        : `anon:${row.frame}:${Math.round(row.box.x)}`;

                let person = people.get(id);
                if (!person) {
                    person = {
                        id,
                        x: 0,
                        y: 0,
                        w: 0,
                        h: 0,
                        score: 0,
                        detections: 0,
                    };
                    people.set(id, person);
                }
                person.x += row.box.x;
                person.y += row.box.y;
                person.w += row.box.w;
                person.h += row.box.h;
                person.score += typeof row.score === "number" ? row.score : 0;
                person.detections += 1;
            }
        }

        return [...windows.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([index, people]) => ({
                index,
                time: startTime + index * windowSeconds,
                people: [...people.values()].map((p) => ({
                    id: p.id,
                    // Mean box over the window — collapses the person to one
                    // position and damps per-frame box-height noise.
                    box: {
                        x: p.x / p.detections,
                        y: p.y / p.detections,
                        w: p.w / p.detections,
                        h: p.h / p.detections,
                    },
                    score: p.score / p.detections,
                    detections: p.detections,
                })),
            }));
    }

    /**
     * loadWindows across several cameras, aligned on a shared window index so
     * every step of the sequence is the same slice of time on all cameras.
     * @returns {Promise<Array>} [{ index, time, byCamera: {cam: people[]} }]
     */
    async loadWindowsForCameras(
        hierarchy,
        cameras,
        startTime,
        endTime,
        windowSeconds = DEFAULT_WINDOW_SECONDS,
        maxRows
    ) {
        if (!(hierarchy instanceof Hierarchy)) {
            hierarchy = new Hierarchy(hierarchy);
        }

        const perCamera = await Promise.all(
            cameras.map(async (camera) => {
                const hier = new Hierarchy(hierarchy);
                hier.camera = camera;
                try {
                    const windows = await this.loadWindows(
                        hier,
                        startTime,
                        endTime,
                        windowSeconds,
                        maxRows
                    );
                    return { camera, windows };
                } catch (error) {
                    console.error(
                        `expressions: camera ${camera} failed`,
                        error
                    );
                    return {
                        camera,
                        windows: [],
                        error: String(error.message || error),
                    };
                }
            })
        );

        const byIndex = new Map();
        for (const { camera, windows } of perCamera) {
            for (const window of windows) {
                if (!byIndex.has(window.index)) {
                    byIndex.set(window.index, {
                        index: window.index,
                        time: window.time,
                        byCamera: {},
                    });
                }
                byIndex.get(window.index).byCamera[camera] = window.people;
            }
        }

        const steps = [...byIndex.values()].sort((a, b) => a.index - b.index);
        const errors = perCamera.filter((c) => c.error);
        return { steps, errors };
    }

    // All rows belonging to the frame closest to `time`. One frame is one
    // coherent instant across everyone the camera saw.
    nearestFrame(rows, time) {
        let frame = null;
        let best = Infinity;
        for (const row of rows) {
            const delta = Math.abs(row.time - time);
            if (delta < best) {
                best = delta;
                frame = row.frame;
            }
        }
        return frame === null ? [] : rows.filter((row) => row.frame === frame);
    }

    // Evenly sample an array down to at most `cap` entries. Iterates a fixed
    // count rather than accumulating a float step, which drifts and can
    // overrun the cap by one on some lengths.
    sample(rows, cap) {
        if (rows.length <= cap) return rows;
        const step = rows.length / cap;
        const out = [];
        for (let k = 0; k < cap; k++) {
            out.push(rows[Math.min(rows.length - 1, Math.floor(k * step))]);
        }
        return out;
    }

    /**
     * Load several cameras of one event in parallel.
     * @returns {Promise<Object>} rows keyed by camera number.
     */
    async loadRangeForCameras(hierarchy, cameras, startTime, endTime, maxRows) {
        if (!(hierarchy instanceof Hierarchy)) {
            hierarchy = new Hierarchy(hierarchy);
        }

        const results = await Promise.all(
            cameras.map(async (camera) => {
                const hier = new Hierarchy(hierarchy);
                hier.camera = camera;
                try {
                    const rows = await this.loadRange(
                        hier,
                        startTime,
                        endTime,
                        maxRows
                    );
                    return { camera, rows };
                } catch (error) {
                    // One unavailable camera shouldn't sink the others.
                    console.error(
                        `expressions: camera ${camera} failed`,
                        error
                    );
                    return { camera, rows: [], error: String(error.message || error) };
                }
            })
        );

        const byCamera = {};
        for (const result of results) byCamera[result.camera] = result;
        return byCamera;
    }
}

const expressionsData = new ExpressionsData();

// Exposed for console debugging, matching the window._vy_* convention used by
// eventbus/toolbox/etc. Lets a chunk lookup or a window load be run directly,
// which separates "no chunk data for this hierarchy" from a fault further up.
if (typeof window !== "undefined") {
    window._vy_expressions = expressionsData;
}

export default expressionsData;
export { expressionsData, ExpressionsData };
