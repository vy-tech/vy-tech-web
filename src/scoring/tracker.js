// H019 Tracker — assigns stable `person` IDs to detection rows that lack them.
//
// Two paths:
//   1. If every row already has a numeric `person` (local ves output), the
//      existing IDs are treated as authoritative and we only run signature
//      cross-chunk re-id (when signatures are present on both sides).
//   2. Otherwise (Hume API path; no person field), we run greedy bbox-IoU
//      matching per consecutive-frame pair to build stable IDs within the
//      chunk.
//
// Tracker state (`nextTrackId`, `priorSignatures`) is instance-level and
// carries across chunks so cross-chunk signature re-id has something to
// match against. Call reset() at the start of a fresh scoring run.

const DEFAULT_IOU_THRESHOLD = 0.3;
const DEFAULT_TIME_GAP_S = 0.5;
const DEFAULT_SIGNATURE_THRESHOLD = 0.7;

export class Tracker {
    constructor({
        iouThreshold = DEFAULT_IOU_THRESHOLD,
        timeGapS = DEFAULT_TIME_GAP_S,
        signatureThreshold = DEFAULT_SIGNATURE_THRESHOLD,
    } = {}) {
        this.iouThreshold = iouThreshold;
        this.timeGapS = timeGapS;
        this.signatureThreshold = signatureThreshold;
        this.nextTrackId = 0;
        this.priorSignatures = null;
        this.chunkOffsets = new Map();
    }

    reset() {
        this.nextTrackId = 0;
        this.priorSignatures = null;
        this.chunkOffsets = new Map();
    }

    assign(rows, chunkSignatures = null, chunkKey = null) {
        if (!rows || rows.length === 0) return rows;

        const allHavePerson = rows.every(
            (r) => typeof r.person === "number"
        );

        if (!allHavePerson) {
            this._assignByIoU(rows);
        } else {
            this._namespaceChunkIds(rows, chunkKey);
        }

        if (chunkSignatures && this.priorSignatures) {
            const current = decodeSignatures(chunkSignatures);
            this._reidBySignature(rows, current);
            this.priorSignatures = current;
        } else if (chunkSignatures) {
            this.priorSignatures = decodeSignatures(chunkSignatures);
        }

        return rows;
    }

    // Shift a chunk's pass-through `person` IDs into a globally-unique range.
    //
    // The pipeline processes chunks in parallel, so its IDs are only unique
    // *within* a chunk — chunk 2's person 5 is a different human than chunk
    // 1's person 5. Left alone, ActiveBoxManager matches them by ID and
    // teleports one track across the frame. Offsets are drawn from the same
    // `nextTrackId` counter `_assignByIoU` uses, so the two paths can't
    // collide, and within-chunk identity is preserved exactly.
    //
    // Memoized per chunk so reloading one (seek, rewind) reproduces the same
    // IDs instead of burning a fresh range. The first chunk gets offset 0, so
    // single-chunk videos are unchanged.
    //
    // This is a uniqueness fix, not re-identification: the same human across
    // two chunks still gets two IDs. Stitching those together is what the
    // signature re-id path (and the pipeline's person hash) is for.
    _namespaceChunkIds(rows, chunkKey) {
        if (!chunkKey) return;

        let offset = this.chunkOffsets.get(chunkKey);
        if (offset === undefined) {
            offset = this.nextTrackId;
            let maxId = -1;
            for (const row of rows) {
                if (row.person > maxId) maxId = row.person;
            }
            this.nextTrackId = offset + maxId + 1;
            this.chunkOffsets.set(chunkKey, offset);
        }

        if (offset === 0) return;
        for (const row of rows) row.person += offset;
    }

