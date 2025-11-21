// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SpeedBumpControl/controller/stateSync.js
// PURPOSE: Subscription helpers for Speed Bump assignments
// DEPENDS_ON: ../../../services/speed-bump/speedBumpService.js
// USED_BY: components/SpeedBumpControl (future wiring)
// AUTHOR: Route Riot – Speed Bump Restoration
// CREATED: 2025-11-06
// AICP_VERSION: 3.1
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { subscribeToGameSpeedBumps } from '../../../services/speed-bump/speedBumpService.js';

export function syncAssignments(controller) {
  if (!controller || typeof controller.gameId !== 'string') return () => {};
  return subscribeToGameSpeedBumps(controller.gameId, (assignments = []) => {
    if (typeof controller.handleAssignmentUpdate === 'function') {
      controller.handleAssignmentUpdate(assignments);
    }
  });
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SpeedBumpControl/controller/stateSync.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.1
// codex_phase: legacy_restore_phase1
// export_bridge: services
// exports: syncAssignments
// linked_files: []
// owner: Route Riot-AICP
// phase: legacy_restore_phase1
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: services
// === END AICP COMPONENT FOOTER ===
