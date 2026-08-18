class EventBus extends EventTarget {
    fire(name, detail = {}) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }

    on(name, callback) {
        this.addEventListener(name, callback);
    }

    once(name, callback) {
        this.addEventListener(name, callback, { once: true });
    }
}

const eventBus = new EventBus();
if (typeof window !== "undefined") {
    window._vy_eventBus = eventBus;
}

export { EventBus, eventBus };
//# sourceMappingURL=eventbus-CgpxZhAr.js.map
