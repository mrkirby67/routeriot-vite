// ============================================================================
// FILE: modules/playerUI/autoInit.js
// PURPOSE: Auto-bootstrap player UI when teamName is present in URL
// ============================================================================

import { getTeamNameFromUrl, initializePlayerUI } from './core.js';
import { initializeSpeedBumpPlayer } from '../speedBumpPlayer.js';

let detachSpeedBumpWatcher = null;

function watchSpeedBumps(teamName) {
  if (!teamName) return;
  try {
    detachSpeedBumpWatcher?.('handover');
  } catch (err) {
    console.warn('[playerUI:autoInit] Failed to hand off previous speed bump watcher:', err);
  }
  detachSpeedBumpWatcher = initializeSpeedBumpPlayer(teamName);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const teamName = getTeamNameFromUrl();
    if (teamName) {
      initializePlayerUI(teamName);
      watchSpeedBumps(teamName);
    }
  });

  window.addEventListener('beforeunload', () => {
    detachSpeedBumpWatcher?.('page-unload');
    detachSpeedBumpWatcher = null;
  }, { once: true });
}
