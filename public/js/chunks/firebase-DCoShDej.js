let app;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
    console.log("Using Firebase Admin SDK...");
    try {
        const { initializeApp, cert } = await import('firebase-admin/app');
        const { credential } = await import('../../firebase-svc-cred.json', { assert: { type: 'json' } });
        app = initializeApp({ credential: cert(credential) });
    } catch (error) {
        console.warn("Firebase Admin SDK not available in browser environment");
        // Fallback to client SDK
        const { initializeApp } = await import('./index.esm-B6bJ3A7A.js');
        const { config } = await import('./firebase-config-DABbTo-C.js');
        app = initializeApp(config);
    }
} else {
    console.log("Initializing Firebase Client App...");
    const { initializeApp } = await import('./index.esm-B6bJ3A7A.js');
    const { config } = await import('./firebase-config-DABbTo-C.js');
    app = initializeApp(config);
}

export { app as a };
//# sourceMappingURL=firebase-DCoShDej.js.map
