let app;

async function getApp() {
    if (app) return app;

    if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
        console.log("Using Firebase Admin SDK...");
        app = global._vy_firebase_app;
    } else {
        console.log("Initializing Firebase Client App...");
        const { initializeApp } = await import('./index.esm-0XAacddd.js');
        const { config } = await import('./firebase-config-DABbTo-C.js');
        app = initializeApp(config);
    }

    return app;
}

export { getApp as g };
//# sourceMappingURL=firebase-omMfH1CX.js.map
