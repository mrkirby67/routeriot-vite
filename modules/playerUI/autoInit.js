// ============================================================================
// FILE: modules/playerUI/autoInit.js
// PURPOSE: Auto-bootstrap player UI when teamName is present in URL
// ============================================================================

import { getTeamNameFromUrl, initializePlayerUI } from './core.js';

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const teamName = getTeamNameFromUrl();
    if (teamName) initializePlayerUI(teamName);
  });
}
