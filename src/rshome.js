import van from "vanjs-core";
import { eventBus } from "./eventbus.js";
import { orgContext } from "./data/orgContext.js";
import { eventsData } from "./data/events.js";
import { FilesData } from "./data/files.js";
import { annotationsData } from "./data/annotations.js";

class Home {
    constructor() {
        this.analytics = {
            totalEvents: 0,
            totalHours: 0,
            totalFiles: 0,
            totalFileDuration: 0,
            recentAnnotations: [],
            recentActivity: []
        };
        this.blueskyPosts = [];
        this.loading = {
            analytics: true,
            bluesky: true
        };
        this.errors = {
            analytics: null,
            bluesky: null
        };
        this.filesData = new FilesData();
        this.currentOrgId = null;
        this.analyticsCache = new Map();
    }

    async init() {
        this.addElements();
        await Promise.all([
            this.loadAnalytics(),
            this.loadBlueskyFeed()
        ]);

        eventBus.on("org.changed", () => {
            this.loading.analytics = true;
            this.updateAnalyticsDisplay();
            this.loadAnalytics();
        });

        eventBus.on("annotations.updated", () => {
            const orgId = orgContext.getCurrentOrgId();
            if (orgId) this.analyticsCache.delete(orgId);
            this.loadAnalytics();
        });
    }

    async loadAnalytics() {
        const orgId = orgContext.getCurrentOrgId();
        this.currentOrgId = orgId;

        if (!orgId) {
            this.loading.analytics = false;
            this.errors.analytics = "No organization selected";
            this.updateAnalyticsDisplay();
            return;
        }

        const cached = this.analyticsCache.get(orgId);
        if (cached && Date.now() - cached.loadedAt < 60_000) {
            Object.assign(this.analytics, cached.data);
            this.loading.analytics = false;
            this.errors.analytics = null;
            this.updateAnalyticsDisplay();
        }

        const t0 = performance.now();
        try {
            const [events, annotations, files] = await Promise.all([
                eventsData.getByOrg(orgId),
                annotationsData.getByImportanceForOrg(
                    { value: 3, op: ">=" },
                    orgId
                ),
                this.filesData.getByOrg(orgId)
            ]);

            if (this.currentOrgId !== orgId) return;

            this.analytics.totalEvents = events.length;
            this.analytics.totalHours = this.calculateTotalHours(events);
            this.analytics.recentAnnotations = annotations
                .sort((a, b) => {
                    if (!a.created || !b.created) return 0;
                    return b.created.toMillis() - a.created.toMillis();
                })
                .slice(0, 10);
            this.analytics.recentActivity = this.getRecentActivity(events);
            this.applyFileStats(files);

            this.analyticsCache.set(orgId, {
                data: { ...this.analytics },
                loadedAt: Date.now()
            });

            console.log(
                `rshome analytics loaded in ${Math.round(
                    performance.now() - t0
                )}ms for org ${orgId}`
            );

            this.loading.analytics = false;
            this.errors.analytics = null;
            this.updateAnalyticsDisplay();
        } catch (error) {
            console.error("Error loading analytics:", error);
            this.errors.analytics = "Failed to load analytics data";
            this.loading.analytics = false;
            this.updateAnalyticsDisplay();
        }
    }

    applyFileStats(files) {
        let totalDuration = 0;
        for (const f of files) {
            if (typeof f.duration === "number") totalDuration += f.duration;
        }
        this.analytics.totalFiles = files.length;
        this.analytics.totalFileDuration = totalDuration;
    }

    async loadBlueskyFeed() {
        try {
            const response = await fetch("/bluesky/feed");
            if (!response.ok) throw new Error("Failed to fetch");

            const data = await response.json();
            this.blueskyPosts = data.posts || [];
            this.loading.bluesky = false;
            this.updateBlueskyDisplay();
        } catch (error) {
            console.error("Error loading Bluesky feed:", error);
            this.errors.bluesky = "Failed to load site news";
            this.loading.bluesky = false;
            this.updateBlueskyDisplay();
        }
    }

