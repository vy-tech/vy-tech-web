import { eventBus } from "../eventbus.js";
import { geomUtil } from "../util/geom.js";

const EXPIRE_TIME = 5000;

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

    update(boxes) {
        /**
         * Updates the active boxes based on the current second,
         * adds any non-overlapping boxes to activeBoxes.
         */

        for (const box of boxes) {
            // Check if the box is already active
            var activeBox = this.activeBoxes.find((activeBox) => {
                if (geomUtil.boxesAreSame(activeBox, box)) {
                    return activeBox;
                }
            });

            // If the box is already active, update it's position and reset
            // it's expire time.
            if (activeBox) {
                activeBox.x = box.x;
                activeBox.y = box.y;
                activeBox.w = box.w;
                activeBox.h = box.h;
                activeBox.score = box.score / box.count;
                activeBox.expires = EXPIRE_TIME;
                activeBox.index = box.index;
            }
            // If not active, create it and add it to activeBoxes
            // Ensure score is averaged because we're reusing the count
            else {
                activeBox = { ...box };
                activeBox.score = box.score / box.count;
                activeBox.expires = EXPIRE_TIME;
                activeBox.index = box.index;
                this.newBoxCount += 1;

                this.activeBoxes.push(activeBox);
            }
        }
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
