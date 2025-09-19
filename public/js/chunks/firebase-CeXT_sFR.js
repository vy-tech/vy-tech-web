let app;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) ; else {
    console.log("Initializing Firebase App...");
    const { initializeApp } = await import('./index.esm-B6bJ3A7A.js');
    const { config } = await import('./firebase-config-DABbTo-C.js');
    app = initializeApp(config);
}

export { app as a };
//# sourceMappingURL=firebase-CeXT_sFR.js.map
