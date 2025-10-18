import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
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

export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export { db, firebaseConfig };