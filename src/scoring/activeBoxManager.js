import { eventBus } from "../eventbus.js";
import { geomUtil } from "../util/geom.js";

const EXPIRE_TIME = 5000;

// The pipeline represents "couldn't compute this" as an explicit null rather
// than by omitting the key (see `pose` in docs/sample-expressions.json: the
// key is present on every row, null on the ones without data). So a guard
// must reject null as well as undefined, or a null overwrites good data.
function hasValue(v) {
    return v !== undefined && v !== null;
}

// Silhouette payloads arrive as a flat coordinate array. Treat null, absent,
// and empty-array alike as "this frame carried no outline" so none of them
// clobber the last good shape.
function hasSilhouetteData(v) {
    return Array.isArray(v) && v.length > 0;
}

class ActiveBoxManager {
    constructor() {
        this.activeBoxes = [];

        this.volatilityPeriod = 0;
        this.newBoxCount = 0;
        this.lostBoxCount = 0;

        this.newVolatility = 0;
        this.lostVolatility = 0;
        this.totalVolatility = 0;

        eventBus.addEventListener("scoring.timeUpdate", (e) => {
            this.expire(e.detail.elapsedMillis);
            this.calculateVolatility(e.detail.elapsedMillis);
        });

        eventBus.addEventListener("scoring.timeSeek", (e) => {
            this.reset();
        });
    }

    reset() {
        /**
         * Resets the active boxes to an empty array.
         */
        this.activeBoxes = [];
        this.volatilityPeriod = -1000;
        this.newBoxCount = 0;
        this.lostBoxCount = 0;
        this.newVolatility = 0;
        this.lostVolatility = 0;
        this.totalVolatility = 0;
    }

    calculateVolatility(millis) {
        this.volatilityPeriod += millis;

        // On seek all the boxes are new so we'll need
        // some time to stabilize before calculating volatility
        // again.
        if (this.volatilityPeriod < 0) {
            this.newBoxCount = 0;
            this.lostBoxCount = 0;
        }
        // Calulate new, lost and total volatility
        else if (this.volatilityPeriod >= 1000) {
            this.newVolatility = this.newBoxCount / this.activeBoxes.length;
            this.lostVolatility = this.lostBoxCount / this.activeBoxes.length;
            this.totalVolatility =
                (this.newBoxCount + this.lostBoxCount) /
                this.activeBoxes.length;

            // console.log(
            //     `Volatility (new, lost, total): (${this.newVolatility.toFixed(
            //         2
            //     )}, ${this.lostVolatility.toFixed(
            //         2
            //     )}, ${this.totalVolatility.toFixed(2)}) over ${
            //         this.volatilityPeriod
            //     }ms`
            // );
            // Reset counts and period
            this.newBoxCount = 0;
            this.lostBoxCount = 0;
            this.volatilityPeriod = 0;
        }
    }

    expire(elapsedMillis) {
        /**
         * Expires boxes from activeBoxes that have not been updated in 10 seconds.
         */

        for (let i = this.activeBoxes.length - 1; i >= 0; i--) {
            const activeBox = this.activeBoxes[i];

            // If the box has just entered its expiration period
            // count it as lost for volatility calculations
            if (
                !activeBox.markedAsLost &&
                activeBox.expires < EXPIRE_TIME - 1000
            ) {
                this.lostBoxCount += 1;
                activeBox.markedAsLost = true;
            }

            activeBox.expires -= elapsedMillis;

            if (activeBox.expires <= 0) {
                this.activeBoxes.splice(i, 1); // Remove expired box
            }
        }
    }

    // report() {
    //     console.log(`Active boxes: ${this.activeBoxes.length}`);
    //     // Calculate average size of each box
    //     let totalAreas = {
    //         all: 0,
    //         small: 0,
    //         medium: 0,
    //         large: 0,
    //     };
    //     let counts = {
    //         all: 0,
    //         small: 0,
    //         medium: 0,
    //         large: 0,
    //     };

