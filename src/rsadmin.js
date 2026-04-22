import { van, rsv } from "./rsvan.js";
import { eventBus } from "./eventbus.js";
import { database } from "./data/db.js";
import { apiUtil } from "./util/apiUtil.js";

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
        this.searchQuery = van.state("");
        this.searchResults = van.state({ orgs: [], users: [] });
        this.searching = van.state(false);
        this.grantState = van.state({}); // { [oid]: { amount, note, busy, error, success } }
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
            tabButton("credits", "Credits")
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
        if (!this.jobsChart) return;
        let jobs = await this.getJobsByStatus();
        let data = this.statusLabels.map((label) => jobs[label].count);

        this.jobsChart.data.datasets[0].data = data;
        this.jobsChart.update();
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
export { Admin, admin };

if (typeof window !== "undefined") {
    window._vy_admin = admin;
}
