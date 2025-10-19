// ============================================================================
// MODULE: controlStatus.js
// Purpose: Watch Firestore for live game updates and display to UI
// ============================================================================

import { listenForGameStatus } from './gameStateManager.js';
import { showFlashMessage } from './gameUI.js';

export function watchLiveGameStatus() {
  listenForGameStatus((state) => {
    const { status = 'waiting', zonesReleased = false } = state || {};
    const statusEl = document.getElementById('live-game-status');
    const zonesEl  = document.getElementById('live-zones-status');

    if (statusEl) statusEl.textContent = status.toUpperCase();
    if (zonesEl)  zonesEl.textContent  = zonesReleased ? 'Unlocked' : 'Locked';

    switch (status) {
      case 'active':  showFlashMessage('Zones are LIVE!', '#2e7d32'); break;
      case 'paused':  showFlashMessage('⏸️ Game Paused!', '#ff9800'); break;
      case 'finished':showFlashMessage('Game Over!', '#7b1fa2'); break;
      default:        showFlashMessage('Waiting to start...', '#616161'); break;
    }
  });
}