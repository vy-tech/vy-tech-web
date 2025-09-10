class Time {
    constructor() {}

    format(seconds, includeSeconds = false) {
        let hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        let minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds - minutes * 60);

        let result =
            hours.toString().padStart(2, "0") +
            ":" +
            minutes.toString().padStart(2, "0");

        if (!includeSeconds) return result;

        return result + ":" + seconds.toString().padStart(2, "0");
    }

    toSeconds(time, isMMSS = false) {
        let parts = time.split(":");
        let seconds = 0;
        let i = 0;

        if (parts.length == 1) {
            return parseFloat(parts);
        } else if (parts.length == 2 && !isMMSS) {
            i = 1;
        } else if (parts.length > 3) {
            throw new Error(`Invalid time ${time}`);
        }

        while (parts.length) {
            let part = parts.pop();
            seconds += parseInt(part) * 60 ** i;
            i += 1;
        }

        return seconds;
    }
}

const timeUtil = new Time();
export default timeUtil;
export { timeUtil, Time };
