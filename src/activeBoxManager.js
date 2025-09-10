import { geom } from "./geom.js";

const EXPIRE_TIME = 5000;

class ActiveBoxManager {
    constructor() {
        this.activeBoxes = [];
    }

    reset() {
        /**
         * Resets the active boxes to an empty array.
         */
        this.activeBoxes = [];
    }

    expire(elapsedMillis) {
        /**
         * Expires boxes from activeBoxes that have not been updated in 10 seconds.
         */
        for (let i = this.activeBoxes.length - 1; i >= 0; i--) {
            const activeBox = this.activeBoxes[i];
            activeBox.expires -= elapsedMillis;
            if (activeBox.expires <= 0) {
                this.activeBoxes.splice(i, 1); // Remove expired box
            }
        }
    }

    update(boxes) {
        /**
         * Updates the active boxes based on the current second,
         * adds any non-overlapping boxes to activeBoxes.
         */

        for (const box of boxes) {
            // Check if the box is already active
            var activeBox = this.activeBoxes.find((activeBox) => {
                if (geom.boxesAreSame(activeBox, box)) {
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
