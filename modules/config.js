// File: /public/modules/config.js
// WARNING: This file contains sensitive API keys. 
// Do not share this file or commit it to a public repository.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
   apiKey: "AIzaSyCLwTOP9oEApwfQ10o_QvU9yizqlW4_jzQ", // <-- This is a secret key
   authDomain: "routeriotgame.firebaseapp.com",
   projectId: "routeriotgame",
   storageBucket: "routeriotgame.appspot.com", // Corrected domain
   messagingSenderId: "872258112513",
   appId: "1:872258112513:web:3b1d9694a1c78f04f8c400",
   measurementId: "G-5MBCFDB983"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export both the database instance and the config object
export { db, firebaseConfig };