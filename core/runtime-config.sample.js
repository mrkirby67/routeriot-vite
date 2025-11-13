// Copy this file to core/runtime-config.js and provide your real keys.
// Keep core/runtime-config.js out of git (see .gitignore) to avoid
// leaking Firebase / Google Maps credentials in source control.

window.__ROUTER_RIOT_FIREBASE_CONFIG__ = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'your-app.firebaseapp.com',
  databaseURL: 'https://your-app.firebaseio.com',
  projectId: 'your-app',
  storageBucket: 'your-app.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
  measurementId: 'G-XXXXXXXXXX',
};

// Optional: override Fastest Finger with a separate Firebase project.
window.__FF_FIREBASE_CONFIG__ = window.__ROUTER_RIOT_FIREBASE_CONFIG__;

// Optional: expose Maps key if components rely on it.
window.__ROUTER_RIOT_GOOGLE_MAPS_KEY__ = 'YOUR_GOOGLE_MAPS_API_KEY';
window.__VITE_GOOGLE_MAPS_API_KEY = window.__ROUTER_RIOT_GOOGLE_MAPS_KEY__;
window.__ROUTER_RIOT_FIREBASE_CONFIG__.mapsApiKey = window.__ROUTER_RIOT_GOOGLE_MAPS_KEY__;
