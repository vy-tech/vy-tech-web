import van from "vanjs-core";

import { eventBus } from "../eventbus.js";
import { annotations } from "../ui/annotations.js";
import { timeUtil } from "../util/time.js";

class AnnotationLog {
    /**
     * The annotation log displays a chat-like view of annotations associated with an event.
     * Annotations scroll automatically as the video time progresses.
     * It listens for "playback.ready" to load annotations for the current hierarchy
     * and "playback.timeupdate" to refresh the display.
     *
     * Annotations are marked with an importance of "low", "medium", "high" or "critical".
     *   * When importance="low" show a grey background
     *   * When importance="medium" show a blue background
     *   * When importance="high" show a yellow background
     *   * When importance="critical" show a red background and stick to the top or bottom of the log
     *
     * Annotations are marked with a type of "note", "transcript", "action" or "event".
     *   * When type="note" show a pencil emoji ✏️
     *   * When type="transcript" show a speech balloon emoji 💬
     *   * When type="action" show a baseball emoji ⚾
     *   * When type="event" show a party popper emoji 🎉
     *
     * Annotations have a format like: "✏️ This is a note annotation (hh:mm:ss)"
     * Annotations use the timeUtil.format function to format the time as hh:mm:ss
     **/
    constructor() {
        this.container = null;
        this.currentTime = 0;
        this.visibleElements = new Set(); // Track currently visible annotation IDs
        this.userScrollPaused = false; // Track if auto-scrolling is paused
        this.scrollPauseTimer = null; // Timer for auto-scroll pause
        this.isProgrammaticScroll = false; // Flag to distinguish programmatic vs user scrolling

        eventBus.on("playback.ready", async (e) => {
            this.hierarchy = e.detail.hierarchy;
            this.annotations = await annotations.getByHierarchy(this.hierarchy);
            this.createAnnotationElements();
        });

        eventBus.on("playback.timeupdate", (e) => {
            this.currentTime = e.detail.currentTime;
            this.paint();
        });

        eventBus.on("annotations.updated", async (e) => {
            console.log(
                "Annotations updated for current hierarchy, reinitializing..."
            );
            // Reload annotations and recreate elements
            this.annotations = await annotations.getByHierarchy(this.hierarchy);
            this.reinitializeContainers();
        });

        eventBus.on("ui.hierarchyChanged", async (e) => {
            this.hierarchy = e.detail.hierarchy;
            this.annotations = await annotations.getByHierarchy(this.hierarchy);
            this.reinitializeContainers();
        });
    }

    createElement(options = {}) {
        const { div } = van.tags;

        let merged = {
            id: "report-annotation-log",
            class: "w-full h-[95vh] flex flex-col",
            ...options,
        };

        this.container = div(merged);

        // Create the three main containers with proper flex constraints
        this.topStickyContainer = div({
            class: "flex-none max-h-[20vh] overflow-auto",
        });

        this.middleContainer = div({
            class: "flex-1 min-h-0 overflow-auto",
        });

        this.bottomStickyContainer = div({
            class: "flex-none max-h-[20vh] overflow-auto",
        });

        // Add all containers to main container
        van.add(
            this.container,
            this.topStickyContainer,
            this.middleContainer,
            this.bottomStickyContainer
        );

        this.setupVisibilityObserver();
        this.setupScrollListener();

        return this.container;
    }

    setStickyElementVisibility(container, dataId, isVisible) {
        if (!container) return;

        const element = container.querySelector(`[data-id="${dataId}"]`);
        if (element) {
            if (isVisible) {
                element.classList.remove("hidden");
            } else {
                element.classList.add("hidden");
            }
        }
    }

