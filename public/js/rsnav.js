import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.5.min.js";

class Nav {
  targets = [
    { name: "dashboard", path: "/dashboard", icon: "home" },
    { name: "locations", path: "/locations", icon: "map-marker" },
    { name: "schedule", path: "/schedule", icon: "calendar" },
    { name: "reports", path: "/reports", icon: "chart-bar" },
    { name: "settings", path: "/settings", icon: "cog" },
    { name: "profile", path: "/profile", icon: "user-circle" },
  ];

  constructor() {}

  addElements(parentElement) {
    const { a, div, i, img, nav } = van.tags;
    parentElement =
      parentElement || document.getElementById("container") || document.body;

    const targetElements = this.targets.map((target) => {
      const color =
        target.path === window.location.pathname
          ? "text-[#3fa7d7]"
          : "text-gray-300";
      return a(
        { href: target.path, class: `${color} my-4 hover:text-[#d94d50]` },
        i({ class: `las la-${target.icon} text-4xl` })
      );
    });

    van.add(
      parentElement,
      nav(
        {
          class:
            "w-[10%] max-w-[100px] bg-gray-200 dark:bg-gray-800 p-4 flex flex-col items-center",
        },
        img({
          src: "/img/RoarScoreLogoSquare.png",
          alt: "RoarScore Logo",
          class: "w-3/4 min-w-[35px] h-auto my-8",
        }),

        targetElements
      )
    );
  }
}

const nav = new Nav();
nav.addElements();
export { Nav, nav };
