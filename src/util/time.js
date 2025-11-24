import { eventBus } from "../eventbus.js";
import { DateTime } from "luxon";

class Time {
    constructor() {
        this.wallclockStartTime = null;
        this.playbackTime = 0;
        this.localTimezone = "America/Los_Angeles";

        eventBus.on("playback.loaded", (e) => {
            this.wallclockStartTime = e.detail.wallclockStartTimeUTC;
        });

        eventBus.on("playback.timeupdate", (e) => {
            this.playbackTime = e.detail.currentTime;
        });

        eventBus.on("playback.timeseek", (e) => {
            this.playbackTime = e.detail.currentTime;
        });
    }

    get playbackLocalTime() {
        /** Returns the current playback time in local wallclock time */
        if (!this.wallclockStartTime || this.playbackTime === null) {
            return null;
        }

        return this.toLocalDateFromSeconds(this.playbackTime);
    }

    get playbackLocalString() {
        const localTime = this.playbackLocalTime;
        if (!localTime) return null;

        // Use Luxon's toFormat method instead of toLocaleString
        return localTime.toFormat("MM/dd/yyyy HH:mm:ss");
    }

    toLocalDateFromSeconds(seconds) {
        if (!this.wallclockStartTime) {
            return null;
        }

        // Parse the UTC start time from JavaScript Date object
        const startDate = new Date(this.wallclockStartTime);
        const startDateTime = DateTime.fromJSDate(startDate, {
            zone: "utc",
        });
        const currentDateTime = startDateTime.plus({
            seconds: seconds,
        });

        // Convert to local timezone
        return currentDateTime.setZone(this.localTimezone);
    }

    toLocalTimeStringFromSeconds(seconds) {
        const localDateTime = this.toLocalDateFromSeconds(seconds);
        if (!localDateTime) return null;

        return localDateTime.toFormat("MM/dd/yyyy HH:mm:ss");
    }

    toSecondsFromLocalString(timeString) {
        /** Converts a local time string (MM/DD/YYYY HH:MM:SS) to seconds since playback start */
        if (!this.wallclockStartTime) {
            throw new Error("Wallclock start time is not set");
        }

        try {
            // Parse the input string as a local time in the specified timezone
            const inputDateTime = DateTime.fromFormat(
                timeString,
                "MM/dd/yyyy HH:mm:ss",
                { zone: this.localTimezone }
            );

            if (!inputDateTime.isValid) {
                throw new Error(
                    "Invalid date format. Please use MM/DD/YYYY HH:MM:SS"
                );
            }

            // Convert wallclock start time to Luxon DateTime
            const startDateTime = DateTime.fromJSDate(
                new Date(this.wallclockStartTime),
                { zone: "utc" }
            );

            // Calculate the difference in milliseconds, then convert to seconds
            const diffInMs =
                inputDateTime.toMillis() - startDateTime.toMillis();
            const diffInSeconds = diffInMs / 1000;

            // Return the difference (can be negative if input time is before start time)
            return diffInSeconds;
        } catch (error) {
            throw new Error(`Error parsing time string: ${error.message}`);
        }
    }

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

    /**
     * Convert a JS Date to UTC, interpreting it as being in a specific timezone.
     *
     * @param {Date} dateObject - JS Date whose local time should be interpreted in the given zone
     * @param {string} timeZone - IANA timezone name (e.g. "America/New_York")
     * @returns {DateTime} Luxon DateTime object in UTC
     */
    asUTC(dateObject, timeZone = "America/Los_Angeles") {
        // Step 1: interpret the date’s *wall clock time* as if it were in `timeZone`
        const zoned = DateTime.fromObject(
            {
                year: dateObject.getFullYear(),
                month: dateObject.getMonth() + 1,
                day: dateObject.getDate(),
                hour: dateObject.getHours(),
                minute: dateObject.getMinutes(),
                second: dateObject.getSeconds(),
                millisecond: dateObject.getMilliseconds(),
            },
            { zone: timeZone }
        );

        // Step 2: convert that moment to UTC
        const result = zoned.toUTC();

        return result.toJSDate();
    }

    diffInSeconds(time1, time2) {
        if (time1.toJSDate) time1 = time1.toJSDate();
        if (time2.toJSDate) time2 = time2.toJSDate();

        const diffMs = time2 - time1;
        return diffMs / 1000;
    }
}

const timeUtil = new Time();

if (typeof window !== "undefined") {
    window._vy_timeUtil = timeUtil;
}

export default timeUtil;
export { timeUtil, Time };
