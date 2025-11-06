class MagicBoxTool {
    constructor() {}

    get name() {
        return "magic_box";
    }
    get description() {
        return "Get the current number from the magic box";
    }
    get parameters() {
        return null;
    }

    get supportsCursors() {
        return false;
    }

    async invoke(args = {}) {
        return Math.floor(Math.random() * 100);
    }
}
export default MagicBoxTool;
export { MagicBoxTool };
