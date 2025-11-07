// ============================================================================
// FILE: modules/playerUI/autoInit.js
// PURPOSE: Auto-bootstrap player UI when teamName is present in URL
// ============================================================================

import { getTeamNameFromUrl, initializePlayerUI } from './core.js';
import { ensureSpeedBumpOverlayListeners } from '../../features/team-surprise/teamSurprise.bridge.js';

let detachSpeedBumpWatcher = null;

async function watchSpeedBumps(teamName) {
  if (!teamName) return;
  try {
    detachSpeedBumpWatcher?.('handover');
  } catch (err) {
    console.warn('[playerUI:autoInit] Failed to hand off previous speed bump watcher:', err);
  }
  try {
    detachSpeedBumpWatcher = await ensureSpeedBumpOverlayListeners({ teamName });
  } catch (err) {
    console.warn('[playerUI:autoInit] Failed to initialize Speed Bump overlay:', err);
    detachSpeedBumpWatcher = null;
  }
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