    _assignByIoU(rows) {
        // Group rows by frame
        const framesMap = new Map();
        for (const row of rows) {
            if (!framesMap.has(row.frame)) framesMap.set(row.frame, []);
            framesMap.get(row.frame).push(row);
        }
        const frames = [...framesMap.keys()].sort((a, b) => a - b);

        // active: Map<trackId, {lastTime, lastBox}>
        const active = new Map();

        for (const frame of frames) {
            const frameRows = framesMap.get(frame);
            frameRows.sort((a, b) => a.time - b.time);
            const refTime = frameRows[0].time;

            // Candidate active tracks within timeGapS of this frame
            const candidates = [];
            for (const [trackId, info] of active.entries()) {
                if (refTime - info.lastTime <= this.timeGapS) {
                    candidates.push({
                        trackId,
                        lastBox: info.lastBox,
                    });
                }
            }

            // All (row, candidate) IoU pairs above threshold
            const pairs = [];
            for (let ri = 0; ri < frameRows.length; ri++) {
                for (let ci = 0; ci < candidates.length; ci++) {
                    const iou = bboxIoU(
                        frameRows[ri].box,
                        candidates[ci].lastBox
                    );
                    if (iou >= this.iouThreshold) {
                        pairs.push({ ri, ci, iou });
                    }
                }
            }
            // Greedy by descending IoU
            pairs.sort((a, b) => b.iou - a.iou);
            const usedRows = new Set();
            const usedCands = new Set();
            for (const p of pairs) {
                if (usedRows.has(p.ri) || usedCands.has(p.ci)) continue;
                usedRows.add(p.ri);
                usedCands.add(p.ci);
                const row = frameRows[p.ri];
                const cand = candidates[p.ci];
                row.person = cand.trackId;
                active.set(cand.trackId, {
                    lastTime: row.time,
                    lastBox: row.box,
                });
            }

            // Unmatched rows get fresh track IDs
            for (let ri = 0; ri < frameRows.length; ri++) {
                if (usedRows.has(ri)) continue;
                const row = frameRows[ri];
                const trackId = this.nextTrackId++;
                row.person = trackId;
                active.set(trackId, {
                    lastTime: row.time,
                    lastBox: row.box,
                });
            }

            // Prune stale tracks
            for (const [trackId, info] of active.entries()) {
                if (refTime - info.lastTime > this.timeGapS) {
                    active.delete(trackId);
                }
            }
        }
    }

    _reidBySignature(rows, current) {
        const currentIds = [...current.keys()];
        const priorIds = [...this.priorSignatures.keys()];
        if (currentIds.length === 0 || priorIds.length === 0) return;

        // Best prior for each current, best current for each prior
        const bestForCurrent = new Map();
        const bestForPrior = new Map();
        for (const ci of currentIds) {
            const cv = current.get(ci);
            for (const pi of priorIds) {
                const pv = this.priorSignatures.get(pi);
                const s = cosineSim(cv, pv);
                const bc = bestForCurrent.get(ci);
                if (!bc || s > bc.sim) {
                    bestForCurrent.set(ci, { pi, sim: s });
                }
                const bp = bestForPrior.get(pi);
                if (!bp || s > bp.sim) {
                    bestForPrior.set(pi, { ci, sim: s });
                }
            }
        }

        // Mutual-best ≥ threshold
        const remap = new Map();
        for (const ci of currentIds) {
            const best = bestForCurrent.get(ci);
            if (!best || best.sim < this.signatureThreshold) continue;
            const reverse = bestForPrior.get(best.pi);
            if (reverse && reverse.ci === ci) {
                remap.set(ci, best.pi);
            }
        }

        if (remap.size === 0) return;
        for (const row of rows) {
            if (remap.has(row.person)) row.person = remap.get(row.person);
        }
    }
}

export function bboxIoU(a, b) {
    if (!a || !b) return 0;
    const ix1 = Math.max(a.x, b.x);
    const iy1 = Math.max(a.y, b.y);
    const ix2 = Math.min(a.x + a.w, b.x + b.w);
    const iy2 = Math.min(a.y + a.h, b.y + b.h);
    const iw = Math.max(0, ix2 - ix1);
    const ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    if (inter <= 0) return 0;
    const union = a.w * a.h + b.w * b.h - inter;
    return union > 0 ? inter / union : 0;
}

export function decodeSignatureCentroid(b64) {
    const raw = atob(b64);
    const buf = new Int8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        // int8 sign-extend: charCodeAt gives 0..255; shift maps high bytes negative.
        buf[i] = (raw.charCodeAt(i) << 24) >> 24;
    }
    const v = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) v[i] = buf[i] / 127.0;
    let n = 0;
    for (let i = 0; i < v.length; i++) n += v[i] * v[i];
    n = Math.sqrt(n);
    if (n < 1e-8) return v;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
}

export function cosineSim(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
}

function decodeSignatures(chunkSignatures) {
    const out = new Map();
    for (const sig of chunkSignatures) {
        if (!sig.signature || !sig.signature.centroid_b64) continue;
        out.set(
            sig.track_id,
            decodeSignatureCentroid(sig.signature.centroid_b64)
        );
    }
    return out;
}
