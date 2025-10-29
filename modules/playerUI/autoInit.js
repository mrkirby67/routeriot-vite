// ============================================================================
// FILE: modules/playerUI/autoInit.js
// PURPOSE: Auto-bootstrap player UI when teamName is present in URL
// ============================================================================

import { getTeamNameFromUrl, initializePlayerUI } from './core.js';
import { subscribeSpeedBumps } from '../speedBump/index.js';
import { onSpeedBumpUpdate } from './overlays/speedBumpOverlay.js';

let detachSpeedBumpWatcher = null;

function watchSpeedBumps(teamName) {
  if (!teamName) return;
  detachSpeedBumpWatcher?.();
  detachSpeedBumpWatcher = subscribeSpeedBumps(teamName, onSpeedBumpUpdate);
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
    detachSpeedBumpWatcher?.();
    detachSpeedBumpWatcher = null;
  }, { once: true });
}
