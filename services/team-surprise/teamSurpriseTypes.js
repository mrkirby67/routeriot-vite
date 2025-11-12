// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/team-surprise/teamSurpriseTypes.js
// PURPOSE: Shared constants and type keys for Team Surprise mechanics.
// DEPENDS_ON: none
// USED_BY: features/team-surprise/teamSurpriseEvents.js, features/team-surprise/teamSurpriseController.js, services/team-surprise/teamSurpriseService.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP SERVICE HEADER ===

// === BEGIN RECOVERED BLOCK ===
export const SurpriseTypes = Object.freeze({
  FLAT_TIRE: 'flatTire',
  BUG_SPLAT: 'bugSplat',
  WILD_CARD: 'wildCard',
  SPEED_BUMP: 'speedBump'
});

export const SHIELD_DURATION_STORAGE_KEY = 'shieldDuration';
export const DEFAULT_SHIELD_MINUTES = 15;
export const DEFAULT_COOLDOWN_MINUTES = 2;
// === END RECOVERED BLOCK ===

// === AICP SERVICE FOOTER ===
// aicp_category: service
// ai_origin: services/team-surprise/teamSurpriseTypes.js
// ai_role: Service Constants
// codex_phase: tier1_services_alignment
// export_bridge: services
// exports: SurpriseTypes, SHIELD_DURATION_STORAGE_KEY, DEFAULT_SHIELD_MINUTES, DEFAULT_COOLDOWN_MINUTES
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier1_services_alignment
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP SERVICE FOOTER ===
