const firebaseConfig = {
  apiKey: "AIzaSyDNLSneWSThYPb-jyjgM174iH_1g3a-kFU",
  authDomain: "roarscore-1ddf5.firebaseapp.com",
  projectId: "roarscore-1ddf5",
  storageBucket: "roarscore-1ddf5.firebasestorage.app",
  messagingSenderId: "680382994994",
  appId: "1:680382994994:web:9ed378373adc13b4563a2b",
  measurementId: "G-6VW7WCK4FW",
};

const config = firebaseConfig;

// Detect if running in Node.js environment
const isNode = typeof window === 'undefined' && typeof global !== 'undefined';

let app;

if (isNode) {
  // Server-side initialization using firebase-admin
  try {
    const { initializeApp, getApps, cert } = await import('./index-CVW4P9-_.js');
    
    // Check if app is already initialized
    if (getApps().length === 0) {
      let serviceAccount;
      
      try {
        // Try to load service account key from functions directory
        const { default: serviceAccountKey } = await import('./serviceAccountKey-Uhhd5tYs.js');
        serviceAccount = serviceAccountKey;
      } catch (error) {
        console.warn('Service account key not found, using default credentials');
        serviceAccount = undefined;
      }
      
      // Initialize admin app
      app = initializeApp({
        credential: serviceAccount ? cert(serviceAccount) : undefined,
        projectId: config.projectId,
        storageBucket: config.storageBucket
      });
    } else {
      app = getApps()[0];
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
} else {
  // Client-side initialization using firebase/app
  const { initializeApp } = await import('./index.esm-bxq7JP0B.js');
  app = initializeApp(config);
}

export { app as a };
//# sourceMappingURL=rsfirebase-DS4AlBEm.js.map
