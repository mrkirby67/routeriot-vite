// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/TeamSurpriseManager/TeamSurpriseManager.js
// PURPOSE: Mounts the Surprise Selector dashboard for Team Surprise management.
// DEPENDS_ON: ../SurpriseSelector/SurpriseSelector.js, ../../ui/team-surprise/teamSurpriseUI.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import {
  SurpriseSelectorComponent,
  initializeSurpriseSelector,
  teardownSurpriseSelector
} from '../SurpriseSelector/SurpriseSelector.js';
import { checkShieldBeforeAttack } from '../../ui/team-surprise/teamSurpriseUI.js';

export function renderTeamSurpriseManager(container) {
  if (!container) return () => {};
  container.innerHTML = SurpriseSelectorComponent();
  const cleanup = initializeSurpriseSelector();
  return () => {
    cleanup?.('component-unmount');
    teardownSurpriseSelector('component-unmount');
  };
}

export function initializeTeamSurpriseManager(container) {
  return renderTeamSurpriseManager(container);
}

export { teardownSurpriseSelector as teardownTeamSurpriseManager };
export { checkShieldBeforeAttack };

// === AICP COMPONENT FOOTER ===
// ai_origin: components/TeamSurpriseManager/TeamSurpriseManager.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: renderTeamSurpriseManager, initializeTeamSurpriseManager, teardownTeamSurpriseManager, checkShieldBeforeAttack
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
