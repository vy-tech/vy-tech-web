import { e as events, r as rsv } from './chunks/rsevents-BE9Wom91.js';
import { auth } from './rsauth.js';
import { v as van } from './chunks/van-t8DywzvC.js';
import './chunks/rsfirebase-B6bae4XU.js';

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
            parentElement ||
            document.getElementById("container") ||
            document.body;

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
//# sourceMappingURL=rsprofile.js.map
