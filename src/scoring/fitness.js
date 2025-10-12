class Fitness {
    constructor(scoring) {
        this.scores = [];
        this.scoring = scoring;
        this.positiveParams = {
            responseWindow: 5.0, // seconds to look for initial response
            sustainDuration: 3.0, // minimum sustained elevation
            highThresholdMultiplier: 2.0, // median + 2x MAD
            baselineRangeMultiplier: 1.25, // median +/- 1x MAD for baseline range
            maxHighStddev: 300, // max std dev during high period
            maxBaselineStddev: 200, // max std dev during baseline
        };
    }

    async buildScores() {
        this.scoring.rewindWindow();
        this.scores = [];

        for (let i = 0; i < 60; i += 0.1) {
            await this.scoring.handleTimeUpdate(i);
            this.scores.push({
                time: i,
                score: this.scoring.currentScore,
            });
        }
    }

    calculateMedian(values) {
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    calculateMAD(values, median) {
        const deviations = values.map((value) => Math.abs(value - median));
        return this.calculateMedian(deviations);
    }

    calculateAdaptiveThresholds() {
        const allScores = this.scores.map((s) => s.score);
        const median = this.calculateMedian(allScores);
        const mad = this.calculateMAD(allScores, median);

        const thresholds = {
            median: median,
            mad: mad,
            highThreshold: Math.max(
                500,
                median + this.positiveParams.highThresholdMultiplier * mad
            ),
            baselineUpperBound:
                median + this.positiveParams.baselineRangeMultiplier * mad,
            baselineLowerBound:
                median - this.positiveParams.baselineRangeMultiplier * mad,
        };

        console.log(
            `Adaptive thresholds: median=${median.toFixed(
                1
            )}, MAD=${mad.toFixed(1)}`
        );
        console.log(`High threshold: ${thresholds.highThreshold.toFixed(1)}`);
        console.log(
            `Baseline range: ${thresholds.baselineLowerBound.toFixed(
                1
            )} to ${thresholds.baselineUpperBound.toFixed(1)}`
        );

        return thresholds;
    }

    getTimeWindow(start, end) {
        let startIndex = Math.floor(start * 10);
        let endIndex = Math.ceil(end * 10);
        return this.scores.slice(startIndex, endIndex);
    }

    calculateStddev(data) {
        if (data.length === 0) return 0;

        const mean =
            data.reduce((sum, row) => sum + row.score, 0) / data.length;
        const variance =
            data.reduce((sum, row) => sum + (row.score - mean) ** 2, 0) /
            data.length;

        console.log(`mean: ${mean}`);
        console.log(`stddev: ${Math.sqrt(variance)}`);

        return Math.sqrt(variance);
    }

    calculateTimingScore(time, reactionDelay, period) {
        if (!period) return 0;

        if (period.startTime < time + reactionDelay) {
            return Math.exp(-Math.abs(period.startTime - time) / 2.0);
        }

        return 0;
    }

    calculateStddevScore(period, maxStddev) {
        if (!period) return 0;

        const stddev = this.calculateStddev(period.scores);

        if (stddev <= maxStddev) return 1;
        return Math.max(0, 1 - (stddev - maxStddev) / maxStddev);
    }

    calculateThresholdReasonablenessScore(adaptiveThresholds) {
        // Target ranges for reasonable thresholds
        const targetBaselineMin = 0;
        const targetBaselineMax = 250;
        const targetHighThreshold = 500;

        // Calculate baseline center point
        const baselineCenter =
            (adaptiveThresholds.baselineLowerBound +
                adaptiveThresholds.baselineUpperBound) /
            2;

        // Score baseline reasonableness (how close to 0-250 range)
        let baselineScore = 0;
        if (
            baselineCenter >= targetBaselineMin &&
            baselineCenter <= targetBaselineMax
        ) {
            // Perfect score if within target range
            baselineScore = 1;
        } else if (baselineCenter < targetBaselineMin) {
            // Penalty for being too low (negative values are problematic)
            const distance = Math.abs(baselineCenter - targetBaselineMin);
            baselineScore = Math.max(0, 1 - distance / 100); // Penalize 1% per point below 0
        } else {
            // Penalty for being too high
            const distance = baselineCenter - targetBaselineMax;
            baselineScore = Math.max(0, 1 - distance / 200); // Penalize 0.5% per point above 250
        }

        // Score high threshold reasonableness (how close to 500)
        const highThresholdDistance = Math.abs(
            adaptiveThresholds.highThreshold - targetHighThreshold
        );
        const highThresholdScore = Math.max(0, 1 - highThresholdDistance / 300); // Penalize based on distance from 500

        // Combine scores (equal weighting)
        const overallThresholdScore = (baselineScore + highThresholdScore) / 2;

        console.log(
            `Threshold reasonableness: baseline=${baselineScore.toFixed(
                3
            )} (center=${baselineCenter.toFixed(
                1
            )}), high=${highThresholdScore.toFixed(
                3
            )} (${adaptiveThresholds.highThreshold.toFixed(
                1
            )}), overall=${overallThresholdScore.toFixed(3)}`
        );

        return overallThresholdScore;
    }

    evaluatePositiveResponse(time, paramOverrides = {}) {
        const params = { ...this.positiveParams, ...paramOverrides };

        // Calculate adaptive thresholds based on entire dataset
        const adaptiveThresholds = this.calculateAdaptiveThresholds();

        let sustainScore = 0;
        let timingScore = 0;
        let highStddevScore = 0;
        let baselineStddevScore = 0;
        let thresholdScore = 0;
        // Extract time windows
        const reactionWindow = this.getTimeWindow(time, time + 10);

        // 1. Find sustained high period using adaptive threshold
        const highPeriod = this.findSustainedPeriod(
            reactionWindow,
            (value) => value >= adaptiveThresholds.highThreshold,
            params.sustainDuration
        );
        sustainScore = highPeriod ? 1 : 0;

        // 2. Measure timing of first breach
        timingScore = this.calculateTimingScore(
            time,
            params.responseWindow,
            highPeriod
        );

        // 3. Measure stddev during high period
        highStddevScore = this.calculateStddevScore(
            highPeriod,
            params.maxHighStddev
        );

        // 4. Measure stddev in baseline periods using baseline range
        const preBaselinePeriod = this.findSustainedBefore(
            highPeriod,
            (value) =>
                value >= adaptiveThresholds.baselineLowerBound &&
                value <= adaptiveThresholds.baselineUpperBound,
            params.sustainDuration
        );
        const preBaselineStddevScore = this.calculateStddevScore(
            preBaselinePeriod,
            params.maxBaselineStddev
        );
        const postBaselinePeriod = this.findSustainedAfter(
            highPeriod,
            (value) =>
                value >= adaptiveThresholds.baselineLowerBound &&
                value <= adaptiveThresholds.baselineUpperBound,
            params.sustainDuration
        );
        const postBaselineStddevScore = this.calculateStddevScore(
            postBaselinePeriod,
            params.maxBaselineStddev
        );

        baselineStddevScore = Math.max(
            preBaselineStddevScore,
            postBaselineStddevScore
        );

        // 5. Calculate threshold reasonableness score
        thresholdScore =
            this.calculateThresholdReasonablenessScore(adaptiveThresholds);

        return {
            timing: timingScore,
            sustain: sustainScore,
            highStability: highStddevScore,
            baselineStability: baselineStddevScore,
            thresholdReasonableness: thresholdScore,
            preBaselineStability: preBaselineStddevScore,
            postBaselineStability: postBaselineStddevScore,
            overall:
                timingScore * 0.25 +
                sustainScore * 0.25 +
                highStddevScore * 0.2 +
                baselineStddevScore * 0.2 +
                thresholdScore * 0.1,
            details: {
                highPeriod: highPeriod,
                preBaselinePeriod: preBaselinePeriod,
                postBaselinePeriod: postBaselinePeriod,
                adaptiveThresholds: adaptiveThresholds,
            },
            params: params,
        };
    }

    findSustainedPeriod(window, testFunction, minDuration, reverse = false) {
        let start = null;
        let end = null;
        let min = null;
        let max = null;
        let consecutiveHigh = 0;

        // Iterate through the window until we exceed threshold
        // then
        let init = reverse ? window.length - 1 : 0;
        let condition = reverse ? (i) => i >= 0 : (i) => i < window.length;
        let increment = reverse ? -1 : 1;

        for (let i = init; condition(i); i += increment) {
            if (testFunction(window[i].score)) {
                if (start === null) {
                    start = i;
                    min = window[i].score;
                    max = window[i].score;
                }

                min = Math.min(min, window[i].score);
                max = Math.max(max, window[i].score);
                consecutiveHigh += 0.1;
                end = i;
            } else if (consecutiveHigh >= minDuration) {
                break;
            } else {
                start = null;
                consecutiveHigh = 0;
            }
        }

        if (consecutiveHigh >= minDuration) {
            return {
                startTime: window[start].time,
                endTime: window[end].time,
                startIndex: start,
                endIndex: end,
                scores: this.scores.slice(start, end + 1),
                duration: consecutiveHigh,
                min: min,
                max: max,
                range: max - min,
            };
        }

        return null;
    }

    findSustainedBefore(period, testFunction, minDuration, windowSize = 5) {
        if (!period) return null;
        const newWindowStartTime = Math.max(0, period.startTime - windowSize);
        const newWindowEndTime = period.startTime;
        const newWindow = this.getTimeWindow(
            newWindowStartTime,
            newWindowEndTime
        );
        return this.findSustainedPeriod(
            newWindow,
            testFunction,
            minDuration,
            true
        );
    }

    findSustainedAfter(period, testFunction, minDuration, windowSize = 5) {
        if (!period) return null;
        const newWindowStartTime = period.endTime;
        const newWindowEndTime = Math.min(
            this.scores.length / 10.0,
            period.endTime + windowSize
        );
        const newWindow = this.getTimeWindow(
            newWindowStartTime,
            newWindowEndTime
        );
        return this.findSustainedPeriod(newWindow, testFunction, minDuration);
    }
}

export default Fitness;
export { Fitness };
