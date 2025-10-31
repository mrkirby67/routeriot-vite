// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/team-surprise/teamSurpriseTypes.js
// PURPOSE: Shared constants and type keys for Team Surprise mechanics.
// DEPENDS_ON: none
// USED_BY: features/team-surprise/teamSurpriseEvents.js, features/team-surprise/teamSurpriseController.js, services/team-surprise/teamSurpriseService.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

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

// === AICP FEATURE FOOTER ===
// aicp_category: feature
// ai_origin: features/team-surprise/teamSurpriseTypes.js
// ai_role: Logic Layer
// codex_phase: tier2_features_injection
// export_bridge: components/*
// exports: SurpriseTypes, SHIELD_DURATION_STORAGE_KEY, DEFAULT_SHIELD_MINUTES, DEFAULT_COOLDOWN_MINUTES
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
