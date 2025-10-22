import "./jsdom-shim.js";
import "./firebase-shim.js";

import { annotations } from "../src/data/annotations.js";

function addTimingToTranscript(annotations) {
    let lastTranscript = null;

    for (let i = 0; i < annotations.length; i++) {
        let current = annotations[i];
        if (current.type === "transcript") {
            if (lastTranscript) {
                current.idx = i;
                current.timeSinceLastTranscript =
                    current.time - lastTranscript.time;
                lastTranscript.timeUntilNextTranscript =
                    current.time - lastTranscript.time;
            }

            lastTranscript = current;
        }
    }

    return annotations;
}

function guessInning(text) {
    const halfMap = {
        "top of": 0,
        "bottom of": 0.5,
        "start of": 0,
        "end of": 0,
        "head to": 0,
        "heading to": 0,
        "move to": 0,
        "go to": 0,
    };
    const inningMap = {
        first: 1,
        "1st": 1,
        one: 1,
        second: 2,
        "2nd": 2,
        two: 2,
        third: 3,
        "3rd": 3,
        three: 3,
        fourth: 4,
        "4th": 4,
        four: 4,
        fifth: 5,
        "5th": 5,
        five: 5,
        sixth: 6,
        "6th": 6,
        six: 6,
        seventh: 7,
        "7th": 7,
        seven: 7,
        eighth: 8,
        "8th": 8,
        eight: 8,
        ninth: 9,
        "9th": 9,
        nine: 9,
        tenth: 10,
        "10th": 10,
        ten: 10,
    };

    const numRe1 =
        /\b(top of|bottom of|head to|heading to|start of|end of|move to|go to) the (first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|sixth|6th|seventh|7th|eighth|8th|ninth|9th|tenth|10th)\b/;
    const numRe2 =
        /\b(top of|bottom of|head to|heading to|start of|end of|move to|go to) inning (one|two|three|four|five|six|seven|eight|nine|ten)\b/;
    const numRe3 =
        /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|sixth|6th|seventh|7th|eighth|8th|ninth|9th|tenth|10th) inning\b/;

    let match = numRe1.exec(text);
    if (match) {
        let half = halfMap[match[1]];
        let inning = inningMap[match[2]];

        if (half == "end of") inning += 1;

        return inning + half;
    }

    match = numRe2.exec(text);
    if (match) {
        let half = halfMap[match[1]];
        let inning = inningMap[match[2]];

        if (half == "end of") inning += 1;

        return inning + half;
    }

    match = numRe3.exec(text);
    if (match) {
        let inning = inningMap[match[2]];

        return inning;
    }
}

function guessGameIsOver(text) {
    const re =
        /\b(game over|final out|winning run|winning score|walk-off|game ends|game has ended|game is over|postgame)\b/;
    return re.test(text);
}

function guessGapInning(transcript, gapIndex, shouldBe) {
    let preGapText = transcript
        .slice(gapIndex - 4, gapIndex)
        .map((a) => a.content)
        .join(" ")
        .toLowerCase();
    let postGapText = transcript
        .slice(gapIndex, gapIndex + 4)
        .map((a) => a.content)
        .join(" ")
        .toLowerCase();

    let preGapInning = guessInning(preGapText);
    let postGapInning = guessInning(postGapText);
    let startTime = transcript[gapIndex - 1].time;
    let endTime = transcript[gapIndex].time;
    let inning = shouldBe;
    let confidence = 0;
    let duration = endTime - startTime;

    if (
        shouldBe >= 9.5 &&
        (guessGameIsOver(preGapText) || guessGameIsOver(postGapText))
    ) {
        inning = 0;
        confidence = 1.0;
    } else if (
        preGapInning &&
        postGapInning &&
        preGapInning == postGapInning &&
        preGapInning == shouldBe
    ) {
        inning = preGapInning;
        confidence = 1.0;
    } else if (preGapInning && preGapInning && preGapInning == postGapInning) {
        inning = preGapInning;
        confidence = 0.75;
    } else if (preGapInning && preGapInning == shouldBe) {
        inning = preGapInning;
        confidence = 0.5;
    } else if (postGapInning && postGapInning == shouldBe) {
        inning = postGapInning;
        confidence = 0.5;
    } else if (preGapInning && Math.abs(preGapInning - shouldBe) <= 0.5) {
        inning = shouldBe;
        confidence = 0.25;
    } else if (postGapInning && Math.abs(postGapInning - shouldBe) <= 0.5) {
        inning = shouldBe;
        confidence = 0.25;
    } else {
        inning = shouldBe;
        confidence = 0;
    }

    return {
        inning,
        confidence,
        shouldBe,
        startTime,
        endTime,
        duration,
        preGapText,
        postGapText,
    };
}

