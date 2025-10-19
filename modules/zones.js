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
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { waitForElement } from './zonesUtils.js';
import { generateMiniMap } from './zonesMap.js';
import { playRaceStartSequence } from './zonesUtils.js';
import { displayZoneQuestions, setTeamContext } from './zonesChallenge.js';
import { broadcastChallenge } from './zonesFirestore.js';
import { calculateDistance } from './zonesUtils.js';
import { updateControlledZones } from './scoreboardManager.js';
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
      showWinnersOverlay();
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

          // Within zone radius
          if (dist <= targetRadiusKm + pos.coords.accuracy / 1000) {
            console.log(`✅ ${currentTeamName} reached ${zoneData.name} zone.`);

            // Broadcast challenge → shows questions to team
            await broadcastChallenge(currentTeamName, zoneData.name);
            displayZoneQuestions(zoneId, zoneData.name);

            // Update scoreboard ownership immediately
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

/* ---------------------------------------------------------------------------
 * 🏁 WINNERS OVERLAY FOR PLAYER PAGES
 * ------------------------------------------------------------------------ */
async function showWinnersOverlay() {
  try {
    const scoresSnap = await getDocs(collection(db, 'scores'));
    const teams = [];
    scoresSnap.forEach(docSnap => {
      const d = docSnap.data();
      teams.push({ name: docSnap.id, score: d.score || 0 });
    });

    if (teams.length === 0) return;

    teams.sort((a, b) => b.score - a.score);
    const podium = teams.slice(0, 3);

    // 🎉 Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'winners-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.95);
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      text-align: center;
      font-family: 'Orbitron', sans-serif;
      animation: fadeIn 0.6s ease;
    `;

    overlay.innerHTML = `
      <h1 style="font-size:3em;color:#ffeb3b;margin-bottom:10px;">🏁 GAME OVER 🏁</h1>
      <h2 style="margin:0 0 20px 0;">FINAL STANDINGS</h2>
      <div style="font-size:1.5em;line-height:1.6;">
        ${podium[0] ? `🥇 <b>${podium[0].name}</b> – ${podium[0].score} pts<br>` : ''}
        ${podium[1] ? `🥈 <b>${podium[1].name}</b> – ${podium[1].score} pts<br>` : ''}
        ${podium[2] ? `🥉 <b>${podium[2].name}</b> – ${podium[2].score} pts<br>` : ''}
      </div>
    `;
    document.body.appendChild(overlay);

    // 🎊 Trigger existing confetti from playerUI
    try {
      const mod = await import('./playerUI.js');
      if (mod.startConfetti) mod.startConfetti();
    } catch (err) {
      console.warn('Confetti module not available:', err);
    }

    console.log('🏆 Winners overlay displayed for player page.');
  } catch (err) {
    console.error('Failed to render winners overlay:', err);
  }
}