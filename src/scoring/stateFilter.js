// H019 StateFilter — per-(track, emotion) 2nd-order critically-damped
// state-space filter, integrated with the exact closed-form step of
//
//     ÿ + 2ω·ẏ + ω²·y = 0    where y = state − measurement
//
// Critical damping (ζ = 1) is fixed; the only knob is τ (per emotion). The
// exact step is unconditionally stable for any dt and keeps the state within
// the convex hull of measurements (no overshoot). First sight of a
// (track, emotion) pair writes through unchanged — no cold-start transient.
//
// State (the per-(track, emotion) map) carries across chunks within a single
// scoring run so the chunk-edge initialization transient dissolves. Call
// reset() at the start of a fresh scoring run.

import { DEFAULT_FILTER_CONFIG } from "./filterConfig.js";

export class StateFilter {
    constructor(tauConfig = null) {
        this.setTau(tauConfig);
        // state: Map<trackId, Map<emotionName, {s, v, t}>>
        this.state = new Map();
    }

    reset() {
        this.state = new Map();
    }

    setTau(tauConfig) {
        if (typeof tauConfig === "number") {
            this.tauDefault = tauConfig;
            this.tauPerEmotion = null;
        } else if (tauConfig && typeof tauConfig === "object") {
            this.tauDefault = tauConfig.default ?? 1.0;
            this.tauPerEmotion = tauConfig;
        } else {
            this.tauDefault = DEFAULT_FILTER_CONFIG.default;
            this.tauPerEmotion = DEFAULT_FILTER_CONFIG;
        }
    }

    tauFor(emotionName) {
        if (
            this.tauPerEmotion &&
            Object.prototype.hasOwnProperty.call(this.tauPerEmotion, emotionName)
        ) {
            return this.tauPerEmotion[emotionName];
        }
        return this.tauDefault;
    }

    apply(rows) {
        if (!rows || rows.length === 0) return rows;

        // Group rows by trackId
        const byTrack = new Map();
        for (const row of rows) {
            const tid = row.person;
            if (tid === undefined || tid === null) continue;
            if (!byTrack.has(tid)) byTrack.set(tid, []);
            byTrack.get(tid).push(row);
        }

        for (const [trackId, trackRows] of byTrack.entries()) {
            trackRows.sort((a, b) => a.time - b.time);
            this._filterTrack(trackId, trackRows);
        }

        return rows;
    }

    _filterTrack(trackId, trackRows) {
        if (!this.state.has(trackId)) this.state.set(trackId, new Map());
        const trackState = this.state.get(trackId);

        for (const row of trackRows) {
            const t = row.time;
            if (!Array.isArray(row.emotions)) continue;
            for (const emotion of row.emotions) {
                const name = emotion.name;
                const measurement = emotion.score;
                const tau = this.tauFor(name);
                const omega = 1.0 / tau;

                const prev = trackState.get(name);
                if (!prev) {
                    trackState.set(name, { s: measurement, v: 0, t });
                    continue;
                }

                const dt = Math.abs(t - prev.t);
                const y0 = prev.s - measurement;
                const b = prev.v + omega * y0;
                const decay = Math.exp(-omega * dt);
                const y1 = (y0 + b * dt) * decay;
                const vNew =
                    decay *
                    (prev.v * (1 - omega * dt) - omega * omega * y0 * dt);
                const sNew = measurement + y1;

                emotion.score = sNew;
                trackState.set(name, { s: sNew, v: vNew, t });
            }
        }
    }
}
