import { van, rsv } from "/js/rsvan.js";
import { auth } from "/js/rsauth.js";
import { events } from "/js/rsevents.js";

class Profile {
  constructor() {
    events.addEventListener("signOutClick", () => this.handleSignout());
  }

  init() {
    this.addElements();
  }

  addElements(parentElement) {
    const { a, div, main, h1 } = van.tags;
    const { button } = rsv.tags;
    parentElement =
      parentElement || document.getElementById("container") || document.body;

    van.add(
      parentElement,
      main(
        { class: "w-[90%] p-4 overflow-auto" },
        div(
          { class: "" },
          h1("Profile"),

          div(button({ name: "signOut" }, "Sign Out"))
        )
      )
    );
  }

  handleSignout() {
    auth.signOut();
  }
}

const profile = new Profile();
export { Profile, profile };
