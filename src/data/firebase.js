let app;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
    console.log("Using Firebase Admin SDK...");
    app = global._vy_firebase_app;
} else {
    console.log("Initializing Firebase Client App...");
    const { initializeApp } = await import("firebase/app");
    const { config } = await import("../firebase-config.js");
    app = initializeApp(config);
}

export { app };
