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
let tabsId = 0;
const Tabs = ({ activeTab, activeTabDisplay = "block", resultClass = "", style = "", tabButtonRowColor = "#f1f1f1", tabButtonBorderStyle = "1px solid #000", tabButtonHoverColor = "#ddd", tabButtonActiveColor = "#ccc", transitionSec = 0.3, tabButtonRowClass = "", tabButtonRowStyleOverrides = {}, tabButtonClass = "", tabButtonStyleOverrides = {}, tabContentClass = "", tabContentStyleOverrides = {}, }, contents) => {
    const activeTabState = activeTab ?? van.state(Object.keys(contents)[0]);
    const tabButtonRowStylesStr = toStyleStr({
        overflow: "hidden",
        "background-color": tabButtonRowColor,
        ...tabButtonRowStyleOverrides,
    });
    const tabButtonStylesStr = toStyleStr({
        float: "left",
        border: "none",
        "border-right": tabButtonBorderStyle,
        outline: "none",
        cursor: "pointer",
        padding: "8px 16px",
        transition: `background-color ${transitionSec}s`,
        ...tabButtonStyleOverrides,
    });
    const tabContentStylesStr = toStyleStr({
        padding: "6px 12px",
        "border-top": "none",
        ...tabContentStyleOverrides,
    });
    const id = "vanui-tabs-" + (++tabsId);
    document.head.appendChild(van.tags["style"](`#${id} .vanui-tab-button { background-color: inherit }
#${id} .vanui-tab-button:hover { background-color: ${tabButtonHoverColor} }
#${id} .vanui-tab-button.active { background-color: ${tabButtonActiveColor} }`));
    return div({ id, class: resultClass, style }, div({ class: tabButtonRowClass, style: tabButtonRowStylesStr }, Object.keys(contents).map(k => button({
        class: () => ["vanui-tab-button"].concat(tabButtonClass ? tabButtonClass : [], k === activeTabState.val ? "active" : []).join(" "),
        style: tabButtonStylesStr,
        onclick: () => activeTabState.val = k,
    }, k))), Object.entries(contents).map(([k, v]) => div({
        class: tabContentClass,
        style: () => `display: ${k === activeTabState.val ? activeTabDisplay : "none"}; ${tabContentStylesStr};`,
    }, v)));
};

export { Modal as M, Tabs as T };
//# sourceMappingURL=van-ui-YSP0ZuSh.js.map
