// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneManagement/zoneFirestore.js
// PURPOSE: 📣 GENERIC BROADCAST EVENT
// DEPENDS_ON: ../../modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../modules/zonesUtils.js, ../../modules/scoreboardManager.js, ../../modules/data.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { db } from '../../modules/config.js';
import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { flashPlayerLocation } from '../../modules/zonesUtils.js';
import { updateControlledZones } from '../../modules/scoreboardManager.js';
import { allTeams } from '../../modules/data.js';

/* ---------------------------------------------------------------------------
 * 📣 GENERIC BROADCAST EVENT
 * ------------------------------------------------------------------------ */
/*
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
/*
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

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneManagement/zoneFirestore.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: broadcastEvent, broadcastChallenge, broadcastWin
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
