class EventBus extends EventTarget {
    fire(name, detail = {}) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }

    on(name, callback) {
        this.addEventListener(name, callback);
    }
}

const eventBus = new EventBus();
window.eventBus = eventBus;
export { EventBus, eventBus };
