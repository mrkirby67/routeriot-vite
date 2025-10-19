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
export async function broadcastEvent(teamName, message, isBroadcast = true) {
  try {
    const teamObj = allTeams.find(t => t.name === teamName);
    const cleanName = teamObj ? teamObj.name : teamName;

    await addDoc(collection(db, 'communications'), {
      teamName: cleanName,
      message,
      isBroadcast,
      timestamp: serverTimestamp()
    });

    console.log(`📢 Broadcast → ${cleanName}: ${message}`);
  } catch (err) {
    console.error('❌ Broadcast error:', err);
  }
}

/* ---------------------------------------------------------------------------
 * ⚔️ CHALLENGE START
 * ------------------------------------------------------------------------ */
export const broadcastChallenge = async (teamName, zoneName) => {
  const cleanTeam = allTeams.find(t => t.name === teamName)?.name || teamName;
  await broadcastEvent(cleanTeam, `is challenging ${zoneName}!`);
};

/* ---------------------------------------------------------------------------
 * 🏆 CHALLENGE WIN / ZONE CAPTURE
 * ------------------------------------------------------------------------ */
export const broadcastWin = async (teamName, zoneName) => {
  const cleanTeam = allTeams.find(t => t.name === teamName)?.name || teamName;

  // 1️⃣ Announce victory
  await broadcastEvent(cleanTeam, `** has captured ${zoneName}! **`);

  // 2️⃣ Update the scoreboard
  await updateControlledZones(cleanTeam, zoneName);

  // 3️⃣ Update zone ownership
  await setDoc(
    doc(db, 'zones', zoneName),
    {
      status: 'Taken',
      controllingTeam: cleanTeam,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  console.log(`🏁 ${cleanTeam} captured ${zoneName}. Scoreboard + zone synced.`);
};

/* ---------------------------------------------------------------------------
 * 🗺️ UPDATE TEAM LOCATION
 * ------------------------------------------------------------------------ */
export async function updateTeamLocation(teamName, zoneName) {
  try {
    const cleanTeam = allTeams.find(t => t.name === teamName)?.name || teamName;

    await setDoc(
      doc(db, 'teamStatus', cleanTeam),
      {
        lastKnownLocation: zoneName,
        timestamp: serverTimestamp()
      },
      { merge: true }
    );

    const now = new Date();
    flashPlayerLocation(`📍 ${zoneName} (updated ${now.toLocaleTimeString()})`);

    console.log(`📍 Location updated → ${cleanTeam}: ${zoneName}`);
  } catch (err) {
    console.error('❌ updateTeamLocation error:', err);
  }
}