async function guessInnings(
    hierarchy,
    gapMinDuration = 60,
    skipGaps = [],
    corrections = {}
) {
    let byTime = await annotations.getByHierarchy(hierarchy);

    byTime = byTime.filter((a) => a.type === "transcript");

    addTimingToTranscript(byTime);

    let shouldBe = 1;
    let gap = 1;
    let innings = [];

    for (let i = 1; i < byTime.length; i++) {
        if (byTime[i].timeSinceLastTranscript >= gapMinDuration) {
            if (!skipGaps.includes(gap)) {
                if (corrections[gap]) {
                    shouldBe = corrections[gap];
                    console.log(
                        `Applying correction for gap ${gap}: inning ${shouldBe}`
                    );
                } else shouldBe += 0.5;

                let guess = guessGapInning(byTime, i, shouldBe);

                if (corrections[gap]) {
                    shouldBe = corrections[gap];
                    guess.inning = shouldBe;
                    guess.confidence = 1;
                } else if (guess && guess.confidence > 0.5) {
                    shouldBe = guess.inning;
                }

                innings.push({ gap, ...guess });

                if (guess.inning === 0) {
                    break;
                }
            }
            gap++;
        }
    }

    return innings;
}

async function commit(hierarchy, innings) {
    console.log("Committing inning annotations to database...");

    for (let inning of innings) {
        if (inning.inning === 0) {
            await annotations.saveAnnotation(hierarchy, {
                time: inning.startTime + 1,
                type: "action",
                content: `End of game #inning`,
                importance: "high",
                tags: ["inning"],
            });
        } else {
            // Add annotation to database
            await annotations.saveAnnotation(hierarchy, {
                time: inning.startTime + 1,
                type: "action",
                content: `End of Inning ${inning.inning - 0.5} #inning`,
                importance: "high",
                tags: ["inning"],
            });

            await annotations.saveAnnotation(hierarchy, {
                time: inning.endTime - 1,
                type: "action",
                content: `Start of Inning ${inning.inning} #inning`,
                importance: "high",
                tags: ["inning"],
            });
        }
    }

    console.log(`Added ${innings.length} inning annotations to database.`);
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        time: 60,
        skip: [],
        commit: false,
        hierarchy: null,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === "-t" || arg === "--time") {
            options.time = parseInt(args[++i]);
        } else if (arg === "-s" || arg === "--skip") {
            options.skip = args[++i].split(",").map((n) => parseInt(n.trim()));
        } else if (arg === "-c" || arg === "--corrections") {
            const corrStr = args[++i];
            const corrPairs = corrStr.split(",").map((pair) => pair.trim());
            options.corrections = {};
            for (let pair of corrPairs) {
                const [gapStr, inningStr] = pair
                    .split(":")
                    .map((s) => s.trim());
                const gapNum = parseInt(gapStr);
                const inningNum = parseFloat(inningStr);
                options.corrections[gapNum] = inningNum;
            }
        } else if (arg === "--commit") {
            options.commit = true;
        } else if (arg === "-h" || arg === "--help") {
            console.log(
                "Usage: node analyze-baseball-transcript.js [options] [hierarchy]"
            );
            console.log("");
            console.log("Options:");
            console.log(
                "  -t, --time    minimum time between gaps, default 60 seconds"
            );
            console.log(
                "  -s, --skip    skip gap numbers, comma-separated list eg 1,2"
            );
            console.log(
                "  -c, --corrections    manually correct gap numbers, format gap:inning,gap:inning"
            );
            console.log(
                "  --commit      add inning annotations to the database"
            );
            console.log("  -h, --help    show this help message");
            process.exit(0);
        } else if (!arg.startsWith("-")) {
            options.hierarchy = arg;
        }
    }

    return options;
}

const options = parseArgs();

if (!options.hierarchy) {
    console.error("Error: hierarchy argument is required");
    console.log(
        "Usage: node analyze-baseball-transcript.js [options] [hierarchy]"
    );
    console.log("Use -h or --help for more information");
    process.exit(1);
}

const innings = await guessInnings(
    options.hierarchy,
    options.time,
    options.skip,
    options.corrections
);

console.log(innings);

let confidence =
    innings.reduce((sum, g) => sum + g.confidence, 0) / innings.length;
console.log(`Overall confidence: ${confidence.toFixed(2)}`);

if (options.commit) {
    await commit(options.hierarchy, innings);
}
