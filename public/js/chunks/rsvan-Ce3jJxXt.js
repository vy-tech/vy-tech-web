import { e as eventBus, v as van } from './eventbus-c5hoJhOF.js';

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
                    eventBus.fire(`${attrs.name}Click`);
                });

            return van.tags.button(attrs, ...children);
        },
    },
};

export { rsv as r };
//# sourceMappingURL=rsvan-Ce3jJxXt.js.map