    addElements(parentElement) {
        const { div, main, h1, a, i, span } = van.tags;
        parentElement = parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-full p-4 overflow-auto" },

                // Getting started tip
                div(
                    {
                        class: "mb-6 flex items-start gap-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-500 dark:text-yellow-100 rounded-r-lg p-4"
                    },
                    i({ class: "las la-lightbulb text-2xl text-yellow-500 dark:text-yellow-300 mt-0.5" }),
                    div(
                        { class: "flex-1 text-sm" },
                        span({ class: "font-semibold" }, "New to Vy? "),
                        "Check out the ",
                        a(
                            {
                                href: "/docs#getting-started",
                                class: "underline font-medium hover:text-yellow-700 dark:hover:text-yellow-200"
                            },
                            "Getting Started guide"
                        ),
                        " to upload your first video and see behavior analysis results."
                    )
                ),

                // Page title
                div(
                    { class: "mb-6" },
                    h1(
                        { class: "text-3xl font-bold dark:text-white" },
                        "Vy Dashboard"
                    )
                ),

                // Two-column grid (Analytics 2/3, Site News 1/3)
                div(
                    {
                        class: "grid grid-cols-1 lg:grid-cols-3 gap-6"
                    },

                    // Left column: Analytics
                    div(
                        { class: "space-y-6 lg:col-span-2" },
                        this.createAnalyticsSection()
                    ),

                    // Right column: Site News
                    div(
                        { class: "space-y-6 lg:col-span-1" },
                        this.createSiteNewsSection()
                    )
                )
            )
        );
    }

    createAnalyticsSection() {
        const { div, h2 } = van.tags;

        return div(
            { class: "space-y-4" },

            h2(
                { class: "text-2xl font-semibold dark:text-white mb-4" },
                "Analytics"
            ),

            // Stats cards in a responsive grid
            div(
                { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" },
                this.createStatCard(
                    "Total Events",
                    () => this.analytics.totalEvents,
                    "calendar",
                    "bg-blue-500"
                ),
                this.createStatCard(
                    "Event Hours",
                    () => this.analytics.totalHours.toFixed(1),
                    "clock",
                    "bg-green-500"
                ),
                this.createStatCard(
                    "Total Files",
                    () => this.analytics.totalFiles,
                    "file-video",
                    "bg-purple-500"
                ),
                this.createStatCard(
                    "File Hours",
                    () =>
                        (this.analytics.totalFileDuration / 3600).toFixed(1),
                    "film",
                    "bg-orange-500"
                )
            ),

            // Recent alerts
            this.createRecentAlertsCard(),

            // Recent activity timeline
            this.createRecentActivityCard()
        );
    }

    createStatCard(label, getValue, icon, colorClass) {
        const { div, i, span } = van.tags;
        const slug = label.toLowerCase().replace(/\s+/g, "-");

        return div(
            {
                id: `stat-card-${slug}`,
                class: "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center space-x-4"
            },
            // Icon
            div(
                { class: `${colorClass} rounded-full p-3` },
                i({ class: `las la-${icon} text-2xl text-white` })
            ),
            // Content
            div(
                { class: "flex-1" },
                div(
                    { class: "text-gray-500 dark:text-gray-400 text-sm" },
                    label
                ),
                div(
                    {
                        id: `stat-${label.toLowerCase().replace(/\s+/g, "-")}`,
                        class: "text-2xl font-bold dark:text-white"
                    },
                    this.loading.analytics ? "..." : getValue()
                )
            )
        );
    }

    createRecentAlertsCard() {
        const { div, h3 } = van.tags;

        return div(
            { class: "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6" },
            h3(
                { class: "text-xl font-semibold dark:text-white mb-4" },
                "Recent Alerts"
            ),
            div(
                { id: "recent-alerts-content" },
                this.loading.analytics
                    ? this.createLoadingSpinner()
                    : this.createAlertsList()
            )
        );
    }

    createAlertsList() {
        const { ul, li, div, span } = van.tags;

        if (this.errors.analytics) {
            return div(
                { class: "text-red-500 dark:text-red-400 text-sm" },
                this.errors.analytics
            );
        }

        if (this.analytics.recentAnnotations.length === 0) {
            return div(
                { class: "text-gray-500 dark:text-gray-400 text-sm" },
                "No recent alerts"
            );
        }

        return ul(
            { class: "space-y-2" },
            ...this.analytics.recentAnnotations.map(annotation =>
                li(
                    { class: "flex items-start space-x-2 text-sm" },
                    span(
                        { class: "text-yellow-500" },
                        "●"
                    ),
                    div(
                        { class: "flex-1" },
                        div(
                            { class: "dark:text-white" },
                            annotation.text || "Alert"
                        ),
                        div(
                            { class: "text-gray-500 dark:text-gray-400 text-xs" },
                            this.formatTimestamp(annotation.created)
                        )
                    )
                )
            )
        );
    }

    createRecentActivityCard() {
        const { div, h3, ul, li, span } = van.tags;

        return div(
            { class: "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6" },
            h3(
                { class: "text-xl font-semibold dark:text-white mb-4" },
                "Recent Activity"
            ),
            div(
                { id: "recent-activity-content" },
                this.loading.analytics
                    ? this.createLoadingSpinner()
                    : this.createActivityList()
            )
        );
    }

    createActivityList() {
        const { ul, li, div, span } = van.tags;

        if (this.errors.analytics) {
            return div(
                { class: "text-red-500 dark:text-red-400 text-sm" },
                this.errors.analytics
            );
        }

        if (this.analytics.recentActivity.length === 0) {
            return div(
                { class: "text-gray-500 dark:text-gray-400 text-sm" },
                "No recent activity"
            );
        }

        return ul(
            { class: "space-y-2" },
            ...this.analytics.recentActivity.map(event =>
                li(
                    { class: "flex items-start space-x-2 text-sm" },
                    span(
                        { class: "text-blue-500" },
                        "●"
                    ),
                    div(
                        { class: "flex-1" },
                        div(
                            { class: "dark:text-white" },
                            event.description || event.hierarchy || "Event"
                        ),
                        div(
                            { class: "text-gray-500 dark:text-gray-400 text-xs" },
                            this.formatTimestamp(event.created)
                        )
                    )
                )
            )
        );
    }

    createSiteNewsSection() {
        const { div, h2 } = van.tags;

        return div(
            { class: "space-y-4" },

            h2(
                { class: "text-2xl font-semibold dark:text-white mb-4" },
                "Site News"
            ),

            div(
                {
                    class: "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
                },
                div(
                    { id: "bluesky-feed-content" },
                    this.loading.bluesky
                        ? this.createLoadingSpinner()
                        : this.createBlueskyFeed()
                )
            )
        );
    }

    createBlueskyFeed() {
        const { div, p, button } = van.tags;

        if (this.errors.bluesky) {
            return div(
                { class: "text-center py-4" },
                p(
                    { class: "text-red-500 dark:text-red-400 mb-2" },
                    this.errors.bluesky
                ),
                button(
                    {
                        class: "bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded",
                        onclick: () => this.retryBlueskyFeed()
                    },
                    "Retry"
                )
            );
        }

        if (this.blueskyPosts.length === 0) {
            return div(
                { class: "text-gray-500 dark:text-gray-400 text-center py-4" },
                "No recent posts"
            );
        }

        return div(
            { class: "space-y-4 max-h-[600px] overflow-y-auto" },
            ...this.blueskyPosts.map(post => this.createPostCard(post))
        );
    }

    createPostCard(post) {
        const { div, p, span, i } = van.tags;

        return div(
            { class: "border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0" },

            // Author info
            div(
                { class: "flex items-center space-x-2 mb-2" },
                i({ class: "lab la-app-store-ios text-blue-500 text-xl" }),
                span(
                    { class: "font-semibold dark:text-white" },
                    post.author.displayName
                ),
                span(
                    { class: "text-gray-500 dark:text-gray-400 text-sm" },
                    `@${post.author.handle}`
                )
            ),

            // Post content
            p(
                { class: "dark:text-gray-300 mb-2 whitespace-pre-wrap" },
                post.text
            ),

            // Timestamp
            div(
                { class: "text-gray-500 dark:text-gray-400 text-xs" },
                this.formatBlueskyTimestamp(post.createdAt)
            )
        );
    }

    createLoadingSpinner() {
        const { div, i } = van.tags;

        return div(
            { class: "flex justify-center items-center py-8" },
            i({
                class: "las la-spinner la-spin text-4xl text-blue-500"
            })
        );
    }

    updateAnalyticsDisplay() {
        const totalEventsEl = document.getElementById("stat-total-events");
        const eventHoursEl = document.getElementById("stat-event-hours");
        const totalFilesEl = document.getElementById("stat-total-files");
        const fileHoursEl = document.getElementById("stat-file-hours");
        const alertsContentEl = document.getElementById("recent-alerts-content");
        const activityContentEl = document.getElementById("recent-activity-content");

        if (totalEventsEl) {
            totalEventsEl.textContent = this.analytics.totalEvents;
        }
        if (eventHoursEl) {
            eventHoursEl.textContent = this.analytics.totalHours.toFixed(1);
        }
        if (totalFilesEl) {
            totalFilesEl.textContent = this.analytics.totalFiles;
        }
        if (fileHoursEl) {
            fileHoursEl.textContent = (
                this.analytics.totalFileDuration / 3600
            ).toFixed(1);
        }

        const hasEvents = this.analytics.totalEvents > 0;
        const hasFiles = this.analytics.totalFiles > 0;
        const eventsCard = document.getElementById("stat-card-total-events");
        const eventHoursCard = document.getElementById("stat-card-event-hours");
        const filesCard = document.getElementById("stat-card-total-files");
        const fileHoursCard = document.getElementById("stat-card-file-hours");
        if (eventsCard) eventsCard.style.display = hasEvents ? "" : "none";
        if (eventHoursCard) eventHoursCard.style.display = hasEvents ? "" : "none";
        if (filesCard) filesCard.style.display = hasFiles ? "" : "none";
        if (fileHoursCard) fileHoursCard.style.display = hasFiles ? "" : "none";
        if (alertsContentEl) {
            alertsContentEl.innerHTML = "";
            van.add(alertsContentEl, this.createAlertsList());
        }
        if (activityContentEl) {
            activityContentEl.innerHTML = "";
            van.add(activityContentEl, this.createActivityList());
        }
    }

    updateBlueskyDisplay() {
        const feedContentEl = document.getElementById("bluesky-feed-content");
        if (feedContentEl) {
            feedContentEl.innerHTML = "";
            van.add(feedContentEl, this.createBlueskyFeed());
        }
    }

    calculateTotalHours(events) {
        return events.reduce((sum, event) => {
            if (event.begin && event.end) {
                const durationMs = event.end.toMillis() - event.begin.toMillis();
                return sum + (durationMs / (1000 * 60 * 60));
            }
            return sum;
        }, 0);
    }

    getRecentActivity(events) {
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        return events
            .filter(event => {
                if (!event.created) return false;
                return event.created.toMillis() >= weekAgo;
            })
            .sort((a, b) => b.created.toMillis() - a.created.toMillis())
            .slice(0, 20);
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return "Unknown";
        const date = new Date(timestamp.toMillis());
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    }

    formatBlueskyTimestamp(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    }

    async retryBlueskyFeed() {
        this.errors.bluesky = null;
        this.loading.bluesky = true;
        this.updateBlueskyDisplay();
        await this.loadBlueskyFeed();
    }
}

const home = new Home();
export { Home, home };
