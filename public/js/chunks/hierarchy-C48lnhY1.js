import { v as van } from './van-t8DywzvC.js';

// Quote all tag names so that they're not mangled by minifier
const { "button": button, "div": div, "header": header, "input": input, "label": label, "span": span, "style": style } = van.tags;
const toStyleStr = (style) => Object.entries(style).map(([k, v]) => `${k}: ${v};`).join("");
const Modal = ({ closed, backgroundColor = "rgba(0,0,0,.5)", blurBackground = false, clickBackgroundToClose = false, backgroundClass = "", backgroundStyleOverrides = {}, modalClass = "", modalStyleOverrides = {}, }, ...children) => {
    const backgroundStyle = {
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        position: "fixed",
        "z-index": 10000,
        "background-color": backgroundColor,
        "backdrop-filter": blurBackground ? "blur(0.25rem)" : "none",
        ...backgroundStyleOverrides,
    };
    const modalStyle = {
        "border-radius": "0.5rem",
        padding: "1rem",
        display: "block",
        "background-color": "white",
        ...modalStyleOverrides,
    };
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
    return () => {
        if (closed.val)
            return null;
        const bgDom = div({ class: backgroundClass, style: toStyleStr(backgroundStyle) }, div({ class: modalClass, style: toStyleStr(modalStyle) }, children));
        clickBackgroundToClose &&
            bgDom.addEventListener("click", e => e.target === bgDom && (closed.val = true));
        return bgDom;
    };
};

class Progress {
    constructor() {}

    show(message = "Loading...") {
        const { h3, div, progress } = van.tags;
        let pct = van.state(0);
        let closed = van.state(false);
        van.add(
            document.body,
            Modal(
                {
                    closed,
                    backgroundStyleOverrides: {
                        "align-items": "flex-start", // Align to top instead of center
                        "padding-top": "20vh", // Add some padding from the top
                    },
                },
                div(
                    { class: "p-4 w-80" },
                    h3({ class: "text-black" }, message),
                    progress({
                        id: "loading-progress",
                        class: "w-full h-4 mt-2",
                        value: pct,
                        max: 100,
                    })
                )
            )
        );
        return { closed, pct };
    }
}

const progress = new Progress();

class Hierarchy {
    constructor(fromString = null) {
        if (fromString instanceof Hierarchy) {
            this.parts = [...fromString.parts];
        } else if (fromString) {
            this.parts = fromString.split(/[\-\:]/);
            this.parts[1] = parseInt(this.parts[1]);
            this.parts[2] = parseInt(this.parts[2] || 1);
        } else {
            this.parts = [];
        }
    }

    get location() {
        return this.parts[0] || null;
    }
    set location(value) {
        this.parts[0] = value;
    }

    get date() {
        return this.parts[1] || null;
    }
    set date(value) {
        this.parts[1] = parseInt(value);
    }

    get camera() {
        return this.parts[2] || null;
    }
    set camera(value) {
        this.parts[2] = parseInt(value);
    }

    toString(separator = ":", defaultCamera = 1) {
        let cam = (this.camera || defaultCamera).toString().padStart(2, "0");
        return [this.location, this.date, cam].join(separator);
    }

    toEventString(separator = ":") {
        return [this.location, this.date].join(separator);
    }
}

export { Hierarchy as H, Modal as M, progress as p };
//# sourceMappingURL=hierarchy-C48lnhY1.js.map
