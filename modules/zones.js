// ============================================================================
// FILE: /modules/zones.js
// PURPOSE: Orchestrates zone rendering, listeners, and challenge flow
// ============================================================================
import { db } from './config.js';
import {
  doc,
  onSnapshot,
  collection,
  getDoc
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
let gameStarted = false;
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
   * 🔔 LISTEN TO GAME STATE (lock/unlock zones)
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