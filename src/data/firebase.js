let app;

async function getApp() {
    if (app) return app;

    if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
        console.log("Using Firebase Admin SDK...");
        app = global._vy_firebase_app;
    } else {
        console.log("Initializing Firebase Client App...");
        const { initializeApp } = await import("firebase/app");
        const { config } = await import("../firebase-config.js");
        app = initializeApp(config);
    }

    return app;
}

export { getApp };
