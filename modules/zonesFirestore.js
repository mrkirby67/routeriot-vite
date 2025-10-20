// ============================================================================
// FILE: /modules/zonesFirestore.js
// PURPOSE: Firebase read/write + broadcast helpers for zones
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
export async function broadcastEvent(teamName = "Game Master", message = "", isBroadcast = true) {
  try {
    const sender = teamName?.trim() || "Game Master";
    let formattedMsg = message;

    // 🔹 Add HTML color styling for control dashboard readability
    if (message.toLowerCase().includes("challenging")) {
      formattedMsg = `<span style="color:#ff7043; font-weight:bold;">${message}</span>`; // orange
    } else if (message.toLowerCase().includes("captured")) {
      formattedMsg = `<span style="color:#ffd700; font-weight:bold;">${message}</span>`; // gold
    } else if (message.toLowerCase().includes("finished") || message.toLowerCase().includes("completed")) {
      formattedMsg = `<span style="color:#00e676; font-weight:bold;">${message}</span>`; // green
    } else {
      formattedMsg = `<span style="color:#ffffff;">${message}</span>`; // default white
    }

    await addDoc(collection(db, "communications"), {
      teamName: sender,
      senderDisplay: sender,
      message: formattedMsg,
      isBroadcast,
      timestamp: serverTimestamp()
    });

    console.log(`📣 Broadcasted from ${sender}: ${message}`);
  } catch (err) {
    console.error("❌ Broadcast error:", err);
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
    if (!teamName || !zoneName) {
      console.warn("⚠️ updateTeamLocation called with missing parameters:", { teamName, zoneName });
      return;
    }

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
    console.log(`📍 Updated ${teamName} location → ${zoneName}`);
  } catch (err) {
    console.error("❌ updateTeamLocation error:", err);
  }
}