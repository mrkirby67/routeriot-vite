import { db } from './config.js';
import { doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// WARNING: In a real-world app, a player should NEVER be able to award their own points.
// This logic should be on a secure backend. For this project, we are keeping it client-side.
export async function addPointsToTeam(teamName, points) {
    if (!teamName || !points) return;
    const scoreRef = doc(db, "scores", teamName);
    await setDoc(scoreRef, { score: increment(points) }, { merge: true });
}

export async function updateControlledZones(teamName, zoneName) {
    if (!teamName || !zoneName) return;
    const scoreRef = doc(db, "scores", teamName);
    // This will overwrite previous zones. A real app might append to an array.
    await setDoc(scoreRef, { zonesControlled: zoneName }, { merge: true });
}

