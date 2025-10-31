// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/teamService.js
// PURPOSE: Manages team-related data, such as fetching team information and player lists.
// DEPENDS_ON: https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, services/firestoreRefs.js
// USED_BY: components/OpponentList/OpponentList.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP SERVICE HEADER ===

/**
 * @file Manages team-related data, such as fetching team information and player lists.
 */

import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { teamsCollectionRef } from "./firestoreRefs.js";

/**
 * Fetches all teams from Firestore.
 * @returns {Promise<Array>} A list of team objects.
 */
export async function getAllTeams() {
  const snapshot = await getDocs(teamsCollectionRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// === AICP SERVICE FOOTER ===
// ai_origin: services/teamService.js
// ai_role: Data Layer
// aicp_category: service
// aicp_version: 3.0
// codex_phase: tier1_services_injection
// export_bridge: features/*
// exports: getAllTeams
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier1_services_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP SERVICE FOOTER ===
