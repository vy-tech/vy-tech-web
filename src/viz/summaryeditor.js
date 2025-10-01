import van from "vanjs-core";
import * as d3 from "d3";
import { summarizer } from "../scoring/summarizer.js";
import { eventBus } from "../eventbus.js";
import { timeUtil } from "../util/time.js";
import { Hierarchy } from "../util/hierarchy.js";

class SummaryEditor {
    constructor() {
        this.container = null;
        this.svg = null;
        this.data = [];
        this.originalData = [];
        this.selection = null;
        this.editHistory = [];
        this.historyIndex = -1;
        this.currentTool = "select";
        this.isInitialized = false;
        this.currentTime = 0;
        this.windowSize = 300; // 5 minutes window
        this.playbackTimeline = null; // Full dataset reference
        this.isDrawing = false;
        this.drawPath = [];

        // Dimensions - will be set based on container
        this.margin = { top: 40, right: 40, bottom: 60, left: 60 };
        this.width = 0; // Will be set dynamically
        this.height = 400;
        this.innerWidth = 0; // Will be calculated
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;

        // Scales
        this.xScale = null;
        this.yScale = null;
        this.brush = null;

        // Listen for edit mode request
        eventBus.addEventListener("ui.requestEditMode", () => {
            if (!this.isInitialized) {
                this.init();
                this.loadData();
                this.isInitialized = true;
            }
        });

        // Listen for playback time updates when in edit mode
        eventBus.addEventListener("playback.timeupdate", (e) => {
            if (this.isInitialized && e.detail.currentTime !== undefined) {
                this.currentTime = Math.floor(e.detail.currentTime);
                this.updateWindow();
            }
        });

        // Handle window resize to maintain responsiveness
        window.addEventListener("resize", () => {
            if (this.isInitialized) {
                this.handleResize();
            }
        });

        eventBus.addEventListener("playback.ready", (e) => {
            this.hierarchy = new Hierarchy(e.detail.hierarchy);
        });

        eventBus.addEventListener("playback.cameraChanged", (e) => {
            this.hierarchy = new Hierarchy(e.detail.hierarchy);
            this.loadData();
        });
    }

    handleResize() {
        const containerRect = this.svgContainer.getBoundingClientRect();
        const newWidth = Math.max(800, containerRect.width || 1000);

        if (Math.abs(newWidth - this.width) > 50) {
            // Only resize if significant change
            this.width = newWidth;
            this.innerWidth = this.width - this.margin.left - this.margin.right;

            // Update SVG dimensions
            this.svg
                .attr("width", this.width)
                .attr("viewBox", `0 0 ${this.width} ${this.height}`);

            // Update background rect
            this.g.select("rect").attr("width", this.innerWidth);

            // Update interaction layer rects
            if (this.adjustRect) {
                this.adjustRect.attr("width", this.innerWidth);
            }
            if (this.drawRect) {
                this.drawRect.attr("width", this.innerWidth);
            }

            // Update scales and render
            if (this.xScale && this.data.length > 0) {
                this.xScale.range([0, this.innerWidth]);
                this.yScale.domain([-1000, 1000]); // Maintain fixed y-scale
                this.brush.extent([
                    [0, 0],
                    [this.innerWidth, this.innerHeight],
                ]);
                this.render();
            }
        }
    }

