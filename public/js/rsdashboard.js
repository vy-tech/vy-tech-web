import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.5.min.js";

class Dashboard {
  constructor() {}

  init() {
    this.addElements();
  }

  addElements(parentElement) {
    const { a, div, main, h1 } = van.tags;
    parentElement =
      parentElement || document.getElementById("container") || document.body;

    van.add(
      parentElement,
      main(
        { class: "w-[90%] p-4 overflow-auto" },
        div({ class: "flex justify-center items-center" }, h1("Hello"))
      )
    );
  }
}

const dashboard = new Dashboard();
export { Dashboard, dashboard };
