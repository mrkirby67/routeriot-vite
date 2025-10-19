// ============================================================================
// File: /modules/zonesFirestore.js
// Purpose: Firebase read/write + broadcast helpers for zones
// ============================================================================
import { db } from './config.js';
import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { flashPlayerLocation } from './zonesUtils.js';

// ---------------------------------------------------------------------------
// 🛰️ GENERIC BROADCAST EVENT
// ---------------------------------------------------------------------------
export async function broadcastEvent(teamName = "Game Master", message, isBroadcast = true) {
  try {
    const sender = teamName || "Game Master";
    let formattedMsg = message;

    // 🔹 Add inline HTML color styling for visual clarity in the control broadcast window
    if (message.includes("challenging")) {
      formattedMsg = `<span style="color:#FF5722; font-weight:bold;">${message}</span>`; // orange/red for challenges
    } else if (message.includes("captured")) {
      formattedMsg = `<span style="color:#FFD700; font-weight:bold;">${message}</span>`; // gold for wins
    } else {
      formattedMsg = `<span style="color:#FFFFFF;">${message}</span>`; // default white
    }

    await addDoc(collection(db, "communications"), {
      teamName: sender,
      senderDisplay: sender, // 🔧 ensures correct team name appears in broadcast window
      message: formattedMsg,
      isBroadcast,
      timestamp: serverTimestamp()
    });

    console.log(`📣 Broadcasted from ${sender}: ${message}`);
  } catch (e) {
    console.error("Broadcast error:", e);
  }
}

// ---------------------------------------------------------------------------
// 🏁 CHALLENGE / WIN EVENTS
// ---------------------------------------------------------------------------
export const broadcastChallenge = (teamName, zoneName) =>
  broadcastEvent(teamName, `is challenging ${zoneName}!`);

export const broadcastWin = (teamName, zoneName) =>
  broadcastEvent(teamName, `has captured ${zoneName}!`);

// ---------------------------------------------------------------------------
// 📍 TEAM LOCATION UPDATES
// ---------------------------------------------------------------------------
export async function updateTeamLocation(teamName, zoneName) {
  try {
    await setDoc(
      doc(db, "teamStatus", teamName),
      {
        lastKnownLocation: zoneName,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
    const now = new Date();
    flashPlayerLocation(`📍 ${zoneName} (updated ${now.toLocaleTimeString()})`);
  } catch (e) {
    console.error("updateTeamLocation error:", e);
  }
}