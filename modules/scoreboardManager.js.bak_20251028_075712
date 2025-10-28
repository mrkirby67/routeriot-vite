// ============================================================================
// FILE: /modules/scoreboardManager.js (UPDATED)
// PURPOSE: Manage all score and zone updates for the scoreboard
// Includes safer batch reset, broadcast-ready Top 3, and improved logs
// ============================================================================

import { db } from './config.js';
import { allTeams } from '../data.js';
import {
  doc,
  setDoc,
  updateDoc,
  runTransaction,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------------------------------
 * 🧮 ADD POINTS TO TEAM (Transaction Safe + Standardized)
 * ------------------------------------------------------------------------ */
/**
 * Adds or subtracts a given number of points to a team's score.
 * @param {string} teamName - The team's standardized name.
 * @param {number} points - Positive or negative integer.
 */
export async function addPointsToTeam(teamName, points) {
  if (!teamName || typeof points !== 'number') return;

  const team = allTeams.find(t => t.name === teamName);
  const cleanName = team ? team.name : teamName;
  const scoreRef = doc(db, 'scores', cleanName);

  try {
    await runTransaction(db, async (tx) => {
      const docSnap = await tx.get(scoreRef);
      const prevScore = docSnap.exists() ? (docSnap.data().score || 0) : 0;
      const newScore = prevScore + points;
      tx.set(scoreRef, { score: newScore, updatedAt: serverTimestamp() }, { merge: true });
    });
    console.log(`✅ Score updated: ${cleanName} → ${points >= 0 ? '+' : ''}${points}`);
  } catch (err) {
    console.error(`❌ Failed to update score for ${cleanName}:`, err);
  }
}

/* ---------------------------------------------------------------------------
 * 🧭 UPDATE CONTROLLED ZONES (Standardized)
 * ------------------------------------------------------------------------ */
/**
 * Updates the 'zonesControlled' field for a team in the scoreboard.
 * @param {string} teamName - The team's standardized name.
 * @param {string} zoneName - The name of the captured zone.
 */
export async function updateControlledZones(teamName, zoneName) {
  if (!teamName || !zoneName) return;

  const team = allTeams.find(t => t.name === teamName);
  const cleanName = team ? team.name : teamName;
  const scoreRef = doc(db, 'scores', cleanName);

  try {
    await setDoc(scoreRef, {
      zonesControlled: zoneName,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`📍 ${cleanName} now controls zone: ${zoneName}`);
  } catch (err) {
    console.error(`❌ Failed to update controlled zones for ${cleanName}:`, err);
  }
}

/* ---------------------------------------------------------------------------
 * 🧹 RESET ALL SCORES & ZONES (Batch Operation)
 * ------------------------------------------------------------------------ */
/**
 * Resets all team scores and clears zone control data.
 * Called by Control panel → “Clear All” button.
 */
export async function resetScores() {
  try {
    console.log('🧹 Resetting all team scores and zone ownership...');
    const batch = writeBatch(db);

    // 1️⃣ Reset all team scores
    const scoreSnaps = await getDocs(collection(db, 'scores'));
    scoreSnaps.forEach(snap => {
      batch.set(doc(db, 'scores', snap.id), {
        score: 0,
        zonesControlled: '—',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    // 2️⃣ Reset all zones
    const zoneSnaps = await getDocs(collection(db, 'zones'));
    zoneSnaps.forEach(zSnap => {
      batch.set(doc(db, 'zones', zSnap.id), {
        status: 'Available',
        controllingTeam: null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
    console.log('✅ All scores and zones successfully reset.');
  } catch (err) {
    console.error('❌ Failed to reset scores/zones:', err);
  }
}

/* ---------------------------------------------------------------------------
 * 🏆 INITIALIZE PLAYER SCOREBOARD (Live View)
 * ------------------------------------------------------------------------ */
/**
 * Realtime scoreboard listener for player dashboard.
 * Displays team names, scores, and sorts by score descending.
 */
export function initializePlayerScoreboard() {
  const scoreboardBody = document.getElementById('player-scoreboard-tbody');
  if (!scoreboardBody) return;

  const scoresCollection = collection(db, 'scores');

  onSnapshot(scoresCollection, (snapshot) => {
    const teams = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      teams.push({
        name: docSnap.id,
        score: data.score || 0,
        zonesControlled: data.zonesControlled || '—',
      });
    });

    // Sort descending by score
    teams.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Render table
    scoreboardBody.innerHTML = '';
    teams.forEach((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${medal} ${t.name}</td>
        <td>${t.score}</td>
      `;
      scoreboardBody.appendChild(row);
    });
  });
}

/* ---------------------------------------------------------------------------
 * 🏁 BROADCAST TOP 3 FINISHERS (called when game ends)
 * ------------------------------------------------------------------------ */
/**
 * Broadcasts the top 3 finishers to all players.
 * Adds spacing for visibility and includes celebration emojis.
 */
export async function broadcastTopThree() {
  try {
    const scoresSnap = await getDocs(collection(db, 'scores'));
    const scores = [];
    scoresSnap.forEach(docSnap => {
      const data = docSnap.data();
      scores.push({ team: docSnap.id, score: data.score || 0 });
    });

    if (scores.length === 0) {
      console.warn('⚠️ No scores found to broadcast.');
      return;
    }

    // Sort descending by score
    scores.sort((a, b) => b.score - a.score);
    const topThree = scores.slice(0, 3);

    const spacer = '\n'.repeat(10);
    let message = `${spacer}🏁🏁🏁  FINAL RESULTS  🏁🏁🏁\n\n`;
    topThree.forEach((t, i) => {
      const medals = ['🥇', '🥈', '🥉'][i] || '🏅';
      message += `${medals}  ${t.team} — ${t.score} pts\n`;
    });
    message += `\n🎉 Congratulations to all teams! 🎉`;

    await addDoc(collection(db, 'communications'), {
      teamName: 'Game Master',
      sender: 'Game Master',
      senderDisplay: 'Game Master',
      message,
      isBroadcast: true,
      timestamp: serverTimestamp()
    });

    console.log('✅ Top 3 broadcast sent successfully.');
  } catch (err) {
    console.error('❌ Error broadcasting top 3:', err);
  }
}
