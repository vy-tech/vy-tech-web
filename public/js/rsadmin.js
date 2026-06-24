import { r as rsv } from './chunks/rsvan-Ce3jJxXt.js';
import { v as van, e as eventBus } from './chunks/eventbus-c5hoJhOF.js';
import { a as apiUtil, d as database } from './chunks/apiUtil-CDq4WBQY.js';
import { t as timeUtil } from './chunks/time-Ckmoh8eN.js';

class Admin {
    constructor() {
        this.statusLabels = [
            "requested",
            "processing",
            "waiting",
            "failed",
            "completed",
        ];
        this.isAdmin = van.state(null); // null = unknown, false = denied, true = allowed
        this.activeTab = van.state("jobs");
        this.jobsStats = van.state(null);
        this.searchQuery = van.state("");
        this.searchResults = van.state({ orgs: [], users: [] });
        this.searching = van.state(false);
        this.grantState = van.state({}); // { [oid]: { amount, note, busy, error, success } }
        this.orgsLoading = van.state(false);
        this.orgsData = van.state(null); // { orgs: [...] } once loaded
        this.orgsError = van.state(null);
        this.orgsExpanded = van.state({}); // { [oid]: bool }
    }

    async init() {
        eventBus.on("auth.unauthenticated", () => {
            window.location.href =
                "/users/login?return_url=" +
                encodeURIComponent(window.location.href);
        });

        this.addElements();

        eventBus.on("org.changed", async () => {
            await this.checkAdmin();
            if (this.isAdmin.val && this.activeTab.val === "jobs") {
                this.mountJobsChart();
            }
        });
    }

    async checkAdmin() {
        try {
            const res = await apiUtil.call("/api/billing/admin/status");
            this.isAdmin.val = !!res.isAdmin;
        } catch (err) {
            console.warn("Admin status check failed:", err);
            this.isAdmin.val = false;
        }
    }

