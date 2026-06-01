// Per-emotion τ configuration for the H019 StateFilter. Values mirror the
// Python testing config verbatim. Fast τ for fast-onset emotions (so the
// filter is near-identity), long τ for the three drift-prone emotions
// (Boredom, Concentration, Confusion), default τ for everything else.
//
// The StateFilter constructor accepts either a number (uniform τ) or this
// object shape; the special key `default` is used for emotions not listed.

export const DEFAULT_FILTER_CONFIG = Object.freeze({
    Joy: 0.3,
    Amusement: 0.3,
    Excitement: 0.3,
    Triumph: 0.3,
    "Surprise (positive)": 0.3,
    Adoration: 0.3,
    Love: 0.3,
    Awe: 0.3,
    Realization: 0.3,
    Interest: 0.3,
    Admiration: 0.3,
    Horror: 0.3,
    Fear: 0.3,
    "Surprise (negative)": 0.3,
    Distress: 0.3,
    Pain: 0.3,
    "Empathic Pain": 0.3,
    Boredom: 3.0,
    Concentration: 3.0,
    Confusion: 3.0,
    default: 1.0,
});
