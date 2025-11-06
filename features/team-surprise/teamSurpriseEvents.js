// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/team-surprise/teamSurpriseEvents.js
// PURPOSE: Client-side event wiring helpers for Team Surprise interactions.
// DEPENDS_ON: ./teamSurpriseState.js
// USED_BY: ui/team-surprise/teamSurpriseUI.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

import {
  activeShields,
  activeWildCards,
  activeCooldowns,
  readShieldDurationMinutes,
  getShieldDurationMs,
  activateShield,
  isShieldActive,
  deactivateShield,
  getShieldTimeRemaining,
  isUnderWildCard,
  startWildCard,
  clearWildCard,
  startCooldown,
  resetSurpriseCaches
} from './teamSurpriseState.js';
import {
  triggerSurpriseEvent,
  registerSurpriseAttachHandler
} from './teamSurprise.bridge.js';

let listenersAttached = false;

function handleSurpriseDispatch(event) {
  if (!event || typeof event !== 'object') return;
  const detail = event.detail;
  if (detail == null) return;
  try {
    triggerSurpriseEvent(detail);
  } catch (err) {
    console.warn('teamSurpriseEvents: triggerSurpriseEvent failed', err);
  }
}

export function attachTeamSurpriseEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('teamSurprise:trigger', handleSurpriseDispatch);
  } else if (typeof globalThis?.addEventListener === 'function') {
    globalThis.addEventListener('teamSurprise:trigger', handleSurpriseDispatch);
  }
}

registerSurpriseAttachHandler(attachTeamSurpriseEventListeners);

export {
  activeShields,
  activeWildCards,
  activeCooldowns,
  readShieldDurationMinutes,
  getShieldDurationMs,
  activateShield,
  isShieldActive,
  deactivateShield,
  getShieldTimeRemaining,
  isUnderWildCard,
  startWildCard,
  clearWildCard,
  startCooldown,
  resetSurpriseCaches
};

// === AICP FEATURE FOOTER ===
// aicp_category: feature
// ai_origin: features/team-surprise/teamSurpriseEvents.js
// ai_role: Logic Layer
// codex_phase: tier2_features_injection
// export_bridge: components
// exports: activeShields, activeWildCards, activeCooldowns, readShieldDurationMinutes, getShieldDurationMs, activateShield, isShieldActive, deactivateShield, getShieldTimeRemaining, isUnderWildCard, startWildCard, clearWildCard, startCooldown, resetSurpriseCaches, attachTeamSurpriseEventListeners
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
