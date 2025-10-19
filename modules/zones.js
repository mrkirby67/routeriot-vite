// ============================================================================
// File: /modules/zones.js
// Purpose: Orchestrates zone rendering, listeners, and challenge flow
// ============================================================================
import { db } from './config.js';
import { doc, onSnapshot, collection, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { waitForElement } from './zonesUtils.js';
import { generateMiniMap } from './zonesMap.js';
import { playRaceStartSequence } from './zonesUtils.js';
import { displayZoneQuestions, setTeamContext } from './zonesChallenge.js';
import { broadcastChallenge } from './zonesFirestore.js';
import { calculateDistance } from './zonesUtils.js';

let zonesLocked = true;
let gameStarted = false;
let currentTeamName = null;

export async function initializeZones(teamName) {
  currentTeamName = teamName;
  setTeamContext(teamName);
  const tableBody = await waitForElement('player-zones-tbody');
  const zonesCollection = collection(db, "zones");

  onSnapshot(doc(db, "game", "gameState"), (gameSnap) => {
    const data = gameSnap.data();
    if (!data?.status) return;
    const previouslyLocked = zonesLocked;
    const newLocked = !(data.status === 'active' && data.zonesReleased);
    if (previouslyLocked && !newLocked) playRaceStartSequence();
    zonesLocked = newLocked;
  });

  onSnapshot(zonesCollection, (snapshot) => {
    tableBody.innerHTML = '';
    snapshot.forEach(docSnap => {
      const zone = docSnap.data();
      const zoneId = docSnap.id;
      const statusText =
        zone.status === 'Taken' && zone.controllingTeam
          ? `Controlled by ${zone.controllingTeam}`
          : 'Available';

      const locked = zonesLocked ? 'disabled' : '';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${zone.name || zoneId}</td>
        <td>${generateMiniMap(zone)}</td>
        <td>${statusText}</td>
        <td><button class="challenge-btn" data-zone-id="${zoneId}" ${locked}>
          ${zonesLocked ? 'Locked' : 'Challenge'}
        </button></td>
      `;
      tableBody.appendChild(row);
    });
  });

  if (!tableBody._listenerAttached) {
    tableBody.addEventListener('click', async (e) => {
      if (e.target.classList.contains('challenge-btn') && !zonesLocked) {
        const zoneId = e.target.dataset.zoneId;
        const zoneDoc = await getDoc(doc(db, "zones", zoneId));
        if (!zoneDoc.exists()) return alert("Zone data not found.");

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
              await broadcastChallenge(currentTeamName, zoneData.name);
              displayZoneQuestions(zoneId, zoneData.name);
            } else {
              alert(`Getting warmer... ${Math.max(0, dist - targetRadiusKm).toFixed(3)} km away.`);
            }
          },
          () => alert("Could not get your location. Enable location services.")
        );
      }
    });
    tableBody._listenerAttached = true;
  }
}