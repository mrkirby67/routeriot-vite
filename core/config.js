// ============================================================================
// FILE: core/config.js
// PURPOSE: Firebase + Google Maps configuration with .env fallback
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// 🔍 Fallback-safe environment loader
// ---------------------------------------------------------------------------
function getEnv(key, fallback) {
  try {
    const value = import.meta?.env?.[key];
    return value && value !== "undefined" ? value : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// 🔑 Keys pulled from runtime config or Vite env
// ---------------------------------------------------------------------------
const runtimeFirebase =
  typeof window !== "undefined" ? window.__ROUTER_RIOT_FIREBASE_CONFIG__ : null;

function preferRuntime(key, fallbackKey) {
  if (runtimeFirebase && runtimeFirebase[key]) {
    return runtimeFirebase[key];
  }
  if (typeof window !== "undefined" && window[fallbackKey]) {
    return window[fallbackKey];
  }
  return undefined;
}

export const FIREBASE_API_KEY =
  preferRuntime("apiKey", "__VITE_FIREBASE_API_KEY") ||
  getEnv("VITE_FIREBASE_API_KEY", "");

if (!FIREBASE_API_KEY) {
  throw new Error(
    "Firebase API key missing. Define window.__ROUTER_RIOT_FIREBASE_CONFIG__ or VITE_FIREBASE_API_KEY."
  );
}

export const GOOGLE_MAPS_API_KEY =
  preferRuntime("mapsApiKey", "__VITE_GOOGLE_MAPS_API_KEY") ||
  getEnv("VITE_GOOGLE_MAPS_API_KEY", "");

if (!GOOGLE_MAPS_API_KEY) {
  console.warn("⚠️ Google Maps API key missing – set VITE_GOOGLE_MAPS_API_KEY or inject window.__VITE_GOOGLE_MAPS_API_KEY.");
}

// ---------------------------------------------------------------------------
// 🧩 Firebase configuration
// ---------------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: runtimeFirebase?.authDomain || "routeriotgame.firebaseapp.com",
  projectId: runtimeFirebase?.projectId || "routeriotgame",
  storageBucket: runtimeFirebase?.storageBucket || "routeriotgame.appspot.com",
  messagingSenderId: runtimeFirebase?.messagingSenderId || "872258112513",
  appId: runtimeFirebase?.appId || "1:872258112513:web:3b1d9694a1c78f04f8c400",
  measurementId: runtimeFirebase?.measurementId || "G-5MBCFDB983"
};

// ---------------------------------------------------------------------------
// 🚀 Initialize Firebase + Firestore
// ---------------------------------------------------------------------------
console.log(
  `🔥 Firebase Key: ${FIREBASE_API_KEY ? "Loaded ✅" : "❌ Missing"}`
);
console.log(
  `🗺️ Google Maps Key: ${GOOGLE_MAPS_API_KEY ? "Loaded ✅" : "❌ Missing"}`
);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { app };
