import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DIAGNOSTIC TEST ---
// This will log the API key to the browser console so we can see if it's loading correctly.
console.log("API Key from .env file:", import.meta.env.VITE_FIREBASE_API_KEY);
// --------------------

const firebaseConfig = {
   // This is the special Vite syntax to securely load your secret key from the .env file.
   apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
   authDomain: "routeriotgame.firebaseapp.com",
   projectId: "routeriotgame",
   storageBucket: "routeriotgame.appspot.com",
   messagingSenderId: "872258112513",
   appId: "1:872258112513:web:3b1d9694a1c78f04f8c400",
   measurementId: "G-5MBCFDB983"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export both the database instance and the config object for other modules to use.
export { db, firebaseConfig };
