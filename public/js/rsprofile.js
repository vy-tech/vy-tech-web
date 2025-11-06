import { r as rsv } from './chunks/rsvan-C-KzMu00.js';
import { e as eventBus } from './chunks/eventbus-B9JUr222.js';
import { a as auth } from './chunks/rsauth-BJYcHkGV.js';
import { v as van } from './chunks/van-t8DywzvC.js';
import './chunks/firebase-jA0aqIBe.js';
import './chunks/index.esm2017-D8q59gHf.js';

class Profile {
    constructor() {
        eventBus.addEventListener("signOutClick", () => this.handleSignout());
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
