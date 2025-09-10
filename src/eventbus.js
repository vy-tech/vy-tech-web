class EventBus extends EventTarget {
    fire(name, detail = {}) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }
}

const eventBus = new EventBus();
export { EventBus, eventBus };
