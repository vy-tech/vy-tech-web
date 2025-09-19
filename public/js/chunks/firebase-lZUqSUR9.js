var firebaseSvcCred = /*#__PURE__*/Object.freeze({
  __proto__: null
});

let app;

if (typeof global !== "undefined" && global._vy_firebase_admin_sdk) {
    console.log("Using Firebase Admin SDK...");
    const { initializeApp, cert } = await import('./index-CGBn3BLz.js');
    const { credential } = await Promise.resolve().then(function () { return firebaseSvcCred; });
    app = initializeApp({ credential: cert(credential) });
} else {
    console.log("Initializing Firebase Client App...");
    const { initializeApp } = await import('./index.esm-BC8bTdUW.js');
    const { config } = await import('./firebase-config-DABbTo-C.js');
    app = initializeApp(config);
}

export { app as a };
//# sourceMappingURL=firebase-lZUqSUR9.js.map
