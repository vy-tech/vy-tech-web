import { JSDOM } from "jsdom";
import Hls from "hls.js";

// Create a JSDOM instance
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://dev.roarscore.ai", // Specify the port where your server runs
    pretendToBeVisual: true,
    resources: "usable",
});

// Set up global variables to mimic browser environment
global.window = dom.window;
global.document = dom.window.document;
global.self = global.window; // hls.js expects 'self' to be available

// Handle navigator carefully since it might be read-only in Node.js
try {
    global.navigator = dom.window.navigator;
} catch (error) {
    // If navigator is read-only, define it with Object.defineProperty
    Object.defineProperty(global, "navigator", {
        value: dom.window.navigator,
        writable: true,
        configurable: true,
    });
}

global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.DocumentFragment = dom.window.DocumentFragment;

// Make hls.js available globally
global.Hls = Hls;

// Set up common browser APIs
global.requestAnimationFrame = (callback) => {
    return setTimeout(callback, 16); // ~60fps
};

global.cancelAnimationFrame = (id) => {
    clearTimeout(id);
};

// Mock localStorage if needed
global.localStorage = {
    getItem: (key) => null,
    setItem: (key, value) => {},
    removeItem: (key) => {},
    clear: () => {},
    length: 0,
    key: (index) => null,
};

// Mock sessionStorage if needed
global.sessionStorage = {
    getItem: (key) => null,
    setItem: (key, value) => {},
    removeItem: (key) => {},
    clear: () => {},
    length: 0,
    key: (index) => null,
};

// Mock console methods if they don't exist
if (!global.console) {
    global.console = {
        log: () => {},
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
    };
}

console.log("JSDOM shim initialized");
