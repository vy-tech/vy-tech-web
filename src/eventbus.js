class EventBus extends EventTarget {
    fire(name, detail = {}) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }
}

const eventBus = new EventBus();
window.eventBus = eventBus;
export { EventBus, eventBus };
