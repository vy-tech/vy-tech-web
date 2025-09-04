import { v as van } from './van-t8DywzvC.js';

const rsv = {
    tags: {
        button: function (attrs = {}, ...children) {
            attrs.name = attrs.name || "button"; // Default to "button" if not specified
            attrs.class =
                (attrs.class || "") +
                " bg-[#4053b4] hover:bg-[#3fa7d7] text-white font-bold py-2 px-4 rounded";
            attrs.type = attrs.type || "button"; // Default to button type if not specified
            attrs.onclick =
                attrs.onclick ||
                (() => {
                    console.log(`Firing ${attrs.name}Click event`);
                    events.dispatchEvent(new Event(`${attrs.name}Click`));
                });

            return van.tags.button(attrs, ...children);
        },
    },
};

class Events extends EventTarget {}

const events$1 = new Events();

export { events$1 as e, rsv as r };
//# sourceMappingURL=rsevents-BE9Wom91.js.map
