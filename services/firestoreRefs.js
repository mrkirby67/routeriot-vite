// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/firestoreRefs.js
// PURPOSE: Centralizes all Firestore database references for the application.
// DEPENDS_ON: https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../modules/config.js
// USED_BY: services/gameStateService.js, services/teamService.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP SERVICE HEADER ===

/*
 * @file Centralizes all Firestore database references for the application.
 * This module provides a single source of truth for database paths, making it easier
 * to manage and update references.
 */

import { doc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../modules/config.js";

/* Centralized Firestore reference helpers. */
export const refs = {
  gameState:        () => doc(db, 'game', 'gameState'),
  messages:         (teamA, teamB) => collection(db, 'messages', [teamA, teamB].sort().join('_')),
  teamSurprises:    () => collection(db, 'teamSurprises'),
  flatTireAssign:   () => collection(db, 'flatTireAssignments'),
  bugStrikeAssign:  () => collection(db, 'bugStrikeAssignments'),
  speedBumpAssign:  () => collection(db, 'speedBumpAssignments'),
  teams:            () => collection(db, 'teams'),
  zones:            () => collection(db, 'zones'),
};
/* Reference to the main game state document. */
export const gameStateRef = doc(db, "gameState", "currentState");

/* Reference to the 'teams' collection. */
export const teamsCollectionRef = collection(db, "teams");

/*
 * Get a reference to a specific team document.
 * @param {string} teamId - The ID of the team.
 * @returns {import("firebase/firestore").DocumentReference}
 */
export const getTeamRef = (teamId) => doc(db, "teams", teamId);

/* Reference to the 'zones' collection. */
export const zonesCollectionRef = collection(db, "zones");

// === AICP SERVICE FOOTER ===
// ai_origin: services/firestoreRefs.js
// ai_role: Data Layer
// aicp_category: service
// aicp_version: 3.0
// codex_phase: tier1_services_injection
// export_bridge: features/*
// exports: refs, gameStateRef, teamsCollectionRef, getTeamRef, zonesCollectionRef
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier1_services_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP SERVICE FOOTER ===
