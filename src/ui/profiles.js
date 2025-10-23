import van from "vanjs-core";
import { eventBus } from "../eventbus.js";
import { ProfilesData } from "../data/profiles.js";

class Profiles extends ProfilesData {
    constructor() {
        super();
    }

    async setSelectorToAll() {
        const profiles = await this.getAll();
        this.profileListState.val = profiles;
    }

    createOptionElement(profileData, selected) {
        const { option } = van.tags;

        const displayName = profileData.name || "Unnamed Profile";
        const displayDescription = profileData.description
            ? ` - ${profileData.description}`
            : "";
        const displayText = `${displayName}${displayDescription}`;

        return option(
            {
                value: profileData.id,
                selected: profileData.id == selected,
            },
            displayText
        );
    }

    createSelectorElement(selected) {
        const { div, select } = van.tags;
        this.profileListState = van.state([]);
        this.setSelectorToAll();

        const container = div({ class: "vyprofiles-selector" }, () => {
            const sel = select({
                id: "profile-select",
                class: "w-full text-black p-1",
            });

            this.profileListState.val.forEach((profileData) =>
                van.add(sel, this.createOptionElement(profileData, selected))
            );

            sel.addEventListener("change", (e) => {
                eventBus.dispatchEvent(
                    new CustomEvent("ui.requestProfile", {
                        detail: e.target.value,
                    })
                );
            });

            return sel;
        });

        return container;
    }
}

const profiles = new Profiles();
export default profiles;
export { profiles, Profiles };
