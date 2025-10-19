import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Diagnostics ---
console.log("🔥 Firebase Key:", import.meta.env.VITE_FIREBASE_API_KEY);
console.log("🗺️ Google Maps Key:", import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "routeriotgame.firebaseapp.com",
  projectId: "routeriotgame",
  storageBucket: "routeriotgame.appspot.com",
  messagingSenderId: "872258112513",
  appId: "1:872258112513:web:3b1d9694a1c78f04f8c400",
  measurementId: "G-5MBCFDB983"
};

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);