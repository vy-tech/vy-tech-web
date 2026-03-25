class Hierarchy {
    constructor(fromString = null) {
        this.location = null;
        this.date = null;
        this.event = null;
        this.org = null;
        this.camera = null;
        this.file = null;
        this.context = null;

        if (fromString instanceof Hierarchy) {
            this.location = fromString.location;
            this.date = fromString.date;
            this.event = fromString.event;
            this.org = fromString.org;
            this.camera = fromString.camera;
            this.file = fromString.file;
            this.context = fromString.context;
        } else if (fromString) {
            this.parseHierarchyString(fromString);
        }
    }

    parseHierarchyString(hierarchyString) {
        /**
         * $location/$date					    - length=2, ends with number
         * $org/$file					        - length=2, both are strings
         * $org/$context/$file                  - length=3, last is string
         * $location/$date/$camera				- length=3, ends with number
         * $org/$location/$date/$event			- length=4, ends with string
         * $org/$location/$date/$camera		    - length=4, ends with number
         * $org/$location/$date/$event/$camera	- length=5, ends with number
         * $org/$location/$date/$event/$file	- length=5, ends with string
         * $key=$val/...					    - length=n, all vals contain equals
         **/
        let parts = hierarchyString.split(/(?<!\\)[\-\:\/]/);
        parts = parts.map((p) => p.replace(/\\([\-:\/])/g, "$1"));

        if (parts.every((p) => p.includes("="))) {
            for (const part of parts) {
                const eqIdx = part.indexOf("=");
                this[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
            }
        } else if (parts.length === 2) {
            if (/^\d+$/.test(parts[1])) {
                this.location = parts[0];
                this.date = parseInt(parts[1]);
            } else {
                this.org = parts[0];
                this.file = parts[1];
            }
        } else if (
            parts.length === 3 &&
            /^\d+$/.test(parts[1]) &&
            /^\d+$/.test(parts[2])
        ) {
            this.location = parts[0];
            this.date = parseInt(parts[1]);
            this.camera = parseInt(parts[2]);
        } else if (parts.length === 3) {
            this.org = parts[0];
            this.context = parts[1];
            this.file = parts[2];
        } else if (parts.length === 4) {
            if (/^\d+$/.test(parts[3])) {
                this.org = parts[0];
                this.location = parts[1];
                this.date = parseInt(parts[2]);
                this.camera = parseInt(parts[3]);
            } else {
                this.org = parts[0];
                this.location = parts[1];
                this.date = parseInt(parts[2]);
                this.event = parts[3];
            }
        } else if (parts.length === 5) {
            this.org = parts[0];
            this.location = parts[1];
            this.date = parseInt(parts[2]);
            this.event = parts[3];
            if (/^\d+$/.test(parts[4])) {
                this.camera = parseInt(parts[4]);
            } else {
                this.file = parts[4];
            }
        } else if (parts.length === 6) {
            this.org = parts[0];
            this.location = parts[1];
            this.date = parseInt(parts[2]);
            this.event = parts[3];
            this.context = parts[4];
            this.file = parts[5];
        }
    }

    escapePart(part) {
        return part.replace(/([\-:\/])/g, "\\$1");
    }

    toString(separator = ":") {
        if (this.file) {
            return this.toFileString(separator);
        } else if (this.camera) {
            return this.toCameraString(separator);
        } else {
            return this.toEventString(separator);
        }
    }

    toFileString(separator = ":") {
        if (this.location && this.event) {
            return [
                this.location,
                this.date,
                this.event,
                this.escapePart(this.file),
            ].join(separator);
        } else if (this.context) {
            return [this.org, this.context, this.escapePart(this.file)].join(
                separator
            );
        } else {
            return [this.org, this.escapePart(this.file)].join(separator);
        }
    }

    toCameraString(separator = ":", defaultCamera = 1) {
        let cam = (this.camera || defaultCamera).toString().padStart(2, "0");

        if (this.org && this.event) {
            return [this.org, this.location, this.date, this.event, cam].join(
                separator
            );
        } else if (this.org) {
            return [this.org, this.location, this.date, cam].join(separator);
        } else {
            return [this.location, this.date, cam].join(separator);
        }
    }

    toEventString(separator = ":") {
        if (this.org && this.event) {
            return [this.org, this.location, this.date, this.event].join(
                separator
            );
        } else {
            return [this.location, this.date].join(separator);
        }
    }

    toFileOrEventString(separator = ":") {
        if (this.file) {
            return this.toFileString(separator);
        } else {
            return this.toEventString(separator);
        }
    }

    static test() {
        let passed = 0;
        let failed = 0;

        function assert(label, actual, expected) {
            if (actual === expected) {
                console.log(`  ✓ ${label}`);
                passed++;
            } else {
                console.error(
                    `  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
                );
                failed++;
            }
        }

        function test(label, input, expectedFields) {
            console.log(`${label}: "${input}"`);
            const h = new Hierarchy(input);
            for (const [key, val] of Object.entries(expectedFields)) {
                assert(key, h[key], val);
            }
        }

        // $location/$date — length=2, ends with number
        test("location/date", "MainStreet/20240101", {
            location: "MainStreet",
            date: 20240101,
            org: null,
            event: null,
            camera: null,
            file: null,
        });

        // $org/$file — length=2, both strings
        test("org/file", "AcmeCorp/game.mp4", {
            org: "AcmeCorp",
            file: "game.mp4",
            location: null,
            date: null,
            event: null,
            camera: null,
        });

        // $location/$date/$camera — length=3, ends with number
        test("location/date/camera", "MainStreet/20240101/2", {
            location: "MainStreet",
            date: 20240101,
            camera: 2,
            org: null,
            event: null,
            file: null,
        });

        // $org/$location/$date/$event — length=4, ends with string
        test("org/location/date/event", "AcmeCorp/MainStreet/20240101/Finals", {
            org: "AcmeCorp",
            location: "MainStreet",
            date: 20240101,
            event: "Finals",
            camera: null,
            file: null,
        });

        // $org/$location/$date/$camera — length=4, ends with number
        test("org/location/date/camera", "AcmeCorp/MainStreet/20240101/3", {
            org: "AcmeCorp",
            location: "MainStreet",
            date: 20240101,
            camera: 3,
            event: null,
            file: null,
        });

        // $org/$location/$date/$event/$camera — length=5, ends with number
        test(
            "org/location/date/event/camera",
            "AcmeCorp/MainStreet/20240101/Finals/2",
            {
                org: "AcmeCorp",
                location: "MainStreet",
                date: 20240101,
                event: "Finals",
                camera: 2,
                file: null,
            }
        );

        // $org/$location/$date/$event/$file — length=5, ends with string
        test(
            "org/location/date/event/file",
            "AcmeCorp/MainStreet/20240101/Finals/clip.mp4",
            {
                org: "AcmeCorp",
                location: "MainStreet",
                date: 20240101,
                event: "Finals",
                file: "clip.mp4",
                camera: null,
            }
        );

        // $key=$val/... — all parts contain equals
        test(
            "key=val pairs",
            "org=AcmeCorp/location=MainStreet/date=20240101",
            {
                org: "AcmeCorp",
                location: "MainStreet",
                date: "20240101",
            }
        );

        console.log(`\n${passed} passed, ${failed} failed`);
        return failed === 0;
    }
}

if (typeof window !== "undefined") {
    window.Hierarchy = Hierarchy;
}
export default Hierarchy;
export { Hierarchy };