    //     for (const box of this.activeBoxes) {
    //         const area = box.w * box.h;
    //         totalAreas.all += area;
    //         counts.all += 1;

    //         if (box.w <= 50) {
    //             totalAreas.small += area;
    //             counts.small += 1;
    //         } else if (box.w <= 100) {
    //             totalAreas.medium += area;
    //             counts.medium += 1;
    //         } else {
    //             totalAreas.large += area;
    //             counts.large += 1;
    //         }
    //     }

    //     console.log(
    //         `  Average area: ${(totalAreas.all / counts.all).toFixed(
    //             2
    //         )} * (count: ${counts.all})`
    //     );
    //     console.log(
    //         `  Average small area: ${(totalAreas.small / counts.small).toFixed(
    //             2
    //         )} * (count: ${counts.small})`
    //     );
    //     console.log(
    //         `  Average medium area: ${(
    //             totalAreas.medium / counts.medium
    //         ).toFixed(2)} * (count: ${counts.medium})`
    //     );
    //     console.log(
    //         `  Average large area: ${(totalAreas.large / counts.large).toFixed(
    //             2
    //         )} * (count: ${counts.large})`
    //     );
    // }

    matches(a, b) {
        /**
         * Returns true if two boxes are considered the same person.
         *
         * When both boxes carry a `person` ID (newer pipeline data), that
         * is the authoritative signal — two distinct IDs mean two distinct
         * people even if the boxes happen to spatially overlap. When at
         * least one side is missing the ID, fall back to spatial overlap
         * via geomUtil.boxesAreSame (legacy + mixed-data path).
         */
        const aHas = a.person !== undefined && a.person !== null;
        const bHas = b.person !== undefined && b.person !== null;
        if (aHas && bHas) return a.person === b.person;
        return geomUtil.boxesAreSame(a, b);
    }

    update(boxes) {
        /**
         * Updates the active boxes based on the current second,
         * adds any non-overlapping boxes to activeBoxes.
         *
         * Runs in two passes. Callers replay a whole windowSize-second slice
         * of rows on every tick (see Score.updateCurrentFromWindow), so this
         * sees many rows per track per call, in time order.
         */

        // Active boxes claimed during this call. Pass 2 may only adopt a box
        // that pass 1 left unclaimed.
        const touched = new Set();
        const unmatched = [];

        // Pass 1 — identity. Every row gets the chance to claim its own box
        // before any handoff runs. Doing this in a single interleaved pass is
        // wrong: `touched` can only protect boxes already processed, so a new
        // track's early row could adopt an established box whose own row just
        // hadn't been reached yet, and the displaced row would then go adopt
        // someone else's. With the whole window replayed every tick, that
        // churns identities continuously — boxes jumping frame to frame, and
        // sticky state (the silhouette) transferring to the wrong person.
        for (const box of boxes) {
            const activeBox = this.activeBoxes.find((candidate) =>
                this.matches(candidate, box)
            );
            if (activeBox) {
                this.refreshBox(activeBox, box);
                touched.add(activeBox);
            } else {
                unmatched.push(box);
            }
        }

        // Pass 2 — handoff. matches() treats two distinct person IDs as two
        // distinct people. That's right when both are detected at once, but
        // wrong when the pipeline loses a track and re-acquires the same human
        // under a new ID — common under occlusion, and certain at every chunk
        // boundary, since chunks are tracked independently. Left unhandled the
        // stale box lingers for EXPIRE_TIME beside the new one: doubled-up
        // silhouettes.
        //
        // A row nothing claimed that overlaps a box nothing claimed is a
        // handoff, not an arrival — adopt the existing track and take on the
        // new ID. Anything pass 1 claimed is genuinely someone else and is
        // left alone, preserving the ID-authoritative intent where it earns
        // its keep.
        for (const box of unmatched) {
            // Re-check identity first. Pass 1 tested against the box list as
            // it stood then; this pass both creates boxes and reassigns person
            // IDs via adoption, so a later row of the same track has something
            // to match by the time it's reached. Without this, every row of a
            // newly-arrived track spawns its own box — and a window replays
            // ~windowSize * fps rows per track, so that's a pile of duplicates
            // per tick, not just one.
            let activeBox = this.activeBoxes.find((candidate) =>
                this.matches(candidate, box)
            );
            if (!activeBox) {
                activeBox = this.findHandoffCandidate(box, touched);
            }
            if (activeBox) {
                this.refreshBox(activeBox, box);
                touched.add(activeBox);
            } else {
                touched.add(this.createBox(box));
            }
        }
    }

