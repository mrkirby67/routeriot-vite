// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SpeedBumpControl/controller/actions.js
// PURPOSE: Phase-1 backend bridges for control actions (attacker → victim)
// DEPENDS_ON: ../../services/speed-bump/speedBumpService.js
// USED_BY: components/SpeedBumpControl (future wiring)
// AUTHOR: Route Riot – Speed Bump Restoration
// CREATED: 2025-11-06
// AICP_VERSION: 3.1
// ============================================================================
// === END AICP COMPONENT HEADER ===

import {
  assignSpeedBump,
  reshuffleSpeedBumpPrompt,
  markSpeedBumpActive,
  completeSpeedBump,
  cancelSpeedBump
} from '../../../services/speed-bump/speedBumpService.js';

export async function assign({ gameId, attackerId, victimId, prompt }) {
  return assignSpeedBump({ gameId, attackerId, victimId, prompt });
}

export async function shuffle({ gameId, attackerId }) {
  return reshuffleSpeedBumpPrompt({ gameId, attackerId });
}

export async function activate({ gameId, attackerId }) {
  return markSpeedBumpActive({ gameId, attackerId });
}

export async function complete({ gameId, attackerId }) {
  return completeSpeedBump({ gameId, attackerId });
}

export async function cancel({ gameId, attackerId }) {
  return cancelSpeedBump({ gameId, attackerId });
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SpeedBumpControl/controller/actions.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.1
// codex_phase: legacy_restore_phase1
// export_bridge: services
// exports: assign, shuffle, activate, complete, cancel
// linked_files: []
// owner: Route Riot-AICP
// phase: legacy_restore_phase1
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: services
// === END AICP COMPONENT FOOTER ===
