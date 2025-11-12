// === AICP MODULE HEADER ===
// ============================================================================
// FILE: features/team-surprise/teamSurpriseController.js
// PURPOSE: Re-export Team Surprise logic split across features, services, and UI.
// DEPENDS_ON: ../features/team-surprise/teamSurpriseController.js, ../services/team-surprise/teamSurpriseService.js, ../ui/team-surprise/teamSurpriseUI.js
// USED_BY: components/SurpriseSelector/SurpriseSelector.js, modules/chatManager/playerChat.ui.js, modules/controlActions.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP MODULE HEADER ===

export * from '../features/team-surprise/teamSurpriseController.js';
export * from '../services/team-surprise/teamSurpriseService.js';
export * from '../services/team-surprise/teamSurpriseTypes.js';
export { checkShieldBeforeAttack } from '../ui/team-surprise/teamSurpriseUI.js';

// === AICP MODULE FOOTER ===
// aicp_category: module
// ai_origin: features/team-surprise/teamSurpriseController.js
// ai_role: Refactoring Stub
// codex_phase: tier3_components_injection
// export_bridge: features/team-surprise
// exports: *
// linked_files: ["features/team-surprise/teamSurpriseController.js", "services/team-surprise/teamSurpriseService.js", "features/team-surprise/teamSurpriseEvents.js", "services/team-surprise/teamSurpriseTypes.js", "ui/team-surprise/teamSurpriseUI.js"]
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: none
// === END AICP MODULE FOOTER ===
