// ============================================================================
// FILE: /modules/zones.js
// PURPOSE: Orchestrates zone rendering, listeners, and challenge flow
// ============================================================================
import { db } from './config.js';
import {
  doc,
  onSnapshot,
  collection,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { waitForElement, flashPlayerLocation } from './zonesUtils.js';
import { generateMiniMap } from './zonesMap.js';
import { playRaceStartSequence } from './zonesUtils.js';
import { displayZoneQuestions, setTeamContext } from './zonesChallenge.js';
import { broadcastChallenge } from './zonesFirestore.js';
import { calculateDistance } from './zonesUtils.js';
import { updateControlledZones } from './scoreboardManager.js';
import { startConfetti, stopConfetti } from './playerUI.js';
import { allTeams } from '../data.js';

let zonesLocked = true;
let currentTeamName = null;

/* ---------------------------------------------------------------------------
 * INITIALIZE ZONES (Player View)
 * ------------------------------------------------------------------------ */
export async function initializeZones(teamName) {
  // Standardize the team name
  const teamObj = allTeams.find(t => t.name === teamName);
  currentTeamName = teamObj ? teamObj.name : teamName;
  setTeamContext(currentTeamName);

  const tableBody = await waitForElement('player-zones-tbody');
  const zonesCollection = collection(db, 'zones');

  /* -------------------------------------------------------------------------
   * 🔔 LISTEN TO GAME STATE (lock/unlock zones + detect ending)
   * ---------------------------------------------------------------------- */
  onSnapshot(doc(db, 'game', 'gameState'), (gameSnap) => {
    const data = gameSnap.data();
    if (!data?.status) return;

    const wasLocked = zonesLocked;
    const shouldLock = !(data.status === 'active' && data.zonesReleased);

    if (wasLocked && !shouldLock) {
      playRaceStartSequence();
      console.log('🏁 Race started — zones unlocked for challenges!');
    }

    // 🏆 Detect Game End → Show Top 3 Winners overlay
    if (data.status === 'finished' || data.status === 'ended') {
      showFinalStandings(); // ✅ call directly here
    }

    zonesLocked = shouldLock;
  });

  /* -------------------------------------------------------------------------
   * 🗺️ LISTEN TO ALL ZONES (re-render zone table)
   * ---------------------------------------------------------------------- */
  onSnapshot(zonesCollection, (snapshot) => {
    tableBody.innerHTML = '';

    snapshot.forEach(docSnap => {
      const zone = docSnap.data();
      const zoneId = docSnap.id;

      const statusText =
        zone.status === 'Taken' && zone.controllingTeam
          ? `Controlled by ${zone.controllingTeam}`
          : 'Available';

      const lockedAttr = zonesLocked ? 'disabled' : '';
      const row = document.createElement('tr');
      row.dataset.zoneId = zoneId;
      row.innerHTML = `
        <td>${zone.name || zoneId}</td>
        <td>${generateMiniMap(zone)}</td>
        <td>${statusText}</td>
        <td>
          <button class="challenge-btn" data-zone-id="${zoneId}" ${lockedAttr}>
            ${zonesLocked ? 'Locked' : 'Challenge'}
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  });

  /* -------------------------------------------------------------------------
   * 🎯 HANDLE CHALLENGE ATTEMPTS
   * ---------------------------------------------------------------------- */
  if (!tableBody._listenerAttached) {
    tableBody.addEventListener('click', async (e) => {
      if (!e.target.classList.contains('challenge-btn') || zonesLocked) return;

      const zoneId = e.target.dataset.zoneId;
      const zoneDoc = await getDoc(doc(db, 'zones', zoneId));
      if (!zoneDoc.exists()) return alert('Zone data not found.');

      const zoneData = zoneDoc.data();
      const [targetLat, targetLng] = zoneData.gps.split(',').map(Number);
      const targetRadiusKm = (parseFloat(zoneData.diameter) || 0.05) / 2;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const dist = calculateDistance(
            pos.coords.latitude,
            pos.coords.longitude,
            targetLat,
            targetLng
          );

          if (dist <= targetRadiusKm + pos.coords.accuracy / 1000) {
            console.log(`✅ ${currentTeamName} reached ${zoneData.name} zone.`);

            await broadcastChallenge(currentTeamName, zoneData.name);
            displayZoneQuestions(zoneId, zoneData.name);

            await updateControlledZones(currentTeamName, zoneData.name);
            console.log(`🏆 Zone updated → ${currentTeamName} now controls ${zoneData.name}`);
          } else {
            const kmAway = Math.max(0, dist - targetRadiusKm).toFixed(3);
            alert(`Getting warmer... ${kmAway} km away.`);
          }
        },
        () => alert('Could not get your location. Enable location services.')
      );
    });

    tableBody._listenerAttached = true;
  }
}

// ============================================================================
// 🏁 GAME OVER HANDLER (Player View)
// Displays final standings with confetti + 20s timer
// ============================================================================
async function showFinalStandings() {
  try {
    const topTeamsSnap = await getDocs(
      query(collection(db, "scores"), orderBy("score", "desc"), limit(3))
    );

    const winners = [];
    topTeamsSnap.forEach((docSnap) => {
      winners.push({ name: docSnap.id, ...docSnap.data() });
    });

    const title = "🏁 GAME OVER 🏁";
    let message = `
      <h2 style='color:gold; font-size:2em; margin-bottom:0;'>🏆 Final Standings 🏆</h2>
      <ol style='list-style:none; padding:0; margin:10px 0;'>
    `;
    winners.forEach((team, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      message += `<li style="font-size:1.4em; margin:6px 0;">${medal} <strong>${team.name}</strong> — ${team.score} pts</li>`;
    });
    message += "</ol>";

    const overlay = document.createElement("div");
    overlay.id = "game-over-overlay";
    overlay.style.cssText = `
      position:fixed;
      top:0; left:0;
      width:100%; height:100%;
      background:rgba(0,0,0,0.92);
      color:white;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      text-align:center;
      z-index:99999;
      font-family:system-ui, sans-serif;
      opacity:0;
      transition:opacity 0.6s ease;
    `;
    overlay.innerHTML = `
      <div>${title}</div>
      <div style="margin-top:10px;">${message}</div>
      <div id="countdown" style="margin-top:20px;font-size:1.3em;">Closing in 20s...</div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => (overlay.style.opacity = "1")); // smooth fade in

    // --- Confetti celebration
    startConfetti();
    let remaining = 20;
    const countdownEl = overlay.querySelector("#countdown");

    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        stopConfetti();
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 600);
        flashPlayerLocation("🎉 Thanks for playing Route Riot!");
      } else {
        countdownEl.textContent = `Closing in ${remaining}s...`;
      }
    }, 1000);
  } catch (err) {
    console.error("Error showing final standings:", err);
  }
}