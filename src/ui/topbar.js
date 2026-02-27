import van from "vanjs-core";
import { orgContext } from "../data/orgContext.js";

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
export { TopBar, topBar };
