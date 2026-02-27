import { v as van } from './chunks/van-t8DywzvC.js';
import { d as database } from './chunks/db-BZQDImdW.js';

class Home {
    constructor() {
        this.analytics = {
            totalEvents: 0,
            totalHours: 0,
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
    }

    async init() {
        this.addElements();
        await Promise.all([
            this.loadAnalytics(),
            this.loadBlueskyFeed()
        ]);
    }

    async loadAnalytics() {
        try {
            // Fetch all analytics data in parallel
            const [events, annotations] = await Promise.all([
                database.query("events"),
                database.query("annotations",
                    { importance: { value: 3, op: ">=" } }
                )
            ]);

            // Calculate metrics
            this.analytics.totalEvents = events.length;
            this.analytics.totalHours = this.calculateTotalHours(events);
            this.analytics.recentAnnotations = annotations
                .sort((a, b) => {
                    if (!a.created || !b.created) return 0;
                    return b.created.toMillis() - a.created.toMillis();
                })
                .slice(0, 10);
            this.analytics.recentActivity = this.getRecentActivity(events);

            this.loading.analytics = false;
            this.updateAnalyticsDisplay();
        } catch (error) {
            console.error("Error loading analytics:", error);
            this.errors.analytics = "Failed to load analytics data";
            this.loading.analytics = false;
            this.updateAnalyticsDisplay();
        }
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
        const { div, main, h1 } = van.tags;
        parentElement = parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },

                // Page title
                div(
                    { class: "mb-6" },
                    h1(
                        { class: "text-3xl font-bold dark:text-white" },
                        "Vy Dashboard"
                    )
                ),

                // Two-column grid
                div(
                    {
                        class: "grid grid-cols-1 lg:grid-cols-2 gap-6"
                    },

                    // Left column: Analytics
                    div(
                        { class: "space-y-6" },
                        this.createAnalyticsSection()
                    ),

                    // Right column: Site News
                    div(
                        { class: "space-y-6" },
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

            // Stats cards in 2-column grid
            div(
                { class: "grid grid-cols-1 sm:grid-cols-2 gap-4" },
                this.createStatCard(
                    "Total Events",
                    () => this.analytics.totalEvents,
                    "calendar",
                    "bg-blue-500"
                ),
                this.createStatCard(
                    "Video Hours",
                    () => this.analytics.totalHours.toFixed(1),
                    "clock",
                    "bg-green-500"
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

        return div(
            {
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
        const videoHoursEl = document.getElementById("stat-video-hours");
        const alertsContentEl = document.getElementById("recent-alerts-content");
        const activityContentEl = document.getElementById("recent-activity-content");

        if (totalEventsEl) {
            totalEventsEl.textContent = this.analytics.totalEvents;
        }
        if (videoHoursEl) {
            videoHoursEl.textContent = this.analytics.totalHours.toFixed(1);
        }
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
//# sourceMappingURL=rshome.js.map
