// ============================================================================
// FILE: modules/config.js
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
// 🔑 Keys with fallback values (Firebase & Maps)
// ---------------------------------------------------------------------------
const FALLBACK_FIREBASE_KEY = "AIzaSyDxpd_n3RY7M6hEqMh3BAZLAgzPTTfUQXc";
const FALLBACK_MAPS_KEY = "AIzaSyDxpd_n3RY7M6hEqMh3BAZLAgzPTTfUQXc";

export const FIREBASE_API_KEY = getEnv("VITE_FIREBASE_API_KEY", FALLBACK_FIREBASE_KEY);
export const GOOGLE_MAPS_API_KEY = getEnv("VITE_GOOGLE_MAPS_API_KEY", FALLBACK_MAPS_KEY);

// ---------------------------------------------------------------------------
// 🧩 Firebase configuration
// ---------------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: "routeriotgame.firebaseapp.com",
  projectId: "routeriotgame",
  storageBucket: "routeriotgame.appspot.com",
  messagingSenderId: "872258112513",
  appId: "1:872258112513:web:3b1d9694a1c78f04f8c400",
  measurementId: "G-5MBCFDB983"
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