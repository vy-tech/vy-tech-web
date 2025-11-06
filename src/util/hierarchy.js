class Hierarchy {
    constructor(fromString = null) {
        if (fromString instanceof Hierarchy) {
            this.parts = [...fromString.parts];
        } else if (fromString) {
            this.parts = fromString.split(/[\-\:]/);
            this.parts[1] = parseInt(this.parts[1]);
            this.parts[2] = parseInt(this.parts[2] || 1);
        } else {
            this.parts = [];
        }
    }

    get location() {
        return this.parts[0] || null;
    }
    set location(value) {
        this.parts[0] = value;
    }

    get date() {
        return this.parts[1] || null;
    }
    set date(value) {
        this.parts[1] = parseInt(value);
    }

    get camera() {
        return this.parts[2] || null;
    }
    set camera(value) {
        this.parts[2] = parseInt(value);
    }

    toString(separator = ":", defaultCamera = 1) {
        let cam = (this.camera || defaultCamera).toString().padStart(2, "0");
        return [this.location, this.date, cam].join(separator);
    }

    toEventString(separator = ":") {
        return [this.location, this.date].join(separator);
    }
}

export default Hierarchy;
export { Hierarchy };
