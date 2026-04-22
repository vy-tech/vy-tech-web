import { van } from "./rsvan.js";
import { Marked } from "marked";
import { eventBus } from "./eventbus.js";

const marked = new Marked();

const TABS = [
    {
        id: "getting-started",
        label: "Getting Started",
        url: "/doc/vy-getting-started.md",
    },
    {
        id: "api-quickstart",
        label: "API Quickstart",
        url: "/doc/vy-api-quickstart.md",
    },
    { id: "videos", label: "Videos", url: "/doc/vy-videos.md" },
    {
        id: "events-locations",
        label: "Events & Locations",
        url: "/doc/vy-events-locations.md",
    },
    {
        id: "annotations",
        label: "Annotations",
        url: "/doc/vy-annotations.md",
    },
];

class Docs {
    constructor() {
        this.activeTab = van.state(TABS[0].id);
        this.content = van.state(""); // rendered HTML
        this.loading = van.state(false);
        this.error = van.state(null);
    }

    init() {
        eventBus.on("auth.unauthenticated", () => {
            window.location.href =
                "/users/login?return_url=" +
                encodeURIComponent(window.location.href);
        });

        const hash = window.location.hash.replace("#", "");
        const initialTab = TABS.find((t) => t.id === hash) || TABS[0];
        this.activeTab = van.state(initialTab.id);

        this.addElements();
        this.loadTab(initialTab);
    }

    async loadTab(tab) {
        this.loading.val = true;
        this.error.val = null;

        try {
            const resp = await fetch(tab.url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const md = await resp.text();
            this.content.val = marked.parse(md);
        } catch (err) {
            console.error("Failed to load doc:", err);
            this.error.val = "Failed to load documentation.";
            this.content.val = "";
        } finally {
            this.loading.val = false;
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
                    { class: "max-w-4xl mx-auto" },
                    h1(
                        { class: "text-2xl font-bold mb-6 dark:text-white" },
                        "Documentation"
                    ),
                    this.createTabNav(),
                    div({ class: "mt-4" }, () => this.createTabContent())
                )
            )
        );
    }

    createTabNav() {
        const { div, button } = van.tags;

        const tabButton = (tab) =>
            button(
                {
                    class: () =>
                        `px-4 py-2 font-medium rounded-t-lg border-b-2 transition-colors ${
                            this.activeTab.val === tab.id
                                ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800"
                                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`,
                    onclick: () => {
                        if (this.activeTab.val === tab.id) return;
                        this.activeTab.val = tab.id;
                        this.loadTab(tab);
                    },
                },
                tab.label
            );

        return div(
            {
                class: "flex space-x-2 border-b border-gray-200 dark:border-gray-700",
            },
            ...TABS.map(tabButton)
        );
    }

    createTabContent() {
        const { div, a, i } = van.tags;

        if (this.loading.val) {
            return div(
                {
                    class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center gap-3 text-gray-500 dark:text-gray-400",
                },
                i({ class: "las la-spinner la-spin" }),
                "Loading..."
            );
        }

        if (this.error.val) {
            return div(
                {
                    class: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-red-500",
                },
                this.error.val
            );
        }

        const tab = TABS.find((t) => t.id === this.activeTab.val);

        return div(
            { class: "bg-white dark:bg-gray-800 rounded-lg shadow" },
            // Raw markdown link for agents
            div(
                { class: "flex justify-end px-6 pt-4" },
                a(
                    {
                        href: tab?.url,
                        target: "_blank",
                        class: "text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors",
                        title: "View raw markdown — paste this URL into your AI agent",
                    },
                    i({ class: "las la-file-alt" }),
                    "raw markdown"
                )
            ),
            // Rendered markdown
            div({
                class: "prose dark:prose-invert max-w-none p-6 pt-2",
                innerHTML: this.content.val,
            })
        );
    }
}

const docs = new Docs();
export { Docs, docs };

if (typeof window !== "undefined") {
    window._vy_docs = docs;
}
