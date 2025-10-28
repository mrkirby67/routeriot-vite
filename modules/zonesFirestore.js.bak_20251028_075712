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
    const safeMessage = typeof message === 'string' ? message : '';
    let formattedMsg = safeMessage;

    // 🔹 Add HTML color styling for control dashboard readability
    const lowered = safeMessage.toLowerCase();
    if (lowered.includes("challenging")) {
      formattedMsg = `<span style="color:#ff7043; font-weight:bold;">${safeMessage}</span>`; // orange
    } else if (lowered.includes("captured")) {
      formattedMsg = `<span style="color:#ffd700; font-weight:bold;">${safeMessage}</span>`; // gold
    } else if (lowered.includes("finished") || lowered.includes("completed")) {
      formattedMsg = `<span style="color:#00e676; font-weight:bold;">${safeMessage}</span>`; // green
    } else {
      formattedMsg = `<span style="color:#ffffff;">${safeMessage}</span>`; // default white
    }

    await addDoc(collection(db, "communications"), {
      teamName: sender,
      sender,
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