    addElements(parentElement) {
        const { div, main, h1 } = van.tags;
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
                    { class: "max-w-5xl mx-auto" },
                    h1(
                        { class: "text-2xl font-bold mb-6 dark:text-white" },
                        "Admin"
                    ),
                    () => this.renderBody()
                )
            )
        );
    }

    renderBody() {
        const { div, p } = van.tags;
        if (this.isAdmin.val === null) {
            return div(
                { class: "text-gray-500 dark:text-gray-400 py-8 text-center" },
                "Checking access…"
            );
        }
        if (this.isAdmin.val === false) {
            return div(
                {
                    class: "bg-white dark:bg-gray-800 rounded-lg shadow p-8 border border-gray-200 dark:border-gray-700",
                },
                p(
                    { class: "dark:text-white font-medium mb-2" },
                    "Admin access required."
                ),
                p(
                    { class: "text-sm text-gray-500 dark:text-gray-400" },
                    "This page is restricted to Vy staff."
                )
            );
        }
        return div(
            this.createTabNav(),
            div({ class: "mt-4" }, () => {
                switch (this.activeTab.val) {
                    case "jobs":
                        return this.createJobsTab();
                    case "credits":
                        return this.createCreditsTab();
                    case "orgs":
                        return this.createOrgsTab();
                }
            })
        );
    }

    createTabNav() {
        const { div, button } = van.tags;

        const tabButton = (id, label) =>
            button(
                {
                    class: () =>
                        `px-4 py-2 font-medium rounded-t-lg border-b-2 transition-colors ${
                            this.activeTab.val === id
                                ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800"
                                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`,
                    onclick: () => {
                        this.activeTab.val = id;
                        if (id === "jobs") this.mountJobsChart();
                    },
                },
                label
            );

        return div(
            {
                class: "flex space-x-2 border-b border-gray-200 dark:border-gray-700",
            },
            tabButton("jobs", "Jobs"),
            tabButton("credits", "Credits"),
            tabButton("orgs", "Orgs & Users")
        );
    }

    // =========================================================================
    // Jobs Tab
    // =========================================================================

    createJobsTab() {
        const { div, h2, canvas } = van.tags;
        // The canvas is newly mounted each time this tab becomes active;
        // defer chart init to the next frame so the canvas exists in the DOM.
        requestAnimationFrame(() => this.mountJobsChart());
        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700",
            },
            h2(
                { class: "text-lg font-semibold mb-4 dark:text-white" },
                "Jobs by status"
            ),
            div(
                { class: "flex justify-center" },
                canvas({
                    id: "admin-jobs",
                    width: 640,
                    height: 360,
                })
            ),
            div(
                {
                    class: "mt-6 pt-6 border-t border-gray-200 dark:border-gray-700",
                },
                () => this.renderJobsStats()
            )
        );
    }

    async mountJobsChart() {
        this.initJobsChart();
        await this.updateJobsChart();
    }

    async getJobsByStatus() {
        let result = {
            requested: { status: "requested", count: 0, jobs: [] },
            processing: { status: "processing", count: 0, jobs: [] },
            waiting: { status: "waiting", count: 0, jobs: [] },
            failed: { status: "failed", count: 0, jobs: [] },
            completed: { status: "completed", count: 0, jobs: [] },
        };

        const rows = await database.query("jobs");

        rows.forEach((data) => {
            let status = result[data.status];
            if (!status) return;
            status.count += 1;
            status.jobs.push(data);
        });

        return result;
    }

    initJobsChart() {
        const canvas = document.getElementById("admin-jobs");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        if (this.jobsChart) this.jobsChart.destroy();

        this.jobsChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: this.statusLabels,
                datasets: [
                    {
                        label: "Status",
                        data: this.statusLabels.map(() => 0),
                        fill: true,
                        borderWidth: 1,
                        borderColor: "red",
                        backgroundColor: "red",
                    },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
            },
        });
        this.jobsChart.update();
    }

    async updateJobsChart() {
        let jobs = await this.getJobsByStatus();

        if (this.jobsChart) {
            let data = this.statusLabels.map((label) => jobs[label].count);
            this.jobsChart.data.datasets[0].data = data;
            this.jobsChart.update();
        }

        this.jobsStats.val = this.computeJobsStats(jobs);
    }

    computeJobsStats(jobs) {
        // Completed jobs carry the processing-time signal only if the backend
        // stamped a `started` field (added when requested -> processing). Older
        // jobs without it are excluded from every stat.
        const completed = jobs.completed.jobs.filter((job) => job.started);

        const byType = {}; // type -> { count, totalSeconds }
        let totalCount = 0;
        let totalSeconds = 0;

        for (const job of completed) {
            const started = job.started?.toDate
                ? job.started.toDate()
                : new Date(job.started);
            const updated = job.updated?.toDate
                ? job.updated.toDate()
                : new Date(job.updated);
            const seconds = (updated - started) / 1000;
            if (!isFinite(seconds) || seconds < 0) continue;

            const type = job.type || "unknown";
            if (!byType[type]) byType[type] = { count: 0, totalSeconds: 0 };
            byType[type].count += 1;
            byType[type].totalSeconds += seconds;
            totalCount += 1;
            totalSeconds += seconds;
        }

        const remaining = jobs.requested.count + jobs.processing.count;

        const requestedByType = {};
        for (const job of jobs.requested.jobs) {
            const type = job.type || "unknown";
            requestedByType[type] = (requestedByType[type] || 0) + 1;
        }
        const processingByType = {};
        for (const job of jobs.processing.jobs) {
            const type = job.type || "unknown";
            processingByType[type] = (processingByType[type] || 0) + 1;
        }

        const types = Object.entries(byType)
            .map(([type, agg]) => {
                const avgSeconds = agg.totalSeconds / agg.count;
                const perHour = avgSeconds > 0 ? 3600 / avgSeconds : 0;
                const ratio = totalCount > 0 ? agg.count / totalCount : 0;
                const requestedCount = requestedByType[type] || 0;
                // Treat processing count as the parallelism level draining the
                // requested queue. Fall back to 1 when nothing is in flight.
                const parallelism = processingByType[type] || 1;
                const etaSeconds = (requestedCount * avgSeconds) / parallelism;
                return {
                    type,
                    count: agg.count,
                    avgSeconds,
                    perHour,
                    ratio,
                    etaSeconds,
                };
            })
            .sort((a, b) => b.count - a.count);

        const avgSecondsOverall =
            totalCount > 0 ? totalSeconds / totalCount : 0;
        const perHourOverall =
            avgSecondsOverall > 0 ? 3600 / avgSecondsOverall : 0;
        const etaSecondsTotal = types.reduce((sum, t) => sum + t.etaSeconds, 0);

        return {
            totalCount,
            remaining,
            avgSecondsOverall,
            perHourOverall,
            etaSecondsTotal,
            types,
        };
    }

    renderJobsStats() {
        const { div, h2, table, thead, tbody, tr, th, td } = van.tags;
        const stats = this.jobsStats.val;

        if (!stats || stats.totalCount === 0) {
            return div(
                { class: "text-sm text-gray-500 dark:text-gray-400" },
                "No completed jobs with timing data yet."
            );
        }

        const summaryCard = (label, value) =>
            div(
                {
                    class: "bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700",
                },
                div(
                    {
                        class: "text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400",
                    },
                    label
                ),
                div(
                    {
                        class: "text-lg font-semibold dark:text-gray-400 mt-1",
                    },
                    value
                )
            );

        const headerCell = (text, extra = "") =>
            th(
                {
                    class: `px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 ${extra}`,
                },
                text
            );

        const dataCell = (content, extra = "") =>
            td(
                {
                    class: `px-3 py-2 text-sm dark:text-gray-200 ${extra}`,
                },
                content
            );

        return div(
            h2(
                { class: "text-lg font-semibold mb-4 dark:text-white" },
                "Processing statistics"
            ),
            div(
                {
                    class: "grid grid-cols-2 md:grid-cols-5 gap-3 mb-6",
                },
                summaryCard("Timed completions", String(stats.totalCount)),
                summaryCard(
                    "Overall rate",
                    `${stats.perHourOverall.toFixed(1)}/hr`
                ),
                summaryCard(
                    "Avg processing",
                    timeUtil.format(stats.avgSecondsOverall, true)
                ),
                summaryCard("Remaining jobs", String(stats.remaining)),
                summaryCard(
                    "Est. time remaining",
                    timeUtil.format(stats.etaSecondsTotal, true)
                )
            ),
            div(
                { class: "overflow-x-auto" },
                table(
                    { class: "min-w-full" },
                    thead(
                        {
                            class: "border-b border-gray-200 dark:border-gray-700",
                        },
                        tr(
                            headerCell("Type", "text-left"),
                            headerCell("Completed", "text-right"),
                            headerCell("Ratio", "text-right"),
                            headerCell("Avg time", "text-right"),
                            headerCell("Jobs/hr", "text-right")
                        )
                    ),
                    tbody(
                        stats.types.map((t) =>
                            tr(
                                {
                                    class: "border-b border-gray-100 dark:border-gray-700/50",
                                },
                                dataCell(t.type, "text-left font-medium"),
                                dataCell(String(t.count), "text-right"),
                                dataCell(
                                    `${(t.ratio * 100).toFixed(0)}%`,
                                    "text-right"
                                ),
                                dataCell(
                                    timeUtil.format(t.avgSeconds, true),
                                    "text-right"
                                ),
                                dataCell(t.perHour.toFixed(1), "text-right")
                            )
                        )
                    )
                )
            )
        );
    }

    // =========================================================================
    // Credits Tab
    // =========================================================================

    createCreditsTab() {
        const { div, h2, input, p } = van.tags;
        const { button } = rsv.tags;

        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700",
            },
            h2(
                { class: "text-lg font-semibold mb-4 dark:text-white" },
                "Grant credits"
            ),
            p(
                { class: "text-sm text-gray-500 dark:text-gray-400 mb-4" },
                "Search for an organization by name or id, or enter an email to look up a user and their organizations."
            ),
            div(
                { class: "flex gap-2 mb-6" },
                input({
                    type: "text",
                    placeholder: "Organization name, email, or org id",
                    class: "flex-1 px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                    oninput: (e) => (this.searchQuery.val = e.target.value),
                    onkeydown: (e) => {
                        if (e.key === "Enter") this.runSearch();
                    },
                }),
                button(
                    {
                        name: "search",
                        onclick: () => this.runSearch(),
                        disabled: () => this.searching.val,
                    },
                    () => (this.searching.val ? "Searching…" : "Search")
                )
            ),
            () => this.renderSearchResults()
        );
    }

    async runSearch() {
        const q = this.searchQuery.val.trim();
        if (!q) return;
        this.searching.val = true;
        try {
            const res = await apiUtil.call(
                `/api/billing/admin/search?q=${encodeURIComponent(q)}`
            );
            this.searchResults.val = {
                orgs: res.orgs || [],
                users: res.users || [],
            };
        } catch (err) {
            console.error("Search failed:", err);
            this.searchResults.val = { orgs: [], users: [] };
        }
        this.searching.val = false;
    }

    renderSearchResults() {
        const { div, p } = van.tags;
        const { orgs, users } = this.searchResults.val;
        if (!orgs.length && !users.length) {
            return div(
                { class: "text-gray-500 dark:text-gray-400 text-sm" },
                this.searchQuery.val
                    ? "No results."
                    : "Enter a query to search."
            );
        }
        return div(
            { class: "space-y-4" },
            users.length > 0
                ? div(
                      { class: "text-sm text-gray-500 dark:text-gray-400" },
                      `Matched user: ${users[0].email}${
                          users[0].displayName
                              ? ` (${users[0].displayName})`
                              : ""
                      }`
                  )
                : null,
            orgs.length === 0
                ? p(
                      { class: "text-gray-500 dark:text-gray-400 text-sm" },
                      "No organizations matched."
                  )
                : div(
                      { class: "space-y-3" },
                      ...orgs.map((org) => this.renderOrgCard(org))
                  )
        );
    }

    renderOrgCard(org) {
        const { div, span, input, textarea, p } = van.tags;
        const { button } = rsv.tags;

        const state = () =>
            this.grantState.val[org.id] || {
                amount: "",
                note: "",
                busy: false,
                error: null,
                success: null,
            };

        const update = (patch) => {
            this.grantState.val = {
                ...this.grantState.val,
                [org.id]: { ...state(), ...patch },
            };
        };

        return div(
            {
                class: "border border-gray-200 dark:border-gray-700 rounded-lg p-4",
            },
            div(
                {
                    class: "flex justify-between items-start mb-2 flex-wrap gap-2",
                },
                div(
                    div(
                        { class: "font-medium dark:text-white" },
                        org.name || "(unnamed)",
                        org.isPersonal
                            ? span(
                                  {
                                      class: "ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
                                  },
                                  "personal"
                              )
                            : null
                    ),
                    div(
                        {
                            class: "text-xs text-gray-500 dark:text-gray-400 font-mono mt-1",
                        },
                        org.id
                    ),
                    div(
                        {
                            class: "text-xs text-gray-500 dark:text-gray-400 mt-1",
                        },
                        `${org.ownerCount} owner${org.ownerCount !== 1 ? "s" : ""} • ${org.memberCount} member${org.memberCount !== 1 ? "s" : ""}`
                    )
                ),
                div(
                    { class: "text-right" },
                    p(
                        {
                            class: "text-xs text-gray-500 dark:text-gray-400",
                        },
                        "Balance"
                    ),
                    p(
                        {
                            class: "text-lg font-semibold dark:text-white",
                        },
                        () => {
                            const current =
                                this.grantState.val[org.id]?.balanceAfter ??
                                org.credits;
                            return current.toLocaleString();
                        }
                    )
                )
            ),
            div(
                { class: "mt-3 flex flex-wrap gap-2 items-start" },
                input({
                    type: "number",
                    step: "1",
                    placeholder: "Credits",
                    class: "w-32 px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                    value: () => state().amount,
                    oninput: (e) => update({ amount: e.target.value }),
                }),
                textarea({
                    placeholder: "Note (optional)",
                    rows: 1,
                    class: "flex-1 min-w-[200px] px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                    value: () => state().note,
                    oninput: (e) => update({ note: e.target.value }),
                }),
                button(
                    {
                        name: `grant_${org.id}`,
                        onclick: () => this.handleGrant(org, update),
                        disabled: () => state().busy,
                    },
                    () => (state().busy ? "Granting…" : "Grant")
                )
            ),
            () => {
                const s = state();
                if (s.error)
                    return p(
                        {
                            class: "mt-2 text-sm text-red-600 dark:text-red-400",
                        },
                        s.error
                    );
                if (s.success)
                    return p(
                        {
                            class: "mt-2 text-sm text-green-600 dark:text-green-400",
                        },
                        s.success
                    );
                return div();
            }
        );
    }

    // =========================================================================
    // Orgs & Users Tab
    // =========================================================================

    createOrgsTab() {
        const { div, h2 } = van.tags;
        if (!this.orgsData.val && !this.orgsLoading.val && !this.orgsError.val) {
            this.loadOrgs();
        }
        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700",
            },
            div(
                { class: "flex items-center justify-between mb-4" },
                h2(
                    { class: "text-lg font-semibold dark:text-white" },
                    "Organizations & users"
                ),
                () => {
                    const { button } = rsv.tags;
                    return button(
                        {
                            name: "refresh-orgs",
                            onclick: () => this.loadOrgs(true),
                            disabled: () => this.orgsLoading.val,
                        },
                        () =>
                            this.orgsLoading.val ? "Loading…" : "Refresh"
                    );
                }
            ),
            () => this.renderOrgsBody()
        );
    }

    async loadOrgs(force = false) {
        if (this.orgsLoading.val) return;
        if (!force && this.orgsData.val) return;
        this.orgsLoading.val = true;
        this.orgsError.val = null;
        try {
            const res = await apiUtil.call("/api/org/admin/list");
            this.orgsData.val = res;
        } catch (err) {
            console.error("Failed to load admin org list:", err);
            this.orgsError.val = "Failed to load. See console.";
        }
        this.orgsLoading.val = false;
    }

    renderOrgsBody() {
        const { div, p } = van.tags;
        if (this.orgsError.val) {
            return p(
                { class: "text-sm text-red-600 dark:text-red-400" },
                this.orgsError.val
            );
        }
        if (!this.orgsData.val) {
            return p(
                { class: "text-sm text-gray-500 dark:text-gray-400" },
                "Loading…"
            );
        }
        const orgs = this.orgsData.val.orgs || [];
        return div(
            this.renderOrgsSummary(orgs),
            this.renderOrgsTable(orgs)
        );
    }

    renderOrgsSummary(orgs) {
        const { div } = van.tags;
        const totals = orgs.reduce(
            (acc, o) => {
                (o.members || []).forEach((m) => acc.users.add(m.uid));
                acc.videos += o.videos?.total || 0;
                acc.events += o.events?.total || 0;
                acc.credits += o.credits || 0;
                return acc;
            },
            { users: new Set(), videos: 0, events: 0, credits: 0 }
        );

        const card = (label, value) =>
            div(
                {
                    class: "bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700",
                },
                div(
                    {
                        class: "text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400",
                    },
                    label
                ),
                div(
                    {
                        class: "text-lg font-semibold dark:text-gray-400 mt-1",
                    },
                    value
                )
            );

        return div(
            { class: "grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" },
            card("Orgs", String(orgs.length)),
            card("Users", String(totals.users.size)),
            card("Videos", String(totals.videos)),
            card("Events", String(totals.events)),
            card("Credits", totals.credits.toLocaleString())
        );
    }

    formatStatusBreakdown(byStatus) {
        const entries = Object.entries(byStatus || {});
        if (entries.length === 0) return "—";
        entries.sort((a, b) => b[1] - a[1]);
        return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
    }

    renderOrgsTable(orgs) {
        const { div, table, thead, tbody, tr, th, td, span } = van.tags;

        const headerCell = (text, extra = "") =>
            th(
                {
                    class: `px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 ${extra}`,
                },
                text
            );

        const dataCell = (content, extra = "") =>
            td(
                { class: `px-3 py-2 text-sm dark:text-gray-200 ${extra}` },
                content
            );

        const rows = orgs.flatMap((org) => {
            const expanded = !!this.orgsExpanded.val[org.id];
            const nameCell = div(
                div(
                    { class: "font-medium dark:text-white" },
                    org.name || "(unnamed)",
                    org.isPersonal
                        ? span(
                              {
                                  class: "ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
                              },
                              "personal"
                          )
                        : null
                ),
                div(
                    {
                        class: "text-xs text-gray-500 dark:text-gray-400 font-mono mt-1",
                    },
                    org.id
                ),
                org.token
                    ? div(
                          {
                              class: "text-xs text-gray-500 dark:text-gray-400 mt-0.5",
                          },
                          org.token
                      )
                    : null
            );

            const memberSummary = div(
                {
                    class: "cursor-pointer text-blue-600 dark:text-blue-400 hover:underline",
                    onclick: () => {
                        this.orgsExpanded.val = {
                            ...this.orgsExpanded.val,
                            [org.id]: !expanded,
                        };
                    },
                },
                `${org.memberCount} ${
                    org.memberCount === 1 ? "member" : "members"
                } (${org.ownerCount} owner${org.ownerCount === 1 ? "" : "s"})`
            );

            const mainRow = tr(
                {
                    class: "border-b border-gray-100 dark:border-gray-700/50 align-top",
                },
                dataCell(nameCell, "text-left"),
                dataCell(memberSummary, "text-left"),
                dataCell((org.credits || 0).toLocaleString(), "text-right"),
                dataCell(
                    div(
                        div(String(org.videos?.total || 0)),
                        div(
                            {
                                class: "text-xs text-gray-500 dark:text-gray-400",
                            },
                            this.formatStatusBreakdown(org.videos?.byStatus)
                        )
                    ),
                    "text-right"
                ),
                dataCell(
                    div(
                        div(String(org.events?.total || 0)),
                        div(
                            {
                                class: "text-xs text-gray-500 dark:text-gray-400",
                            },
                            this.formatStatusBreakdown(org.events?.byStatus)
                        )
                    ),
                    "text-right"
                )
            );

            if (!expanded) return [mainRow];

            const members = org.members || [];
            const memberList = members.length
                ? div(
                      { class: "space-y-1" },
                      ...members.map((m) =>
                          div(
                              { class: "text-xs dark:text-gray-300" },
                              m.isOwner
                                  ? span(
                                        {
                                            class: "mr-2 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200",
                                        },
                                        "owner"
                                    )
                                  : null,
                              m.email || m.displayName || m.uid,
                              m.displayName && m.email
                                  ? span(
                                        {
                                            class: "ml-2 text-gray-500 dark:text-gray-400",
                                        },
                                        `(${m.displayName})`
                                    )
                                  : null
                          )
                      )
                  )
                : div(
                      { class: "text-xs text-gray-500 dark:text-gray-400" },
                      "No members."
                  );

            const detailRow = tr(
                { class: "border-b border-gray-100 dark:border-gray-700/50" },
                td(
                    {
                        colspan: 5,
                        class: "px-3 py-3 bg-gray-50 dark:bg-gray-900/30",
                    },
                    memberList,
                    org.error
                        ? div(
                              {
                                  class: "mt-2 text-xs text-red-600 dark:text-red-400",
                              },
                              `Error: ${org.error}`
                          )
                        : null
                )
            );

            return [mainRow, detailRow];
        });

        return div(
            { class: "overflow-x-auto" },
            table(
                { class: "min-w-full" },
                thead(
                    {
                        class: "border-b border-gray-200 dark:border-gray-700",
                    },
                    tr(
                        headerCell("Org", "text-left"),
                        headerCell("Members", "text-left"),
                        headerCell("Credits", "text-right"),
                        headerCell("Videos", "text-right"),
                        headerCell("Events", "text-right")
                    )
                ),
                tbody(...rows)
            )
        );
    }

    async handleGrant(org, update) {
        const s = this.grantState.val[org.id] || {};
        const amount = parseInt(s.amount, 10);
        if (!Number.isFinite(amount) || amount === 0) {
            update({
                error: "Enter a non-zero integer amount.",
                success: null,
            });
            return;
        }
        update({ busy: true, error: null, success: null });
        try {
            const res = await apiUtil.call(
                "/api/billing/admin/grant",
                { oid: org.id, credits: amount, note: s.note || "" },
                "POST"
            );
            update({
                busy: false,
                amount: "",
                note: "",
                success: `Granted ${amount.toLocaleString()} credits. New balance: ${res.balanceAfter.toLocaleString()}.`,
                balanceAfter: res.balanceAfter,
            });
        } catch (err) {
            console.error("Grant failed:", err);
            update({ busy: false, error: "Grant failed. See console." });
        }
    }
}

const admin = new Admin();

if (typeof window !== "undefined") {
    window._vy_admin = admin;
}

export { Admin, admin };
//# sourceMappingURL=rsadmin.js.map