    // Add this method to your AnnotationLog class
    setupVisibilityObserver() {
        if (
            !this.middleContainer ||
            !this.topStickyContainer ||
            !this.bottomStickyContainer
        )
            return;

        // Track currently visible elements
        this.visibleElements = new Set();

        // Disconnect existing observer if it exists
        if (this.visibilityObserver) {
            this.visibilityObserver.disconnect();
        }

        this.visibilityObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const element = entry.target;
                    const annotationId = element.dataset.id;

                    if (entry.isIntersecting) {
                        this.visibleElements.add(annotationId);
                    } else {
                        this.visibleElements.delete(annotationId);
                    }

                    // Only handle critical annotations
                    if (element.dataset.importance === "critical") {
                        this.updateCriticalAnnotationVisibility();
                    }
                });
            },
            {
                root: this.middleContainer,
                rootMargin: "0px",
                threshold: 0.1,
            }
        );
    }

    setupScrollListener() {
        if (!this.middleContainer) return;

        // Use scrollend event to detect when programmatic scrolling completes
        this.middleContainer.addEventListener("scrollend", () => {
            this.isProgrammaticScroll = false;
        });

        this.middleContainer.addEventListener("scroll", (event) => {
            // Ignore programmatic scrolling
            if (this.isProgrammaticScroll) {
                return;
            }

            // User initiated scroll detected
            this.userScrollPaused = true;

            // Clear any existing timer
            if (this.scrollPauseTimer) {
                clearTimeout(this.scrollPauseTimer);
            }

            // Set timer to resume auto-scrolling after 5 seconds
            this.scrollPauseTimer = setTimeout(() => {
                this.userScrollPaused = false;
                console.log("Auto-scrolling resumed after user scroll pause");
            }, 5000); // 5 seconds

            console.log(
                "User scroll detected - pausing auto-scroll for 5 seconds"
            );
        });
    }

    updateCriticalAnnotationVisibility() {
        // Get all critical annotations
        const criticalAnnotations = this.annotations.filter(
            (a) => a.importance === "critical"
        );

        // Get the times of all currently visible annotations
        const visibleTimes = this.getVisibleAnnotationTimes();

        criticalAnnotations.forEach((annotation) => {
            const isVisible = this.visibleElements.has(annotation.id);

            if (isVisible) {
                // Hide from both sticky containers
                this.setStickyElementVisibility(
                    this.topStickyContainer,
                    annotation.id,
                    false
                );
                this.setStickyElementVisibility(
                    this.bottomStickyContainer,
                    annotation.id,
                    false
                );
            } else {
                // Determine if this annotation should go in top or bottom container
                // If the critical annotation's time is less than any visible annotation's time,
                // it should go in the top container, otherwise in the bottom container
                const shouldGoInTop = this.shouldCriticalAnnotationGoInTop(
                    annotation,
                    visibleTimes
                );

                if (shouldGoInTop) {
                    // Show in top sticky, hide from bottom
                    this.setStickyElementVisibility(
                        this.topStickyContainer,
                        annotation.id,
                        true
                    );
                    this.setStickyElementVisibility(
                        this.bottomStickyContainer,
                        annotation.id,
                        false
                    );
                    // Scroll top sticky to the bottom to show latest annotations
                    this.topStickyContainer.scrollTo({
                        top: this.topStickyContainer.scrollHeight,
                        behavior: "smooth",
                    });
                } else {
                    // Show in bottom sticky, hide from top
                    this.setStickyElementVisibility(
                        this.topStickyContainer,
                        annotation.id,
                        false
                    );
                    this.setStickyElementVisibility(
                        this.bottomStickyContainer,
                        annotation.id,
                        true
                    );
                }
            }
        });
    }

    getVisibleAnnotationTimes() {
        const visibleTimes = [];

        // Get times from all visible annotations
        this.visibleElements.forEach((annotationId) => {
            const annotation = this.annotations.find(
                (a) => a.id === annotationId
            );
            if (annotation) {
                visibleTimes.push(annotation.time);
            }
        });

        return visibleTimes;
    }

    shouldCriticalAnnotationGoInTop(criticalAnnotation, visibleTimes) {
        // If no annotations are visible, we can't determine position reliably
        // Default to bottom container
        if (visibleTimes.length === 0) {
            return false;
        }

        // If the critical annotation's time is less than ANY of the visible times,
        // it should go in the top container (it's "before" the visible content)
        return visibleTimes.some(
            (visibleTime) => criticalAnnotation.time < visibleTime
        );
    }

    getTypeEmoji(type) {
        switch (type) {
            case "note":
                return "✏️";
            case "transcript":
                return "💬";
            case "action":
                return "⚾";
            case "event":
                return "🎉";
            default:
                return "✏️";
        }
    }

    getImportanceClass(importance) {
        switch (importance) {
            case "low":
                return "bg-gray-200 text-gray-800";
            case "medium":
                return "bg-blue-200 text-blue-800";
            case "high":
                return "bg-yellow-200 text-yellow-800";
            case "critical":
                return "bg-red-200 text-red-800";
            default:
                return "bg-gray-200 text-gray-800";
        }
    }

    createAnnotationElement(annotation, addClass = "") {
        const { div, span, button } = van.tags;
        const timeStr = timeUtil.format(annotation.time, true);
        const emoji = this.getTypeEmoji(annotation.type);
        const bgClass = this.getImportanceClass(annotation.importance);

        const result = div(
            {
                class: `relative group p-2 m-1 rounded text-sm ${bgClass} border-l-4 ${
                    annotation.importance === "critical"
                        ? "border-red-500"
                        : "border-gray-300"
                } ${addClass}`,
            },
            div(
                {
                    class: "cursor-pointer",
                    onclick: () => {
                        eventBus.fire("ui.requestTimeSeek", {
                            seconds: annotation.time,
                        });
                        this.userScrollPaused = false; // Resume auto-scrolling on click
                    },
                },
                span(`${emoji} ${annotation.content}`),
                span({ class: "text-gray-500 text-xs ml-1" }, `(${timeStr})`)
            ),
            // Three dots menu button - hidden by default, shown on group hover
            button(
                {
                    class: "absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-6 h-6 rounded-full bg-gray-600 bg-opacity-75 hover:bg-opacity-90 text-white text-xs flex items-center justify-center",
                    onclick: (e) => {
                        e.stopPropagation(); // Prevent the seek action
                        eventBus.fire("ui.editAnnotation", {
                            annotation: annotation,
                        });
                    },
                    title: "Edit annotation",
                },
                "⋯" // Three dots character
            )
        );

        result.dataset.id = annotation.id;
        result.dataset.importance = annotation.importance;
        result.dataset.time = annotation.time;

        return result;
    }

    createAnnotationElements() {
        if (!this.middleContainer || !this.annotations) return;

        const { div } = van.tags;

        // Create and add annotation elements
        if (this.annotations.length > 0) {
            const elements = this.annotations.map((annotation) =>
                this.createAnnotationElement(annotation)
            );

            // Add elements to DOM first
            van.add(this.middleContainer, ...elements);

            // Then observe them (after they're in the DOM)
            if (this.visibilityObserver) {
                elements.forEach((element) => {
                    this.visibilityObserver.observe(element);
                });
            }

            let criticalElements = this.annotations.filter(
                (a) => a.importance === "critical"
            );

            van.add(
                this.topStickyContainer,
                ...criticalElements.map((annotation) =>
                    this.createAnnotationElement(annotation, "hidden")
                )
            );

            van.add(
                this.bottomStickyContainer,
                ...criticalElements.map((annotation) =>
                    this.createAnnotationElement(annotation)
                )
            );
        } else {
            // No annotations available
            van.add(
                this.middleContainer,
                div(
                    { class: "p-4 text-center text-gray-500 text-sm" },
                    "No annotations for this event"
                )
            );
        }
    }

    reinitializeContainers() {
        if (
            !this.middleContainer ||
            !this.topStickyContainer ||
            !this.bottomStickyContainer
        ) {
            return;
        }

        // Clear all containers
        this.middleContainer.innerHTML = "";
        this.topStickyContainer.innerHTML = "";
        this.bottomStickyContainer.innerHTML = "";

        // Reset the visibility observer
        if (this.visibilityObserver) {
            this.visibilityObserver.disconnect();
        }
        this.visibleElements.clear();

        // Recreate all annotation elements
        this.createAnnotationElements();

        console.log("Annotation containers reinitialized");
    }

    // async editAnnotation(annotation) {
    //     try {
    //         // Show the annotation form pre-populated with existing data
    //         const updatedAnnotation = await annotations.showAnnotationForm(
    //             annotation.time,
    //             null, // No wallclock time for editing existing annotations
    //             annotation // Pass existing annotation for pre-population
    //         );

    //         if (updatedAnnotation) {
    //             console.log("Annotation updated:", updatedAnnotation);
    //             // The form will handle the update/delete, no need to do anything here
    //         }
    //     } catch (error) {
    //         console.error("Error editing annotation:", error);
    //         alert("Failed to edit annotation. Please try again.");
    //     }
    // }

    paint() {
        if (
            !this.middleContainer ||
            !this.annotations ||
            this.annotations.length === 0
        )
            return;

        // Find the annotation with the greatest time that is less than current time
        const lastPassedAnnotation = this.annotations
            .filter((annotation) => annotation.time <= this.currentTime)
            .pop(); // Since array is sorted, pop() gets the last (greatest time) element

        if (lastPassedAnnotation) {
            // Find the DOM element for this annotation and scroll it to the bottom
            const annotationElements = this.middleContainer.children;
            const annotationIndex =
                this.annotations.indexOf(lastPassedAnnotation);

            if (
                annotationIndex >= 0 &&
                annotationIndex < annotationElements.length
            ) {
                const targetElement = annotationElements[annotationIndex];

                // Use getBoundingClientRect for accurate positioning
                const containerRect =
                    this.middleContainer.getBoundingClientRect();
                const elementRect = targetElement.getBoundingClientRect();

                // Calculate how much we need to scroll to get the element at the bottom
                const containerBottom = containerRect.bottom;
                const elementBottom = elementRect.bottom;

                // If element is below the visible area, scroll down to show it at bottom
                if (elementBottom > containerBottom) {
                    // Check if user scroll is paused
                    if (!this.userScrollPaused) {
                        const scrollAmount = elementBottom - containerBottom;
                        const currentScrollTop = this.middleContainer.scrollTop;

                        // Set flag to indicate this is programmatic scrolling
                        this.isProgrammaticScroll = true;

                        this.middleContainer.scrollTo({
                            top: currentScrollTop + scrollAmount,
                            behavior: "smooth",
                        });
                    }
                }
                // If element is above the visible area, scroll up to show it at bottom
                else if (elementRect.top < containerRect.top) {
                    // Check if user scroll is paused
                    if (!this.userScrollPaused) {
                        const elementTop = elementRect.top;
                        const containerTop = containerRect.top;
                        const containerHeight = containerRect.height;
                        const elementHeight = elementRect.height;

                        const scrollAmount =
                            elementTop -
                            containerTop +
                            elementHeight -
                            containerHeight;
                        const currentScrollTop = this.middleContainer.scrollTop;

                        // Set flag to indicate this is programmatic scrolling
                        this.isProgrammaticScroll = true;

                        this.middleContainer.scrollTo({
                            top: Math.max(0, currentScrollTop + scrollAmount),
                            behavior: "smooth",
                        });
                    }
                }
            }
        }
    }
}

const annotationLog = new AnnotationLog();
export default annotationLog;
export { annotationLog, AnnotationLog };
