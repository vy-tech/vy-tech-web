import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.5.min.js";
import { events } from "/js/rsevents.js";
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

export { van, rsv };
