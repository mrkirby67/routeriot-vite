// ============================================================================
// MODULE: controlStatus.js (UPDATED)
// Purpose: Watch Firestore for live game updates and team status sync
// Works with game/gameState and teamStatus/{teamName}
// ============================================================================

import { listenForGameStatus } from './gameStateManager.js';
import { showFlashMessage } from './gameUI.js';
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './config.js';

// ---------------------------------------------------------------------------
// 🔹 Main Game Status Watcher
// ---------------------------------------------------------------------------
export function watchLiveGameStatus() {
  listenForGameStatus((state) => {
    const { status = 'waiting', zonesReleased = false } = state || {};
    const statusEl = document.getElementById('live-game-status');
    const zonesEl  = document.getElementById('live-zones-status');

    if (statusEl) statusEl.textContent = status.toUpperCase();
    if (zonesEl)  zonesEl.textContent  = zonesReleased ? 'Unlocked' : 'Locked';

    switch (status) {
      case 'active':
        showFlashMessage('🏁 Zones are LIVE!', '#2e7d32');
        break;
      case 'paused':
        showFlashMessage('⏸️ Game Paused!', '#ff9800');
        break;
      case 'finished':
      case 'ended':
        showFlashMessage('🏁 Game Over!', '#7b1fa2');
        break;
      default:
        showFlashMessage('Waiting to start...', '#616161');
        break;
    }
  });

  // Also begin watching per-team status collection for Control dashboard
  watchTeamStatuses();
}

// ---------------------------------------------------------------------------
// 🧭 Watch all teamStatus/{teamName} documents
// ---------------------------------------------------------------------------
function watchTeamStatuses() {
  const teamTable = document.getElementById('control-team-status-tbody');
  if (!teamTable) {
    console.warn('⚠️ No #control-team-status-tbody found; skipping teamStatus listener.');
    return;
  }

  const teamStatusRef = collection(db, 'teamStatus');
  onSnapshot(teamStatusRef, (snapshot) => {
    teamTable.innerHTML = ''; // rebuild each update

    snapshot.forEach((docSnap) => {
      const teamName = docSnap.id;
      const data = docSnap.data() || {};
      const location = data.lastKnownLocation || '--';
      const time = formatTimestamp(data.timestamp);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${teamName}</td>
        <td>${location !== '--' ? '📍 ' + location : '--'}</td>
        <td>${time || '--'}</td>
      `;
      teamTable.appendChild(tr);
    });
  });

  console.log('📡 Watching live teamStatus updates...');
}

// ---------------------------------------------------------------------------
// ⏱️ Helper: Format Firestore timestamps
// ---------------------------------------------------------------------------
function formatTimestamp(ts) {
  try {
    if (!ts) return '';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleTimeString();
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleTimeString();
    if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
  } catch (err) {
    console.warn('⚠️ Bad timestamp:', err);
  }
  return '';
}