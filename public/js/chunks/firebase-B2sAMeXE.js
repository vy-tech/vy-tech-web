let app;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
    // Is there a way to tell rollup.js to ingore these?

    console.log("Using Firebase Admin SDK...");
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { credential } = await import('../../firebase-svc-cred.json', { assert: { type: 'json' } });
    app = initializeApp({ credential: cert(credential) });
} else {
    console.log("Initializing Firebase Client App...");
    const { initializeApp } = await import('./index.esm-B6bJ3A7A.js');
    const { config } = await import('./firebase-config-DABbTo-C.js');
    app = initializeApp(config);
}

export { app as a };
//# sourceMappingURL=firebase-B2sAMeXE.js.map
