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
import { updateControlledZones } from './scoreboardManager.js';
import { allTeams } from '../data.js';

/* ---------------------------------------------------------------------------
 * 📣 GENERIC BROADCAST EVENT
 * ------------------------------------------------------------------------ */
/**
 * Adds a broadcast message to Firestore for display in control & player UIs.
 * @param {string} teamName - Team name or fallback string.
 * @param {string} message - Message content.
 * @param {boolean} [isBroadcast=true] - Whether this should appear globally.
 */
export async function broadcastEvent(teamName, message, isBroadcast = true) {
  try {
    const cleanTeam =
      allTeams.find(t => t.name === teamName)?.name || teamName || "Game Master";
    const text = (message || "").trim();
    if (!text) return;

    await addDoc(collection(db, "communications"), {
      teamName: cleanTeam,
      sender: cleanTeam,
      senderDisplay: cleanTeam,
      message: text,
      isBroadcast,
      timestamp: serverTimestamp(),
    });

    console.log(`📢 Broadcast → ${cleanTeam}: ${message}`);
  } catch (err) {
    console.error("❌ Broadcast error:", err);
  }
}

/* ---------------------------------------------------------------------------
 * ⚔️ CHALLENGE START
 * ------------------------------------------------------------------------ */
export async function broadcastChallenge(teamName, zoneName) {
  try {
    const cleanTeam = allTeams.find(t => t.name === teamName)?.name || teamName;
    await broadcastEvent(cleanTeam, `is challenging ${zoneName}!`);
  } catch (err) {
    console.error("❌ broadcastChallenge error:", err);
  }
}

/* ---------------------------------------------------------------------------
 * 🏆 CHALLENGE WIN / ZONE CAPTURE
 * ------------------------------------------------------------------------ */
/**
 * Broadcasts a win, updates Firestore zones & scoreboard.
 * @param {string} teamName
 * @param {string} zoneName
 */
export async function broadcastWin(teamName, zoneName) {
  try {
    const cleanTeam = allTeams.find(t => t.name === teamName)?.name || teamName;

    // 1️⃣ Announce victory
    await broadcastEvent(cleanTeam, `🏆 has captured ${zoneName}!`);

    // 2️⃣ Update scoreboard
    await updateControlledZones(cleanTeam, zoneName);

    // 3️⃣ Update zone ownership
    await setDoc(
      doc(db, "zones", zoneName),
      {
        status: "Taken",
        controllingTeam: cleanTeam,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`🏁 ${cleanTeam} captured ${zoneName}. Scoreboard + zone synced.`);
  } catch (err) {
    console.error("❌ broadcastWin error:", err);
  }
}

/* ---------------------------------------------------------------------------
 * 🗺️ UPDATE TEAM LOCATION
 * ------------------------------------------------------------------------ */
/**
 * Updates the team's last known zone location in Firestore.
 * Triggers a brief UI flash for player feedback.
 * @param {string} teamName
 * @param {string} zoneName
 */
export async function updateTeamLocation(teamName, zoneName) {
  try {
    const cleanTeam = allTeams.find(t => t.name === teamName)?.name || teamName;

    if (!cleanTeam || !zoneName) {
      console.warn("⚠️ updateTeamLocation called with missing parameters:", {
        teamName,
        zoneName,
      });
      return;
    }

    await setDoc(
      doc(db, "teamStatus", cleanTeam),
      {
        lastKnownLocation: zoneName,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );

    const now = new Date();
    flashPlayerLocation(`📍 ${zoneName} (updated ${now.toLocaleTimeString()})`);

    console.log(`📍 Location updated → ${cleanTeam}: ${zoneName}`);
  } catch (err) {
    console.error("❌ updateTeamLocation error:", err);
  }
}