    createElement(options = {}) {
        const { div, button, span } = van.tags;

        // Toolbar
        this.toolbar = div(
            { class: "flex gap-2 p-2 bg-gray-800 border-b border-gray-700" },
            button(
                {
                    class: "px-3 py-1 bg-blue-500 text-white rounded",
                    onclick: () => this.setTool("select"),
                },
                "Select"
            ),
            button(
                {
                    class: "px-3 py-1 bg-yellow-500 text-white rounded",
                    onclick: () => this.setTool("adjust"),
                },
                "Adjust"
            ),
            button(
                {
                    class: "px-3 py-1 bg-orange-500 text-white rounded",
                    onclick: () => this.setTool("draw"),
                },
                "Draw"
            ),
            button(
                {
                    class: "px-3 py-1 bg-cyan-500 text-white rounded",
                    onclick: () => this.smooth(),
                },
                "Smooth"
            ),
            button(
                {
                    class: "px-3 py-1 bg-red-500 text-white rounded",
                    onclick: () => this.removeSpikes(),
                },
                "Remove Spikes"
            ),
            button(
                {
                    class: "px-3 py-1 bg-gray-500 text-white rounded",
                    onclick: () => this.undo(),
                },
                "Undo"
            ),
            button(
                {
                    class: "px-3 py-1 bg-gray-500 text-white rounded",
                    onclick: () => this.redo(),
                },
                "Redo"
            ),
            button(
                {
                    class: "px-3 py-1 bg-purple-500 text-white rounded",
                    onclick: () => this.exportData(),
                },
                "Export Changes"
            ),
            button(
                {
                    class: "px-3 py-1 bg-green-500 text-white rounded",
                    onclick: () => eventBus.fire("ui.requestViewMode"),
                },
                "Finish"
            )
        );

        // Selection info and time window info
        this.selectionInfo = div(
            {
                class: "p-2 bg-gray-800 text-gray-100 text-sm flex justify-between border-b border-gray-700",
            },
            span({ id: "selection-text" }, "No selection"),
            span(
                { id: "window-text" },
                `Window: ${this.windowSize}s around current time`
            )
        );

        // SVG container
        this.svgContainer = div({
            class: "w-full overflow-hidden bg-gray-900",
        });

        this.container = div(
            {
                class: "border rounded-lg bg-gray-900 border-gray-700",
                ...options,
            },
            this.toolbar,
            this.selectionInfo,
            this.svgContainer
        );

        return this.container;
    }

