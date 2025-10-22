// ============================================================================
// FILE: modules/playerUI.js
// PURPOSE: Public API for player UI helpers (modularized implementation)
// ============================================================================

export { initializePlayerUI, updatePlayerTimer } from './playerUI/core.js';
export { showPausedOverlay, hidePausedOverlay, showGameOverOverlay, startConfetti, stopConfetti } from './playerUI/overlays.js';

import './playerUI/autoInit.js';
