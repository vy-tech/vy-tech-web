class Geometry {
    boxesAreSame(box1, box2, threshold = 0.4) {
        /**
         * Check if two boxes are the same within a threshold.
         * @param {Object} box1 - The first box object.
         * @param {Object} box2 - The second box object.
         * @param {number} threshold - The similarity threshold.
         * @returns {boolean} - True if boxes are similar, false otherwise.
         */
        const [x1, y1, w1, h1] = [box1.x, box1.y, box1.w, box1.h];
        const [x2, y2, w2, h2] = [box2.x, box2.y, box2.w, box2.h];

        // Calculate intersection coordinates
        const xi1 = Math.max(x1, x2);
        const yi1 = Math.max(y1, y2);
        const xi2 = Math.min(x1 + w1, x2 + w2);
        const yi2 = Math.min(y1 + h1, y2 + h2);
        const interWidth = Math.max(0, xi2 - xi1);
        const interHeight = Math.max(0, yi2 - yi1);
        const intersectionArea = interWidth * interHeight;

        const area1 = w1 * h1;
        const area2 = w2 * h2;
        const smallerArea = Math.min(area1, area2);

        // Avoid division by zero
        if (smallerArea === 0) return false;

        const overlapRatio = intersectionArea / smallerArea;
        return overlapRatio >= threshold;
    }

    isPointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
        const area = (x1, y1, x2, y2, x3, y3) =>
            0.5 * Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

        const A = area(x1, y1, x2, y2, x3, y3);
        const A1 = area(px, py, x2, y2, x3, y3);
        const A2 = area(x1, y1, px, py, x3, y3);
        const A3 = area(x1, y1, x2, y2, px, py);

        return A === A1 + A2 + A3;
    }

    findTriangleContainingPoint(x, y, triangles) {
        for (let i = 0; i < triangles.length; i++) {
            const triangle = triangles[i];
            const [x1, y1, x2, y2, x3, y3] = triangle;
            if (this.isPointInTriangle(x, y, x1, y1, x2, y2, x3, y3)) {
                return i + 1; // Return 1-based index
            }
        }
        return null; // No triangle found
    }
}

const geomUtil = new Geometry();
export default geomUtil;
export { geomUtil, Geometry };
