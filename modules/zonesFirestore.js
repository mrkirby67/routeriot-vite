// ============================================================================
// File: /modules/zonesFirestore.js
// Purpose: Firebase read/write + broadcast helpers for zones
// ============================================================================
import { db } from './config.js';
import {
  doc, setDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { flashPlayerLocation } from './zonesUtils.js';

export async function broadcastEvent(teamName, message, isBroadcast = true) {
  try {
    await addDoc(collection(db, "communications"), {
      teamName,
      message,
      isBroadcast,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error("Broadcast error:", e);
  }
}

export const broadcastChallenge = (teamName, zoneName) =>
  broadcastEvent(teamName, `is challenging ${zoneName}!`);

export const broadcastWin = (teamName, zoneName) =>
  broadcastEvent(teamName, `** has captured ${zoneName}! **`);

export async function updateTeamLocation(teamName, zoneName) {
  try {
    await setDoc(
      doc(db, "teamStatus", teamName),
      { lastKnownLocation: zoneName, timestamp: serverTimestamp() },
      { merge: true }
    );
    const now = new Date();
    flashPlayerLocation(`📍 ${zoneName} (updated ${now.toLocaleTimeString()})`);
  } catch (e) {
    console.error("updateTeamLocation error:", e);
  }
}