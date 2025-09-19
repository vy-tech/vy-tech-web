let app;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
    console.log("Using Firebase Admin SDK...");
    app = global._vy_firebase_app;
} else {
    console.log("Initializing Firebase Client App...");
    const { initializeApp } = await import('./index.esm-0XAacddd.js');
    const { config } = await import('./firebase-config-DABbTo-C.js');
    app = initializeApp(config);
}

export { app as a };
//# sourceMappingURL=firebase-DTGT__LK.js.map
