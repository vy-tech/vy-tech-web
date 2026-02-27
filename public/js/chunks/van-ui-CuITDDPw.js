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

export { Modal as M };
//# sourceMappingURL=van-ui-CuITDDPw.js.map
