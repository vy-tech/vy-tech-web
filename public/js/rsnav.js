import { v as van } from './chunks/van-t8DywzvC.js';
import { o as orgContext } from './chunks/orgContext-C_Ixz4_0.js';
import './chunks/eventbus-BMI3jhi1.js';
import './chunks/db-s3IORrbE.js';
import './chunks/index.esm2017-Y6lvFaM5.js';

class TopBar {
    constructor() {
        this.isDropdownOpen = van.state(false);
    }

    addElements(parentElement) {
        const { div, button, span, i, ul, li } = van.tags;

        const topBar = div(
            {
                class: "absolute top-2 right-4 z-40",
            },
            div(
                {
                    class: "relative bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700",
                },
                button(
                    {
                        class: "flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors",
                        onclick: () => {
                            this.isDropdownOpen.val = !this.isDropdownOpen.val;
                        },
                    },
                    i({
                        class: "las la-building text-lg text-gray-600 dark:text-gray-400",
                    }),
                    span(
                        {
                            class: "text-sm font-medium dark:text-white max-w-[150px] truncate",
                        },
                        () => {
                            const org = orgContext.currentOrg.val;
                            if (orgContext.isLoading.val) return "Loading...";
                            return org?.name || "Select Organization";
                        }
                    ),
                    i({
                        class: () =>
                            `las la-angle-down text-xs text-gray-500 transition-transform ${
                                this.isDropdownOpen.val ? "rotate-180" : ""
                            }`,
                    })
                ),
                () => this.renderDropdown()
            )
        );

        document.addEventListener("click", (e) => {
            if (this.isDropdownOpen.val && !e.target.closest(".relative")) {
                this.isDropdownOpen.val = false;
            }
        });

        van.add(parentElement, topBar);
    }

    renderDropdown() {
        //if (!this.isDropdownOpen.val) return null;

        const { div, button, span, i, ul, li } = van.tags;

        return div(
            {
                class: `absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 ${
                    this.isDropdownOpen.val ? "" : "hidden"
                }`,
            },
            div(
                {
                    class: "px-3 py-2 border-b border-gray-200 dark:border-gray-700",
                },
                span(
                    {
                        class: "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase",
                    },
                    "Switch Organization"
                )
            ),
            () =>
                ul(
                    { class: "max-h-64 overflow-y-auto" },
                    ...orgContext.userOrgs.val.map((org) =>
                        li(
                            button(
                                {
                                    class: `w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                        org.id === orgContext.currentOrgId.val
                                            ? "bg-blue-50 dark:bg-blue-900/30"
                                            : ""
                                    }`,
                                    onclick: async () => {
                                        await orgContext.setCurrentOrg(org.id);
                                        this.isDropdownOpen.val = false;
                                    },
                                },
                                i({
                                    class: `las ${
                                        org.isPersonal ? "la-user" : "la-users"
                                    } text-lg text-gray-500 dark:text-gray-400`,
                                }),
                                div(
                                    { class: "flex-1 min-w-0" },
                                    div(
                                        {
                                            class: "text-sm font-medium dark:text-white truncate",
                                        },
                                        org.name
                                    ),
                                    org.isPersonal
                                        ? span(
                                              {
                                                  class: "text-xs text-gray-500 dark:text-gray-400",
                                              },
                                              "Your personal workspace"
                                          )
                                        : null
                                ),
                                org.id === orgContext.currentOrgId.val
                                    ? i({ class: "las la-check text-blue-500" })
                                    : null
                            )
                        )
                    )
                ),
            div(
                {
                    class: "px-3 py-2 border-t border-gray-200 dark:border-gray-700",
                },
                button(
                    {
                        class: "text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1",
                        onclick: () => {
                            window.location.href = "/profile#orgs";
                            this.isDropdownOpen.val = false;
                        },
                    },
                    i({ class: "las la-cog" }),
                    "Manage Organizations"
                )
            )
        );
    }
}

const topBar = new TopBar();

class Nav {
    targets = [
        { name: "home", path: "/home", icon: "home", description: "Home" },
        {
            name: "reports",
            path: "/reports",
            icon: "chart-bar",
            description: "Reports",
        },
        { name: "chat", path: "/chat", icon: "comments", description: "Chat" },
        {
            name: "library",
            path: "/library",
            icon: "folder-open",
            description: "Library",
        },
        {
            name: "schedule",
            path: "/schedule",
            icon: "calendar",
            description: "Schedule",
        },
        {
            name: "documentation",
            path: "/documentation",
            icon: "book",
            description: "Documentation",
        },
        {
            name: "billing",
            path: "/billing",
            icon: "credit-card",
            description: "Billing",
        },
        {
            name: "settings",
            path: "/settings",
            icon: "cog",
            description: "Settings",
        },
        {
            name: "profile",
            path: "/profile",
            icon: "user-circle",
            description: "Profile",
        },
    ];

    constructor() {}

    addElements(parentElement) {
        const { a, button, div, i, img, nav, span } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("container") ||
            document.body;

        const isExpanded = van.state(false);

        const targetElements = this.targets.map((target) => {
            const color =
                target.path === window.location.pathname
                    ? "text-[#3fa7d7]"
                    : "text-gray-300";
            return a(
                {
                    href: target.path,
                    class: `${color} my-4 hover:text-[#d94d50] flex items-center gap-3 w-full`,
                },
                i({ class: `las la-${target.icon} text-4xl flex-shrink-0` }),
                span(
                    {
                        class: () =>
                            `whitespace-nowrap overflow-hidden transition-all duration-300 ${
                                isExpanded.val
                                    ? "opacity-100 max-w-[200px]"
                                    : "opacity-0 max-w-0"
                            }`,
                    },
                    target.description
                )
            );
        });

        const navSidebar = nav(
            {
                class: () =>
                    `bg-gray-200 dark:bg-gray-800 p-4 flex flex-col items-center transition-all duration-300 flex-shrink-0 ${
                        isExpanded.val ? "w-[200px]" : "w-[70px]"
                    }`,
            },
            img({
                src: "/img/vy-logo.png",
                alt: "Vy Logo",
                class: "w-3/4 min-w-[35px] h-auto my-8",
            }),
            targetElements,
            button(
                {
                    class: "mt-auto text-gray-300 hover:text-[#d94d50] text-3xl",
                    onclick: () => (isExpanded.val = !isExpanded.val),
                },
                i({ class: "las la-columns" })
            )
        );

        const rightContainer = div(
            { class: "flex flex-col flex-1 min-w-0" },
            div({ id: "topbar-container" }),
            div({ id: "main-content", class: "flex-1 overflow-auto" })
        );

        van.add(parentElement, navSidebar, rightContainer);

        topBar.addElements(document.getElementById("topbar-container"));
    }
}

const nav = new Nav();
nav.addElements();

export { Nav, nav };
//# sourceMappingURL=rsnav.js.map