    init() {
        if (this.isInitialized) return;

        // Calculate responsive dimensions based on container
        const containerRect = this.svgContainer.getBoundingClientRect();
        this.width = Math.max(800, containerRect.width || 1000); // Minimum 800px
        this.innerWidth = this.width - this.margin.left - this.margin.right;

        // Create SVG
        this.svg = d3
            .select(this.svgContainer)
            .append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("viewBox", `0 0 ${this.width} ${this.height}`)
            .style("width", "100%")
            .style("height", "auto");

        // Add dark theme styling and improve label colors
        this.svg.append("defs").append("style").text(`
            .brush .selection {
                fill: rgba(59, 130, 246, 0.3);
                stroke: rgb(59, 130, 246);
                stroke-width: 2;
            }
            .axis text {
                fill: #e5e7eb;
                font-size: 12px;
            }
            .axis path,
            .axis line {
                stroke: #6b7280;
            }
            .tick text {
                fill: #e5e7eb;
            }
        `);

        // Create main group
        this.g = this.svg
            .append("g")
            .attr(
                "transform",
                `translate(${this.margin.left},${this.margin.top})`
            );

        // Add dark background to chart area
        this.g
            .append("rect")
            .attr("width", this.innerWidth)
            .attr("height", this.innerHeight)
            .attr("fill", "#111827")
            .attr("stroke", "#374151")
            .attr("stroke-width", 1);

        // Create scales
        this.xScale = d3.scaleLinear().range([0, this.innerWidth]);
        this.yScale = d3
            .scaleLinear()
            .range([this.innerHeight, 0])
            .domain([-1000, 1000]); // Fixed scale from -1000 to 1000

        // Create axes
        this.xAxis = d3
            .axisBottom(this.xScale)
            .tickFormat((d) => timeUtil.format(d, true));

        this.yAxis = d3.axisLeft(this.yScale);

        this.g
            .append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${this.innerHeight})`);

        this.g.append("g").attr("class", "y-axis");

        // Create separate interaction layers
        this.createInteractionLayers();

        // Add current time indicator line
        this.g
            .append("line")
            .attr("class", "current-time-line")
            .attr("stroke", "#ef4444")
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "5,5")
            .attr("y1", 0)
            .attr("y2", this.innerHeight);
    }

    createInteractionLayers() {
        // Create separate layers for each tool
        this.selectLayer = this.g.append("g").attr("class", "select-layer");
        this.adjustLayer = this.g.append("g").attr("class", "adjust-layer");
        this.drawLayer = this.g.append("g").attr("class", "draw-layer");

        // SELECT LAYER - Brush for range selection
        this.brush = d3
            .brushX()
            .extent([
                [0, 0],
                [this.innerWidth, this.innerHeight],
            ])
            .on("start", (event) => this.onBrushStart(event))
            .on("brush", (event) => this.onBrush(event))
            .on("end", (event) => this.onBrushEnd(event));

        this.selectLayer.append("g").attr("class", "brush").call(this.brush);

        // ADJUST LAYER - Transparent rect for click events
        this.adjustRect = this.adjustLayer
            .append("rect")
            .attr("width", this.innerWidth)
            .attr("height", this.innerHeight)
            .attr("fill", "transparent")
            .style("cursor", "crosshair")
            .on("click", (event) => this.handleAdjustClick(event));

        // DRAW LAYER - Transparent rect for drag events
        this.drawRect = this.drawLayer
            .append("rect")
            .attr("width", this.innerWidth)
            .attr("height", this.innerHeight)
            .attr("fill", "transparent")
            .style("cursor", "crosshair")
            .on("mousedown", (event) => this.startDrawing(event))
            .on("mousemove", (event) => this.continueDrawing(event));

        // Initially show only select layer
        this.selectLayer.style("display", "block");
        this.adjustLayer.style("display", "none");
        this.drawLayer.style("display", "none");
    }

    loadData() {
        const summary = summarizer.getCurrent();
        if (!summary || summary.length === 0) return;

        // Store full dataset reference
        this.playbackTimeline = summary.map((d, i) => ({
            time: parseInt(d.startTime),
            score: d.score,
            people: d.people,
            index: i,
            changed: false, // Track which points have been modified
        }));

        // Load initial window
        this.updateWindow();
    }

    updateWindow() {
        if (!this.playbackTimeline) return;

        const halfWindow = this.windowSize / 2;
        const startTime = Math.max(0, this.currentTime - halfWindow);
        const endTime = this.currentTime + halfWindow;

        // Filter data to current window
        this.data = this.playbackTimeline.filter(
            (d) => d.time >= startTime && d.time <= endTime
        );

        if (this.data.length === 0) return;

        // Update scales for current window
        this.xScale.domain([startTime, endTime]);
        this.yScale.domain([-1000, 1000]); // Fixed scale from -1000 to 1000

        // Save state if this is the first load
        if (this.editHistory.length === 0) {
            this.saveState();
        }

        this.render();
        this.updateWindowInfo();
    }

    render() {
        if (!this.svg || this.data.length === 0) return;

        // Update axes
        this.g.select(".x-axis").call(this.xAxis);
        this.g.select(".y-axis").call(this.yAxis);

        // Create line generator
        const line = d3
            .line()
            .x((d) => this.xScale(d.time))
            .y((d) => this.yScale(d.score))
            .curve(d3.curveLinear);

        // Render score line
        const path = this.g.selectAll(".score-line").data([this.data]);

        path.enter()
            .append("path")
            .attr("class", "score-line")
            .attr("fill", "none")
            .attr("stroke", "#60a5fa")
            .attr("stroke-width", 3)
            .merge(path)
            .attr("d", line);

        // Update current time indicator
        this.g
            .select(".current-time-line")
            .attr("x1", this.xScale(this.currentTime))
            .attr("x2", this.xScale(this.currentTime));

        // Update brush extent to match current scales
        this.brush.extent([
            [0, 0],
            [this.innerWidth, this.innerHeight],
        ]);
        this.selectLayer.select(".brush").call(this.brush);

        // Maintain crosshair if in adjust or draw mode
        if (this.currentTool === "adjust") {
            this.showCrosshair("#eab308");
        } else if (this.currentTool === "draw") {
            this.showCrosshair("#10b981");
        }
    }

    // Tool methods
    setTool(tool) {
        this.currentTool = tool;

        // Update UI to show active tool
        this.container.querySelectorAll("button").forEach((btn) => {
            btn.classList.remove("ring-2", "ring-blue-300");
        });

        // Highlight active tool button
        const buttons = this.container.querySelectorAll("button");
        const toolMap = {
            select: 0,
            adjust: 1,
            draw: 2,
        };

        if (toolMap[tool] !== undefined) {
            buttons[toolMap[tool]].classList.add("ring-2", "ring-blue-300");
        }

        // Configure interaction mode based on tool
        if (tool === "select") {
            this.enableSelectMode();
        } else if (tool === "adjust") {
            this.enableAdjustMode();
        } else if (tool === "draw") {
            this.enableDrawMode();
        }
    }

    enableSelectMode() {
        this.selectLayer.style("display", "block");
        this.adjustLayer.style("display", "none");
        this.drawLayer.style("display", "none");

        // Enable brush interaction
        this.selectLayer.select(".brush").style("pointer-events", "all");

        this.hideCrosshair();
        this.isDrawing = false;
    }

    enableAdjustMode() {
        this.selectLayer.style("display", "block");
        this.adjustLayer.style("display", "block");
        this.drawLayer.style("display", "none");

        // Disable brush interaction but keep selection visible
        this.selectLayer.select(".brush").style("pointer-events", "none");

        this.showCrosshair("#eab308"); // Yellow crosshair
        this.isDrawing = false;
    }

    enableDrawMode() {
        this.selectLayer.style("display", "none");
        this.adjustLayer.style("display", "none");
        this.drawLayer.style("display", "block");

        // Clear selection when entering draw mode
        this.brush.clear(this.selectLayer.select(".brush"));
        this.selection = null;
        this.updateSelectionInfo();

        this.showCrosshair("#10b981"); // Green crosshair
    }

    // Adjust tool - click to create spikes/valleys
    handleAdjustClick(event) {
        if (this.currentTool !== "adjust") return;

        const [mouseX, mouseY] = d3.pointer(event, this.g.node());

        // Convert pixel coordinates to data coordinates
        const clickTime = this.xScale.invert(mouseX);
        const targetScore = Math.max(
            -1000,
            Math.min(1000, this.yScale.invert(mouseY))
        );

        // Find the closest data point in time
        const closestPoint = this.data.reduce((prev, curr) =>
            Math.abs(curr.time - clickTime) < Math.abs(prev.time - clickTime)
                ? curr
                : prev
        );

        if (closestPoint) {
            this.createAdjustment(closestPoint, targetScore);
        }
    }

    createAdjustment(centerPoint, targetScore) {
        const originalScore = centerPoint.score;
        const centerTime = centerPoint.time;

        // Determine affected points based on selection or default range
        let affectedPoints;
        let leftBound, rightBound;

        if (this.selection) {
            // Use selection bounds for affected points
            const [selStart, selEnd] = this.selection;
            leftBound = selStart;
            rightBound = selEnd;
            affectedPoints = this.data.filter(
                (d) => d.time >= selStart && d.time <= selEnd
            );
        } else {
            // Default ±2 seconds around center point
            leftBound = centerTime - 2;
            rightBound = centerTime + 2;
            affectedPoints = this.data.filter(
                (d) => d.time >= leftBound && d.time <= rightBound
            );
        }

        // Calculate asymmetrical distances for falloff
        const leftDistance = Math.abs(centerTime - leftBound);
        const rightDistance = Math.abs(rightBound - centerTime);

        affectedPoints.forEach((point) => {
            const oldScore = point.score;

            if (point.time === centerTime) {
                // Center point gets the exact target score
                point.score = targetScore;
            } else {
                // Calculate asymmetrical falloff
                let falloffStrength;

                if (point.time < centerTime) {
                    // Point is to the left of center
                    const distance = centerTime - point.time;
                    if (leftDistance > 0) {
                        const normalizedDistance = distance / leftDistance;
                        falloffStrength = Math.sin(
                            ((1 - normalizedDistance) * Math.PI) / 2
                        );
                    } else {
                        falloffStrength = 1; // Full strength if no left distance
                    }
                } else {
                    // Point is to the right of center
                    const distance = point.time - centerTime;
                    if (rightDistance > 0) {
                        const normalizedDistance = distance / rightDistance;
                        falloffStrength = Math.sin(
                            ((1 - normalizedDistance) * Math.PI) / 2
                        );
                    } else {
                        falloffStrength = 1; // Full strength if no right distance
                    }
                }

                // Apply the adjustment with falloff
                point.score =
                    originalScore +
                    (targetScore - originalScore) * falloffStrength;
            }

            // Mark as changed if score actually changed
            if (point.score !== oldScore) {
                point.changed = true;
            }
        });

        this.saveState();
        this.render();

        console.log(
            `Adjusted point at ${centerTime}s to score ${targetScore} affecting ${affectedPoints.length} points (left: ${leftDistance}s, right: ${rightDistance}s)`
        );
    }

    // Draw tool - drag to draw points manually
    startDrawing(event) {
        if (this.currentTool !== "draw") return;

        this.isDrawing = true;
        this.drawPath = [];

        const [mouseX, mouseY] = d3.pointer(event, this.g.node());
        const time = this.xScale.invert(mouseX);
        const score = Math.max(
            -1000,
            Math.min(1000, this.yScale.invert(mouseY))
        );

        this.drawPath.push({ time, score });

        // Add document-level mouseup listener to ensure we catch it
        const handleMouseUp = () => {
            this.stopDrawing();
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mouseup", handleMouseUp);
    }

    continueDrawing(event) {
        if (!this.isDrawing || this.currentTool !== "draw") return;

        const [mouseX, mouseY] = d3.pointer(event, this.g.node());
        const time = this.xScale.invert(mouseX);
        const score = Math.max(
            -1000,
            Math.min(1000, this.yScale.invert(mouseY))
        );

        this.drawPath.push({ time, score });

        // Apply drawing in real-time
        this.applyDrawPath();
    }

    stopDrawing() {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        if (this.drawPath.length > 0) {
            this.applyDrawPath();
            this.saveState();
            this.render();

            console.log(`Drew ${this.drawPath.length} points`);
        }

        this.drawPath = [];
    }

    applyDrawPath() {
        if (this.drawPath.length === 0) return;

        // For each point in the draw path, find and update the closest data point
        this.drawPath.forEach((drawPoint) => {
            const closestDataPoint = this.data.reduce((prev, curr) =>
                Math.abs(curr.time - drawPoint.time) <
                Math.abs(prev.time - drawPoint.time)
                    ? curr
                    : prev
            );

            if (
                closestDataPoint &&
                Math.abs(closestDataPoint.time - drawPoint.time) <= 1
            ) {
                const oldScore = closestDataPoint.score;
                closestDataPoint.score = drawPoint.score;

                // Mark as changed if score actually changed
                if (closestDataPoint.score !== oldScore) {
                    closestDataPoint.changed = true;
                }
            }
        });

        this.render();
    }

    // Visual feedback methods
    showCrosshair(color = "#eab308") {
        // Remove existing crosshair
        this.g.selectAll(".crosshair").remove();

        const crosshair = this.g.append("g").attr("class", "crosshair");

        const vLine = crosshair
            .append("line")
            .attr("class", "crosshair-v")
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3")
            .attr("y1", 0)
            .attr("y2", this.innerHeight)
            .style("pointer-events", "none")
            .style("opacity", 0);

        const hLine = crosshair
            .append("line")
            .attr("class", "crosshair-h")
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3")
            .attr("x1", 0)
            .attr("x2", this.innerWidth)
            .style("pointer-events", "none")
            .style("opacity", 0);

        // Add score indicator
        const scoreText = crosshair
            .append("text")
            .attr("class", "crosshair-score")
            .attr("fill", color)
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .style("pointer-events", "none")
            .style("opacity", 0);

        this.svg.on("mousemove.crosshair", (event) => {
            const [mouseX, mouseY] = d3.pointer(event, this.g.node());
            const score = Math.round(this.yScale.invert(mouseY));

            vLine.attr("x1", mouseX).attr("x2", mouseX).style("opacity", 0.7);
            hLine.attr("y1", mouseY).attr("y2", mouseY).style("opacity", 0.7);

            scoreText
                .attr("x", mouseX + 10)
                .attr("y", mouseY - 10)
                .text(score)
                .style("opacity", 0.8);
        });

        this.svg.on("mouseleave.crosshair", () => {
            vLine.style("opacity", 0);
            hLine.style("opacity", 0);
            scoreText.style("opacity", 0);
        });
    }

    hideCrosshair() {
        this.g.selectAll(".crosshair").remove();
        this.svg.on("mousemove.crosshair", null);
        this.svg.on("mouseleave.crosshair", null);
    }

    smooth() {
        if (!this.selection) return;

        const [start, end] = this.selection;
        const selectedData = this.data.filter(
            (d) => d.time >= start && d.time <= end
        );

        if (selectedData.length < 3) return;

        // Simple moving average smoothing
        const windowSize = Math.min(5, Math.floor(selectedData.length / 3));

        selectedData.forEach((d, i) => {
            if (i >= windowSize && i < selectedData.length - windowSize) {
                const oldScore = d.score;
                const window = selectedData.slice(
                    i - windowSize,
                    i + windowSize + 1
                );
                d.score = d3.mean(window, (w) => w.score);

                // Mark as changed if score actually changed
                if (d.score !== oldScore) {
                    d.changed = true;
                }
            }
        });

        this.saveState();
        this.render();
    }

    removeSpikes() {
        if (!this.selection) return;

        const [start, end] = this.selection;
        const selectedData = this.data.filter(
            (d) => d.time >= start && d.time <= end
        );

        if (selectedData.length === 0) return;

        // Simple spike removal: replace outliers with interpolated values
        const scores = selectedData.map((d) => d.score);
        const mean = d3.mean(scores);
        const stdDev = d3.deviation(scores);
        const threshold = 2; // 2 standard deviations

        selectedData.forEach((d, i) => {
            if (Math.abs(d.score - mean) > threshold * stdDev) {
                const prevPoint = selectedData[i - 1];
                const nextPoint = selectedData[i + 1];

                if (prevPoint && nextPoint) {
                    const oldScore = d.score;
                    d.score = (prevPoint.score + nextPoint.score) / 2;

                    // Mark as changed if score actually changed
                    if (d.score !== oldScore) {
                        d.changed = true;
                    }
                }
            }
        });

        this.saveState();
        this.render();
    }

    // Save changes back to summarizer
    saveChanges() {
        const updatedSummary = this.playbackTimeline.map((d) => ({
            startTime: d.time.toString(),
            score: d.score,
            people: d.people,
        }));

        // Update the summarizer with edited data
        if (summarizer.updateCurrent) {
            summarizer.updateCurrent(updatedSummary);
        }

        // Dispatch event to notify other components
        eventBus.dispatchEvent(
            new CustomEvent("scoring.dataUpdated", {
                detail: { updatedPoints: this.data.length },
            })
        );

        console.log("Saved changes to summarizer");
    }

    // History management - only for current window
    saveState() {
        const state = this.data.map((d) => ({ ...d }));
        this.editHistory = this.editHistory.slice(0, this.historyIndex + 1);
        this.editHistory.push(state);
        this.historyIndex++;

        // Limit history size for window-based editing
        if (this.editHistory.length > 20) {
            this.editHistory.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.data = this.editHistory[this.historyIndex].map((d) => ({
                ...d,
            }));
            this.render();
        }
    }

    redo() {
        if (this.historyIndex < this.editHistory.length - 1) {
            this.historyIndex++;
            this.data = this.editHistory[this.historyIndex].map((d) => ({
                ...d,
            }));
            this.render();
        }
    }

    // Brush event handlers
    onBrushStart(event) {
        // Only process brush events when in select mode
        if (this.currentTool !== "select") return;

        // Clear any existing selection display on start
        if (!event.selection) {
            this.selection = null;
            this.updateSelectionInfo();
        }
    }

    onBrush(event) {
        // Only process brush events when in select mode
        if (this.currentTool !== "select") return;

        // Update selection during brushing
        if (event.selection) {
            this.selection = event.selection.map(this.xScale.invert);
            this.updateSelectionInfo();
        }
    }

    onBrushEnd(event) {
        // Only process brush events when in select mode
        if (this.currentTool !== "select") return;

        const selection = event.selection;
        if (selection) {
            // Set final selection
            this.selection = selection.map(this.xScale.invert);
            this.updateSelectionInfo();
        } else {
            // Clear selection if click without drag
            this.selection = null;
            this.updateSelectionInfo();
        }
    }

    // UI updates
    updateSelectionInfo() {
        const infoEl = this.container.querySelector("#selection-text");
        if (this.selection) {
            const [start, end] = this.selection;
            const duration = Math.round(end - start);
            infoEl.textContent = `Selected: ${timeUtil.format(
                start,
                true
            )} - ${timeUtil.format(end, true)} (${duration}s)`;
        } else {
            infoEl.textContent = "No selection";
        }
    }

    updateWindowInfo() {
        const windowEl = this.container.querySelector("#window-text");
        if (windowEl) {
            const halfWindow = this.windowSize / 2;
            const startTime = Math.max(0, this.currentTime - halfWindow);
            const endTime = this.currentTime + halfWindow;
            windowEl.textContent = `Window: ${timeUtil.format(
                startTime
            )} - ${timeUtil.format(endTime)} (${this.data.length} points)`;
        }
    }

    // Export only changed points with original indexes
    exportData() {
        // Filter to only changed points and include original indexes
        const changedPoints = this.playbackTimeline
            .filter((d) => d.changed)
            .map((d) => [d.index, d.time, d.score, d.people]);

        if (changedPoints.length === 0) {
            alert("No changes to export!");
            return [];
        }

        // Create a blob and download link
        const blob = new Blob([JSON.stringify(changedPoints, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        a.download = `edited-changes-${this.hierarchy.toString("-")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(
            "Exported changed data:",
            changedPoints.length,
            "points out of",
            this.playbackTimeline.length,
            "total"
        );
        return changedPoints;
    }
}

const summaryEditor = new SummaryEditor();
export default summaryEditor;
export { summaryEditor, SummaryEditor };
