let app;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) ; else {
    const { initializeApp } = await import('./index.esm-B6bJ3A7A.js');
    const { config } = await import('./firebase-config-DABbTo-C.js');
    app = initializeApp(config);
}

export { app as a };
//# sourceMappingURL=firebase-CerrWIuy.js.map
