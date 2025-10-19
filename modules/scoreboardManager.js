// ============================================================================
// File: /modules/scoreboardManager.js
// Purpose: Manage all score and zone updates for the scoreboard
// ============================================================================

import { db } from './config.js';
import {
  doc,
  setDoc,
  increment,
  onSnapshot,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------------------------------
 * ADD POINTS TO TEAM
 * ------------------------------------------------------------------------ */
/**
 * Adds a given number of points to a team's score.
 * This is used by the zones.js module when a challenge is successfully completed.
 * @param {string} teamName - The name of the team to award points to.
 * @param {number} points - The number of points to add (can be negative).
 */
export async function addPointsToTeam(teamName, points) {
  if (!teamName || typeof points !== 'number') return;
  const scoreRef = doc(db, "scores", teamName);
  try {
    await setDoc(scoreRef, { score: increment(points) }, { merge: true });
  } catch (error) {
    console.error(`❌ Failed to add points for ${teamName}:`, error);
  }
}

/* ---------------------------------------------------------------------------
 * UPDATE CONTROLLED ZONES
 * ------------------------------------------------------------------------ */
/**
 * Updates the 'zonesControlled' field for a team in the scoreboard.
 * @param {string} teamName - The name of the team.
 * @param {string} zoneName - The name of the zone they now control.
 */
export async function updateControlledZones(teamName, zoneName) {
  if (!teamName || !zoneName) return;
  const scoreRef = doc(db, "scores", teamName);
  try {
    // This overwrites the previous zone. Future enhancement could track multiple.
    await setDoc(scoreRef, { zonesControlled: zoneName }, { merge: true });
  } catch (error) {
    console.error(`❌ Failed to update controlled zones for ${teamName}:`, error);
  }
}

/* ---------------------------------------------------------------------------
 * RESET ALL SCORES + ZONES
 * ------------------------------------------------------------------------ */
/**
 * Resets all scores to 0 and clears control data for all zones.
 * Intended for use by the Control panel's "Reset Scores" button.
 */
export async function resetScores() {
  try {
    const scoresCol = collection(db, 'scores');
    const zonesCol = collection(db, 'zones');

    console.log('🧹 Resetting all team scores and zone control data...');

    // 1️⃣ Reset all team scores and zonesControlled values
    const scoreSnaps = await getDocs(scoresCol);
    for (const s of scoreSnaps.docs) {
      await setDoc(
        doc(db, 'scores', s.id),
        { score: 0, zonesControlled: '—' },
        { merge: true }
      );
    }

    // 2️⃣ Reset all zone ownership info
    const zoneSnaps = await getDocs(zonesCol);
    for (const z of zoneSnaps.docs) {
      await setDoc(
        doc(db, 'zones', z.id),
        { status: 'Available', controllingTeam: null },
        { merge: true }
      );
    }

    console.log('✅ All scores and zones have been reset.');
  } catch (error) {
    console.error('❌ Failed to reset scores and zones:', error);
  }
}

/* ---------------------------------------------------------------------------
 * INITIALIZE PLAYER SCOREBOARD (LIVE VIEW)
 * ------------------------------------------------------------------------ */
/**
 * Initializes the live scoreboard on the player page.
 */
export function initializePlayerScoreboard() {
  const scoreboardBody = document.getElementById('player-scoreboard-tbody');
  if (!scoreboardBody) return;

  const scoresCollection = collection(db, "scores");
  onSnapshot(scoresCollection, (snapshot) => {
    const scores = [];
    snapshot.forEach(docSnap => {
      scores.push({ name: docSnap.id, ...docSnap.data() });
    });

    // Sort teams by score (highest first)
    scores.sort((a, b) => (b.score || 0) - (a.score || 0));

    scoreboardBody.innerHTML = '';
    scores.forEach(teamScore => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${teamScore.name}</td>
        <td>${teamScore.score || 0}</td>
      `;
      scoreboardBody.appendChild(row);
    });
  });
}