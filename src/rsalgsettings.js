import van from "vanjs-core";
import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";

import { profiles } from "./ui/profiles.js";
import { Score } from "./scoring/scoring.js";
import { annotations } from "./ui/annotations.js";
import { Hierarchy } from "./util/hierarchy.js";
import { events } from "./ui/events.js";
import { database } from "./data/db.js";
import { Fitness } from "./scoring/fitness.js";

import { eventBus } from "./eventbus.js";

// Register Chart.js components and zoom plugin
Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
    zoomPlugin,
    annotationPlugin
);

class Settings {
    constructor() {
        this.profileId = "BkBUQq4GiSfuwHN7YrK3";
        this.scoring = new Score();
    }

    async init() {
        await this.initProfile();
        await this.addElements();
        this.initChart();
    }

    async addElements(parentElement) {
        const { div, main, h1, button, canvas } = van.tags;

        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                div(
                    { class: "flex justify-center items-center" },
                    h1("Settings")
                ),

                this.createProfileElements(),

                this.createSourceElements(),

                this.createParameterElements(),

                this.createEmotionElements(),

                div(
                    { class: "mt-4 justify-right" },
                    button(
                        {
                            type: "button",
                            class: "bg-blue-500 hover:bg-blue-700 text-white font-bold px-4 rounded whitespace-nowrap",
                            onclick: (e) => {
                                this.update();
                            },
                        },
                        "Update"
                    )
                ),

                div(
                    { class: "w-full h-96 mt-4" },
                    canvas({
                        id: "chart-canvas",
                        class: "w-full h-full",
                    })
                )
            )
        );
    }

    createProfileElements() {
        const { div, button } = van.tags;

        eventBus.on("ui.requestProfile", async (e) => {
            this.switchToProfile(e.detail);
        });

        return div(
            { class: "mt-4 flex flex-wrap gap-4" },
            div(
                { class: "flex-shrink-0" },
                profiles.createSelectorElement(this.profileId)
            ),
            div(
                { class: "flex-shrink-0 flex gap-2" },
                // Save Button
                button(
                    {
                        type: "button",
                        class: "bg-green-500 hover:bg-green-700 text-white font-bold px-3 py-1 rounded text-sm",
                        onclick: async (e) => {
                            await this.saveProfile();
                        },
                    },
                    "Save"
                ),
                // Save As Button (prompts for name and uses duplicate)
                button(
                    {
                        type: "button",
                        class: "bg-blue-500 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded text-sm",
                        onclick: async (e) => {
                            await this.saveAsProfile();
                        },
                    },
                    "Save As"
                ),
                // Delete Button (with confirmation dialog)
                button(
                    {
                        type: "button",
                        class: "bg-red-500 hover:bg-red-700 text-white font-bold px-3 py-1 rounded text-sm",
                        onclick: async (e) => {
                            await this.deleteProfile();
                        },
                    },
                    "Delete"
                )
            )
        );
    }

    async saveProfile() {
        if (!profiles.profile) {
            console.error("No active profile to save");
            return;
        }

        // Get current scoring parameters from form
        const scoringParams = this.getScoringParamsFromInputs();

        // Get current emotion weights from form
        const emotionWeights = this.getEmotionWeightsFromInputs();

        // Update the profile
        const success = await profiles.update(profiles.profile.id, {
            scoring: scoringParams,
            emotions: emotionWeights,
        });

        if (success) {
            console.log("Profile saved successfully");
            // Could add a toast notification here
        } else {
            console.error("Failed to save profile");
        }
    }

    async saveAsProfile() {
        const name = prompt("Enter a name for the new profile:");
        if (!name) return;

        // Get current scoring parameters and emotions from form
        const scoringParams = this.getScoringParamsFromInputs();
        const emotionWeights = this.getEmotionWeightsFromInputs();

        const newProfileId = await profiles.duplicate(profiles.profile.id, {
            name: name,
            description: `Copy of ${profiles.profile.name}`,
            params: scoringParams,
            emotions: emotionWeights,
        });

        if (newProfileId) {
            console.log(
                "Profile duplicated successfully with ID:",
                newProfileId
            );
            // Switch to the new profile
            await this.reloadProfileList();
            await this.switchToProfile(newProfileId);
        } else {
            console.error("Failed to duplicate profile");
        }
    }

    async deleteProfile() {
        if (!profiles.profile) {
            console.error("No active profile to delete");
            return;
        }

        if (profiles.profile.id == this.defaultProfileId) {
            alert("Cannot delete the default profile");
            return;
        }

        const confirmed = confirm(
            `Are you sure you want to delete the profile "${profiles.profile.name}"?`
        );
        if (!confirmed) return;

        const success = await profiles.delete(profiles.profile.id);
        if (success) {
            console.log("Profile deleted successfully");
            // The profiles module will automatically switch to the default profile
            await this.reloadProfileList();
            await this.switchToProfile(this.defaultProfileId);
        } else {
            console.error("Failed to delete profile");
        }
    }

    async reloadProfileList() {
        // Refresh the profile selector to reflect any changes
        await profiles.setSelectorToAll();
    }

    async switchToProfile(profileId) {
        console.log("Switching to profile:", profileId);
        this.profileId = profileId;
        await profiles.setActive(profileId);
        await this.refreshProfileElements();
    }

    async refreshProfileElements() {
        // Re-initialize the profile data
        await this.initProfile();

        // Update the form elements with new profile data
        this.updateFormFromProfile();
    }

    getScoringParamsFromInputs() {
        return {
            softmaxAlpha: this.getFloatValue("softmax-alpha"),
            combineSoftmaxAlpha: this.getFloatValue("combine-softmax-alpha"),
            gainFactor: this.getFloatValue("gain-factor"),
            useDecayWeighting: this.getCheckboxValue("use-decay-weighting"),
            decayTimeConstant: this.getFloatValue("decay-time-constant"),
            applyUISquash: this.getCheckboxValue("apply-ui-squash"),
            uiMid: this.getFloatValue("ui-mid"),
            uiSpread: this.getFloatValue("ui-spread"),
            useRobustNormalization: this.getCheckboxValue("apply-robust-norm"),
            robustTargetStd: this.getFloatValue("robust-target-std"),
            adaptiveNormalization: this.getCheckboxValue("apply-adaptive-norm"),
            adaptiveBaselineSampleSize: this.getFloatValue("adaptive-baseline"),
            adaptiveScalingFunction: this.getSelectValue("adaptive-function"),
            adaptiveMinMultiplier: this.getFloatValue("adaptive-min"),
            adaptiveMaxMultiplier: this.getFloatValue("adaptive-max"),
            boxVolatilityFactor: this.getFloatValue("box-volatility-factor"),
            newBoxVolatilityFactor: this.getFloatValue(
                "new-box-volatility-factor"
            ),
            lostBoxVolatilityFactor: this.getFloatValue(
                "lost-box-volatility-factor"
            ),
        };
    }

    getEmotionWeightsFromInputs() {
        const emotions = {};
        for (const emotion of this.validEmotions) {
            const emotionInput = document.getElementById(`emotion-${emotion}`);
            if (emotionInput) {
                emotions[emotion] = parseFloat(emotionInput.value);
            }
        }
        return emotions;
    }

    updateFormFromProfile() {
        // Update scoring parameter inputs
        const scoringParams = profiles.getScoringParams();
        document.getElementById("softmax-alpha").value =
            scoringParams.softmaxAlpha;
        document.getElementById("combine-softmax-alpha").value =
            scoringParams.combineSoftmaxAlpha;
        document.getElementById("gain-factor").value = scoringParams.gainFactor;
        document.getElementById("use-decay-weighting").checked =
            scoringParams.useDecayWeighting;
        document.getElementById("decay-time-constant").value =
            scoringParams.decayTimeConstant;
        document.getElementById("apply-ui-squash").checked =
            scoringParams.applyUISquash;
        document.getElementById("ui-mid").value = scoringParams.uiMid;
        document.getElementById("ui-spread").value = scoringParams.uiSpread;
        document.getElementById("apply-robust-norm").checked =
            scoringParams.useRobustNormalization;
        document.getElementById("robust-target-std").value =
            scoringParams.robustTargetStd;
        document.getElementById("apply-adaptive-norm").checked =
            scoringParams.adaptiveNormalization;
        document.getElementById("adaptive-baseline").value =
            scoringParams.adaptiveBaselineSampleSize;
        document.getElementById("adaptive-function").value =
            scoringParams.adaptiveScalingFunction;
        document.getElementById("adaptive-min").value =
            scoringParams.adaptiveMinMultiplier;
        document.getElementById("adaptive-max").value =
            scoringParams.adaptiveMaxMultiplier;
        document.getElementById("box-volatility-factor").value =
            scoringParams.boxVolatilityFactor;
        document.getElementById("new-box-volatility-factor").value =
            scoringParams.newBoxVolatilityFactor;
        document.getElementById("lost-box-volatility-factor").value =
            scoringParams.lostBoxVolatilityFactor;

        // Update emotion weight inputs
        for (const emotion of this.validEmotions) {
            const emotionInput = document.getElementById(`emotion-${emotion}`);
            if (emotionInput) {
                emotionInput.value = profiles.getEmotionWeight(emotion);
            }
        }
    }

    createSourceElements() {
        const { div, label, input } = van.tags;

        return div(
            { class: "mt-4 grid grid-cols-3 gap-4" },
            div({ class: "flex-shrink-0" }, events.createSelectorElement()),
            div(
                { class: "flex-shrink-0" },
                annotations.createSelectorElement("raimondi:20250711:01")
            ),
            div(
                { class: "flex items-center gap-2 flex-shrink-0" },
                label("Offset"),
                input({
                    type: "number",
                    id: "offset-time",
                    value: 0,
                    step: 1,
                    class: "text-black w-20",
                }),
                label("Camera"),
                input({
                    type: "number",
                    id: "camera-index",
                    value: 1,
                    min: 1,
                    max: 5,
                    class: "text-black w-20",
                })
            )
        );
    }

    createParameterElements() {
        const { div } = van.tags;
        return div(
            this.createScoringParameterElements(),
            this.createNormalizationParameterElements()
        );
    }

    createScoringParameterElements() {
        const { div, label, input } = van.tags;
        return div(
            { class: "flex flex-wrap gap-6 mt-4" },

            div(
                { class: "flex items-center gap-2" },
                label("Softmax Alpha"),
                this.createInfoIcon(
                    "Controls emotion weighting within single detections. Higher values emphasize stronger emotions more (spikier), lower values treat emotions more equally (smoother)."
                ),
                input({
                    id: "softmax-alpha",
                    type: "number",
                    value: this.scoring.softmaxAlpha,
                    step: this.scoring.softmaxAlpha / 10.0,
                    class: "text-black w-20",
                })
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Combine Alpha"),
                this.createInfoIcon(
                    "Controls weighting when combining multiple detections over time. Higher values emphasize spikes more (spikier), lower values smooth out variations."
                ),
                input({
                    id: "combine-softmax-alpha",
                    type: "number",
                    value: this.scoring.combineSoftmaxAlpha,
                    step: this.scoring.combineSoftmaxAlpha / 10.0,
                    class: "text-black w-20",
                })
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Gain Factor"),
                this.createInfoIcon(
                    "Controls the overall amplitude/gain of the final scores. Higher values amplify scores (spikier), lower values reduce scores (flatter)."
                ),
                input({
                    id: "gain-factor",
                    type: "number",
                    value: this.scoring.gainFactor,
                    step: this.scoring.gainFactor / 10.0,
                    class: "text-black w-20",
                })
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Window Size (s)"),
                this.createInfoIcon(
                    "Controls the size of the window used for scoring."
                ),
                input({
                    id: "window-size",
                    type: "number",
                    value: this.scoring.windowSize,
                    step: this.scoring.windowSize / 10.0,
                    class: "text-black w-20",
                })
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Use Decay Weighting"),
                this.createInfoIcon(
                    "Enable temporal decay to weight recent reactions more heavily than older ones."
                ),
                input({
                    id: "use-decay-weighting",
                    type: "checkbox",
                    checked: this.scoring.useDecayWeighting,
                    class: "text-black",
                })
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Decay Time Constant"),
                this.createInfoIcon(
                    "Relative decay rate (0-1). Value of 1.0 means full exponential decay across the window, 0.1 means gentle decay. Actual time constant is this value × window size."
                ),
                input({
                    id: "decay-time-constant",
                    type: "number",
                    value: this.scoring.decayTimeConstant,
                    step: this.scoring.decayTimeConstant / 10.0,
                    class: "text-black w-20",
                })
            ),

            this.createUISquashElements(),

            this.createVolatilityElements()
        );
    }

    createVolatilityElements() {
        const { div, label, input } = van.tags;
        return div(
            { class: "flex items-center gap-2" },
            label("Volatility Factors"),
            this.createInfoIcon(
                "Controls the volatility factors for different types of boxes."
            ),
            div(
                { class: "flex items-center gap-2 ml-4" },
                label("New"),
                this.createInfoIcon("New box volatility factor."),
                input({
                    id: "new-box-volatility-factor",
                    type: "number",
                    value: this.scoring.newBoxVolatilityFactor,
                    step: 0.1,
                    class: "text-black w-20",
                }),
                label("Lost"),
                this.createInfoIcon("Lost box volatility factor."),
                input({
                    id: "lost-box-volatility-factor",
                    type: "number",
                    value: this.scoring.lostBoxVolatilityFactor,
                    step: 0.1,
                    class: "text-black w-20",
                }),

                label("Net"),
                this.createInfoIcon("Net box volatility factor."),
                input({
                    id: "box-volatility-factor",
                    type: "number",
                    value: this.scoring.boxVolatilityFactor,
                    step: 0.1,
                    class: "text-black w-20",
                })
            )
        );
    }

    createUISquashElements() {
        const { div, label, input } = van.tags;
        return div(
            { class: "flex items-center gap-2" },
            label("UI Squash"),
            this.createInfoIcon(
                "Compresses score range for better UI display by squashing extreme values."
            ),
            input({
                id: "apply-ui-squash",
                type: "checkbox",
                checked: this.scoring.applyUiSquash,
                class: "text-black",
            }),
            div(
                { class: "flex items-center gap-2 ml-4" },
                label("Mid"),
                this.createInfoIcon("Center point of the squashing function."),
                input({
                    id: "ui-mid",
                    type: "number",
                    value: this.scoring.uiMid,
                    step: this.scoring.uiMid / 10.0,
                    class: "text-black w-20",
                }),
                label("Spread"),
                this.createInfoIcon(
                    "Controls how gradually the squashing effect is applied."
                ),
                input({
                    id: "ui-spread",
                    type: "number",
                    value: this.scoring.uiSpread,
                    step: this.scoring.uiSpread / 10.0,
                    class: "text-black w-20",
                })
            )
        );
    }

    createNormalizationParameterElements() {
        const { div, label, input, select, option, span } = van.tags;
        return div(
            { class: "flex flex-wrap gap-6 mt-4" },

            div(
                { class: "flex items-center gap-2" },
                label("Robust Norm"),
                this.createInfoIcon(
                    "Uses median-based normalization instead of mean-based for better handling of outliers."
                ),
                input({
                    id: "apply-robust-norm",
                    type: "checkbox",
                    checked: this.scoring.useRobustNormalization,
                    class: "text-black",
                })
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Target Std"),
                this.createInfoIcon(
                    "Target standard deviation for robust normalization. Higher values allow more variation."
                ),
                input({
                    id: "robust-target-std",
                    type: "number",
                    value: this.scoring.robustTargetStd,
                    step: this.scoring.robustTargetStd / 10.0,
                    class: "text-black w-20",
                })
            ),

            ...this.createAdaptiveNormalizationElements()
        );
    }

    createAdaptiveNormalizationElements() {
        const { div, label, input, select, option, span } = van.tags;
        return [
            div(
                { class: "flex items-center gap-2" },
                label("Adaptive Norm"),
                this.createInfoIcon(
                    "Automatically adjusts normalization based on recent data patterns."
                ),
                input({
                    id: "apply-adaptive-norm",
                    type: "checkbox",
                    checked: this.scoring.adaptiveNormalization,
                    class: "text-black",
                })
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Baseline"),
                this.createInfoIcon(
                    "Number of recent samples used to calculate adaptive baseline."
                ),
                input({
                    id: "adaptive-baseline",
                    type: "number",
                    value: this.scoring.adaptiveBaselineSampleSize,
                    step: this.scoring.adaptiveBaselineSampleSize / 10.0,
                    class: "text-black w-20",
                })
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Function"),
                this.createInfoIcon(
                    "Mathematical function used for adaptive scaling: sqrt (gradual), linear (proportional), log (compressed)."
                ),
                select(
                    {
                        id: "adaptive-function",
                        class: "text-black w-24",
                    },
                    ...["sqrt", "linear", "log"].map((f) =>
                        option(
                            {
                                value: f,
                                selected:
                                    f == this.scoring.adaptiveScalingFunction,
                            },
                            f
                        )
                    )
                )
            ),

            div(
                { class: "flex items-center gap-2" },
                label("Min/Max"),
                this.createInfoIcon(
                    "Minimum and maximum multipliers for adaptive scaling to prevent extreme adjustments."
                ),
                div(
                    { class: "flex items-center gap-1" },
                    input({
                        id: "adaptive-min",
                        type: "number",
                        value: this.scoring.adaptiveMinMultiplier,
                        step: this.scoring.adaptiveMinMultiplier / 10.0,
                        class: "text-black w-16",
                    }),
                    span({ class: "text-sm" }, "-"),
                    input({
                        id: "adaptive-max",
                        type: "number",
                        value: this.scoring.adaptiveMaxMultiplier,
                        step: this.scoring.adaptiveMaxMultiplier / 10.0,
                        class: "text-black w-16",
                    })
                )
            ),
        ];
    }

    createEmotionElements() {
        const { div, label, input } = van.tags;

        return div(
            { class: "mt-4 grid grid-cols-6 gap-2" },
            ...this.validEmotions.map((emotion) =>
                div(
                    { class: "flex items-center gap-2" },
                    label(
                        {
                            class: "w-24 overflow-hidden text-ellipsis whitespace-nowrap text-sm flex-shrink-0",
                        },
                        emotion
                    ),
                    input({
                        id: `emotion-${emotion}`,
                        type: "number",
                        value: profiles.profile.emotions[emotion],
                        class: "text-black w-20",
                        step: 0.25,
                    })
                )
            )
        );
    }

    async initProfile() {
        await profiles.getById(this.profileId);
        console.log(profiles.profile);

        this.validEmotions = [];
        for (let key in profiles.profile.emotions) {
            if (profiles.profile.emotions[key] != 0) {
                // Limit key length to 10 chars
                this.validEmotions.push(key);
            }
        }

        // Add missing required emotions like Sadness
        const requiredEmotions = ["Sadness"];
        for (const emotion of requiredEmotions) {
            if (!this.validEmotions.includes(emotion)) {
                this.validEmotions.push(emotion);
            }
        }

        // Sort
        this.validEmotions.sort();
    }

    initChart() {
        this.ctx = document.getElementById("chart-canvas").getContext("2d");

        const labels = [];
        const peopleColors = [];
        const scoreColors = [];
        this.data = [];

        for (let i = 0; i < 60 * 4; i++) {
            labels.push(`${i / 4.0}s`);
            peopleColors.push("#3fa7d7");
            scoreColors.push("#fdb080");
            this.data.push(0);
        }

        this.chart = new Chart(this.ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Score",
                        data: this.data,
                        fill: false,
                        borderColor: scoreColors,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                    },
                    annotation: {
                        annotations: {
                            offsetLine: {
                                type: "line",
                                xMin: 0,
                                xMax: 0,
                                borderColor: "red",
                                borderWidth: 2,
                                label: {
                                    content: "Event",
                                    display: true,
                                    position: "end",
                                },
                            },
                            baseLowerLine: {
                                type: "line",
                                yMin: 0,
                                yMax: 0,
                                borderColor: "yellow",
                                borderWidth: 2,
                                label: {
                                    content: "Baseline",
                                    display: true,
                                    position: "start",
                                },
                            },
                            baseUpperLine: {
                                type: "line",
                                yMin: 0,
                                yMax: 0,
                                borderColor: "yellow",
                                borderWidth: 2,
                                label: {
                                    content: "Baseline",
                                    display: true,
                                    position: "start",
                                },
                            },
                            highLine: {
                                type: "line",
                                yMin: 0,
                                yMax: 0,
                                borderColor: "green",
                                borderWidth: 2,
                                label: {
                                    content: "High",
                                    display: true,
                                    position: "start",
                                },
                            },

                            highPeriodBox: {
                                type: "box",
                                display: false,
                                xMin: 0,
                                xMax: 0,
                                yMin: -1000,
                                yMax: 1000,
                                backgroundColor: "rgba(0, 255, 0, 0.2)",
                                label: {
                                    content: "High Period",
                                    display: true,
                                    position: "center",
                                },
                            },
                            preBaselineBox: {
                                type: "box",
                                display: false,
                                xMin: 0,
                                xMax: 0,
                                yMin: -1000,
                                yMax: 1000,
                                backgroundColor: "rgba(255, 165, 0, 0.2)",
                                label: {
                                    content: "Pre-Baseline",
                                    display: true,
                                    position: "center",
                                },
                            },
                            postBaselineBox: {
                                type: "box",
                                display: false,
                                xMin: 0,
                                xMax: 0,
                                yMin: -1000,
                                yMax: 1000,
                                backgroundColor: "rgba(255, 165, 0, 0.2)",
                                label: {
                                    content: "Post-Baseline",
                                    display: true,
                                    position: "center",
                                },
                            },
                        },
                    },
                    zoom: {
                        limits: {
                            y: {
                                min: -2000,
                                max: 2000,
                            },
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true,
                            },
                            mode: "xy",
                        },
                        pan: {
                            enabled: true,
                            mode: "xy",
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMin: -1000,
                        suggestedMax: 1000,
                        min: -1000,
                        max: 1000,
                    },
                },
            },
        });

        // Hold reference to the offset line for easier access
        this.annotations = this.chart.options.plugins.annotation.annotations;
        this.offsetLine = this.annotations.offsetLine;
        this.baseLowerLine = this.annotations.baseLowerLine;
        this.baseUpperLine = this.annotations.baseUpperLine;
        this.highLine = this.annotations.highLine;
        this.highPeriodBox = this.annotations.highPeriodBox;
        this.preBaselineBox = this.annotations.preBaselineBox;
        this.postBaselineBox = this.annotations.postBaselineBox;

        this.chart.update();
    }

    // async getSourceData() {
    //     const sourceInfo = this.getSourceInputs();
    //     const hierarchy = this.createHierarchy(sourceInfo);
    //     const chunks = await this.getChunks(hierarchy);

    //     if (!chunks || chunks.length === 0) {
    //         return null;
    //     }

    //     const targetChunk = this.findTargetChunk(chunks, sourceInfo);
    //     if (!targetChunk) {
    //         return null;
    //     }

    //     return this.buildSourceUrl(targetChunk, chunks, sourceInfo);
    // }

    getSourceInputs() {
        return {
            hierarchy: document.getElementById("report-event-select").value,
            time: parseFloat(
                document.getElementById("annotation-select").value
            ),
            camera: document.getElementById("camera-index").value,
            offset: parseFloat(document.getElementById("offset-time").value),
        };
    }

    createHierarchy(sourceInfo) {
        const reqTime = sourceInfo.time + sourceInfo.offset;
        console.log(
            `Using event time ${sourceInfo.time}s and offset ${sourceInfo.offset}s ${reqTime}`
        );

        let h = new Hierarchy(sourceInfo.hierarchy);
        h.camera = sourceInfo.camera;
        return h;
    }

    async getChunks(hierarchy) {
        let chunks = await database.query("chunks", {
            hierarchy: hierarchy.toString(),
        });

        chunks.sort((a, b) => a.minuteOfDay - b.minuteOfDay);
        return chunks;
    }

    getMinuteOfDay(chunks, reqTime) {
        const startDate = new Date(chunks[0].creationTime);
        const targetDate = new Date(startDate.getTime() + reqTime * 1000);
        const minuteOfDay =
            targetDate.getUTCHours() * 60 + targetDate.getUTCMinutes();

        return minuteOfDay;
    }

    filterChunksForTime(chunks, reqTime) {
        // Return the chunks for the requested time plus/minus one minute
        const minuteOfDay = this.getMinuteOfDay(chunks, reqTime);
        const result = chunks.filter(
            (c) =>
                c.minuteOfDay >= minuteOfDay - 1 &&
                c.minuteOfDay <= minuteOfDay + 1
        );

        // for (
        //     let minute = minuteOfDay - 1;
        //     minute <= minuteOfDay + 1;
        //     minute++
        // ) {
        //     const chunk = chunks.find((c) => c.minuteOfDay == minute);
        //     if (chunk) {
        //         result.push(chunk);
        //     }
        // }

        return result;
    }

    getExpressionsUrl(chunk) {
        let path = chunk.expressionsPath;
        let prefix = "";
        let suffix = "";

        if (chunk.storage == "firebase") {
            prefix =
                "https://firebasestorage.googleapis.com/v0/b/roarscore-1ddf5.firebasestorage.app/o/";
            suffix = "?alt=media&ext=.json";
        } else if (chunk.storage == "minio") {
            prefix = "https://storage.roarscore.ai/production/";
        }
        else if (chunk.storage == "seaweed") {
            prefix = "https://s.vy.vision/";
        }

        return `${prefix}${path}${suffix}`;
    }

    getDuration(chunk) {
        if (chunk.playbackDurations) {
            return chunk.playbackDurations.reduce((a, b) => a + b, 0);
        }

        return chunk.duration || 60;
    }

    getLoadSchedule(chunks) {
        let start = 0;
        let schedule = [];

        for (let chunk of chunks) {
            const duration = this.getDuration(chunk);
            schedule.push({
                url: this.getExpressionsUrl(chunk),
                start: start,
                duration: duration,
            });
            start += duration;
        }

        return schedule;
    }

    getWindowTime(reqTime, chunks, targetChunks) {
        const startDate = new Date(chunks[0].creationTime);
        const chunkDate = new Date(targetChunks[0].creationTime);
        const chunkTime = (chunkDate - startDate) / 1000.0;
        const windowTime = reqTime - chunkTime;

        return windowTime;
    }

    async setupLoadSchedule(targetChunks) {
        const loadSchedule = this.getLoadSchedule(targetChunks);

        this.scoring.loadSchedule = loadSchedule;
        this.scoring.loadScheduleIndex = 0;
        await this.scoring.loadWindowFromSchedule(0);
    }

    async update() {
        const sourceInfo = this.getSourceInputs();
        const hierarchy = this.createHierarchy(sourceInfo);
        const reqTime = sourceInfo.time + sourceInfo.offset;

        console.log("Updating graph...");

        // Set up a new score instance with profile weights and params
        this.scoring = new Score();
        this.scoring.enableWindowSplicing = false; // Disable window splice so we can rewind for fitness test
        this.updateScoringFromInputs();
        this.updateProfileEmotionsFromInputs();

        // Get all the chunks for this hierarchy
        const chunks = await this.getChunks(hierarchy);

        if (!chunks || chunks.length === 0) {
            console.warn("No chunks found for the specified hierarchy");
            return;
        }

        // Filter for the ones around the requested time
        const targetChunks = this.filterChunksForTime(chunks, reqTime);

        if (!targetChunks || targetChunks.length === 0) {
            console.warn("No chunks found for the specified time");
            return;
        }

        // Get the time within the 3-minute window
        const windowTime = this.getWindowTime(reqTime, chunks, targetChunks);

        // Set up a load schedule around the requested time
        await this.setupLoadSchedule(targetChunks);

        // Calculate scores for the full 3-minute window
        await this.calculateScores(windowTime);

        // Update the offset line
        this.updateOffsetLine(windowTime);

        // Calculate fitness and update threshold/period lines
        await this.calculateFitness(windowTime);

        // Update the chart
        this.chart.update();

        // const sourceData = await this.getSourceData();
        // if (!sourceData) {
        //     console.warn("No source data found.");
        //     return;
        // }

        // await this.loadAndProcessData(sourceData);
    }

    updateScoringFromInputs() {
        // Basic scoring parameters
        this.scoring.softmaxAlpha = this.getFloatValue("softmax-alpha");
        this.scoring.combineSoftmaxAlpha = this.getFloatValue(
            "combine-softmax-alpha"
        );
        this.scoring.gainFactor = this.getFloatValue("gain-factor");

        this.scoring.windowSize = this.getFloatValue("window-size");
        // Decay weighting parameters
        this.scoring.useDecayWeighting = this.getCheckboxValue(
            "use-decay-weighting"
        );
        this.scoring.decayTimeConstant = this.getFloatValue(
            "decay-time-constant"
        );

        // UI squash parameters
        this.scoring.applyUiSquash = this.getCheckboxValue("apply-ui-squash");
        this.scoring.uiMid = this.getFloatValue("ui-mid");
        this.scoring.uiSpread = this.getFloatValue("ui-spread");

        // Robust normalization parameters
        this.scoring.useRobustNormalization =
            this.getCheckboxValue("apply-robust-norm");
        this.scoring.robustTargetStd = this.getFloatValue("robust-target-std");

        // Adaptive normalization parameters
        this.scoring.adaptiveNormalization = this.getCheckboxValue(
            "apply-adaptive-norm"
        );
        this.scoring.adaptiveBaselineSampleSize =
            this.getFloatValue("adaptive-baseline");
        this.scoring.adaptiveScalingFunction =
            this.getSelectValue("adaptive-function");
        this.scoring.adaptiveMinMultiplier = this.getFloatValue("adaptive-min");
        this.scoring.adaptiveMaxMultiplier = this.getFloatValue("adaptive-max");

        // Volatility factors
        this.scoring.newBoxVolatilityFactor = this.getFloatValue(
            "new-box-volatility-factor"
        );
        this.scoring.lostBoxVolatilityFactor = this.getFloatValue(
            "lost-box-volatility-factor"
        );
        this.scoring.boxVolatilityFactor = this.getFloatValue(
            "box-volatility-factor"
        );
    }

    updateProfileEmotionsFromInputs() {
        for (const emotion of this.validEmotions) {
            const emotionInput = document.getElementById(`emotion-${emotion}`);
            if (emotionInput) {
                profiles.profile.emotions[emotion] = parseFloat(
                    emotionInput.value
                );
            }
        }
    }

    // async loadAndProcessData(sourceData) {
    //     const { url, offset } = sourceData;

    //     // Convert offset time (seconds) to data index (4 samples per second)
    //     const offsetIndex = offset * 4;
    //     this.updateOffsetLine(offsetIndex);

    //     console.log(
    //         `Loading ${url}, offset: ${offset}s (index: ${offsetIndex})`
    //     );
    //     await this.scoring.loadWindow(url);
    //     this.processDataPoints();

    //     this.calculateFitness(offset);
    //     this.chart.update();
    // }

    updateOffsetLine(reqTime) {
        const offsetIndex = 30 * 4;
        this.offsetLine.xMin = offsetIndex;
        this.offsetLine.xMax = offsetIndex;
    }

    updateThreholdLines(baseLower, baseUpper, high) {
        this.baseLowerLine.yMin = baseLower;
        this.baseLowerLine.yMax = baseLower;
        this.baseUpperLine.yMin = baseUpper;
        this.baseUpperLine.yMax = baseUpper;
        this.highLine.yMin = high;
        this.highLine.yMax = high;
    }

    updatePeriodBox(time, box, period, label) {
        if (period) {
            const startTime = 30 - time + period.startTime;
            const endTime = 30 - time + period.endTime;
            box.xMin = startTime * 4;
            box.xMax = endTime * 4;
            box.display = true;
            box.label.content = label;
        } else {
            box.display = false;
        }
    }

    async calculateScores(windowTime) {
        // We don't want to reset the array because
        // Chart.js keeps a reference to it

        let idx = 0;
        for (let t = 0; t < 180; t += 0.25) {
            await this.scoring.handleTimeUpdate(t);

            if (t >= windowTime - 30 && t <= windowTime + 30) {
                this.data[idx] = this.scoring.currentScore;
                idx++;
            }
        }
    }

    // processDataPoints() {
    //     for (let t = 0; t < 60 * 4.0; t += 0.25) {
    //         this.updateScoring(0.25);
    //         this.data[Math.floor(t * 4)] = this.scoring.currentScore;
    //     }
    // }

    async calculateFitness(time) {
        const fitness = new Fitness(this.scoring);
        await fitness.buildScores(180.0);

        const score = fitness.evaluate(time);

        const highLabel = [
            "High Period",
            `timing=${score.timing.toFixed(2)}`,
            `sustain=${score.sustain.toFixed(2)}`,
            `stability=${score.highStability.toFixed(2)}`,
        ];
        const preBaselineLabel = [
            "Pre-Baseline",
            `stability=${score.preBaselineStability.toFixed(2)}`,
        ];
        const postBaselineLabel = [
            "Post-Baseline",
            `stability=${score.postBaselineStability.toFixed(2)}`,
        ];

        this.updatePeriodBox(
            time,
            this.highPeriodBox,
            score.details.highPeriod,
            highLabel
        );
        this.updatePeriodBox(
            time,
            this.preBaselineBox,
            score.details.preBaselinePeriod,
            preBaselineLabel
        );
        this.updatePeriodBox(
            time,
            this.postBaselineBox,
            score.details.postBaselinePeriod,
            postBaselineLabel
        );
        this.updateThreholdLines(
            score.details.thresholds.baselineLowerBound,
            score.details.thresholds.baselineUpperBound,
            score.details.thresholds.highThreshold
        );

        console.log(score);
    }

    // Helper methods for getting input values
    getFloatValue(id) {
        return parseFloat(document.getElementById(id).value);
    }

    getCheckboxValue(id) {
        return document.getElementById(id).checked;
    }

    getSelectValue(id) {
        return document.getElementById(id).value;
    }

    // updateScoring(dt) {
    //     const newTime = this.scoring.currentTime + dt;
    //     this.scoring.lastTime = this.scoring.currentTime;
    //     this.scoring.currentTime = newTime;
    //     this.scoring.lastSecond = this.scoring.currentSecond;
    //     this.scoring.currentSecond = Math.floor(this.scoring.currentTime);

    //     this.scoring.moveWindow();
    //     this.scoring.updateCurrentFromWindow();
    // }

    createInfoIcon(tooltipText) {
        const { span } = van.tags;
        return span(
            {
                class: "inline-flex items-center justify-center w-4 h-4 text-xs bg-blue-500 text-white rounded-full cursor-help ml-1 relative group",
                title: tooltipText,
                style: "font-family: monospace;",
            },
            "?"
            // // Tooltip element
            // span(
            //     {
            //         class: "absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 whitespace-nowrap max-w-xs text-center",
            //         style: "pointer-events: none;",
            //     },
            //     tooltipText
            // )
        );
    }
}

const settings = new Settings();
export { Settings, settings };
