import van from "vanjs-core";
import { topBar } from "./ui/topbar.js";

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