    // Nearest unclaimed overlapping box, or null. Nearest-centre rather than
    // first-found: in a dense crowd several boxes clear the overlap threshold,
    // and picking by array order would hand the track to an arbitrary one.
    findHandoffCandidate(box, touched) {
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        let best = null;
        let bestDist = Infinity;

        for (const candidate of this.activeBoxes) {
            if (touched.has(candidate)) continue;
            if (!geomUtil.boxesAreSame(candidate, box)) continue;
            const d = Math.hypot(
                candidate.x + candidate.w / 2 - cx,
                candidate.y + candidate.h / 2 - cy
            );
            if (d < bestDist) {
                bestDist = d;
                best = candidate;
            }
        }
        return best;
    }

    // Fold a detection into an existing track, in place.
    refreshBox(activeBox, box) {
        activeBox.x = box.x;
        activeBox.y = box.y;
        activeBox.w = box.w;
        activeBox.h = box.h;
        activeBox.score = box.score / box.count;
        activeBox.expires = EXPIRE_TIME;
        activeBox.index = box.index;
        // The box is live again, so re-arm it for the next expiry. Without
        // this a box counts as lost only once per lifetime, undercounting
        // lostVolatility for any track that recovers.
        activeBox.markedAsLost = false;
        // Keep the active box's person ID consistent with the latest
        // detection. If the new detection has no ID, retain what it had.
        if (hasValue(box.person)) {
            activeBox.person = box.person;
        }
        // Refresh per-frame semantic fields, preserving the previous value
        // when a frame carries no data for one (sticky last-known behavior).
        // Matters most for `silhouette`: the synthetic view reads it every
        // paint, and segmentation drops out on individual frames constantly,
        // so without this the shape flickers out and back with no fade — the
        // box itself is alive, so expiry never comes into it.
        if (hasValue(box.cores)) {
            activeBox.cores = box.cores;
        }
        if (hasValue(box.emotion)) {
            activeBox.emotion = box.emotion;
        }
        if (hasSilhouetteData(box.silhouette)) {
            activeBox.silhouette = box.silhouette;
            // Sticky together: the row must be the one that produced the
            // outline we kept, since the renderer walks the chain from it.
            activeBox.silhouetteRow = box.silhouetteRow;
        }
        return activeBox;
    }

    // Start a new track. Score is averaged because we're reusing the count.
    createBox(box) {
        const activeBox = { ...box };
        activeBox.score = box.score / box.count;
        activeBox.expires = EXPIRE_TIME;
        activeBox.index = box.index;
        this.newBoxCount += 1;
        this.activeBoxes.push(activeBox);
        return activeBox;
    }

    getAt(x, y) {
        /**
         * Finds the first active box which contains the point (x, y).
         * @param {number} x - The x coordinate (scaled to original 4K).
         * @param {number} y - The y coordinate (scaled to original 4K).
         * @returns {Object|null}
         **/

        for (const box of this.activeBoxes) {
            if (
                x >= box.x &&
                x < box.x + box.w &&
                y >= box.y &&
                y < box.y + box.h
            ) {
                return box;
            }
        }

        return null;
    }

    get() {
        return this.activeBoxes;
    }
}

const activeBoxManager = new ActiveBoxManager();
export default activeBoxManager;
export { activeBoxManager, ActiveBoxManager };
