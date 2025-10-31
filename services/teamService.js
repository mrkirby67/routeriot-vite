// ============================================================================
// FILE: services/teamService.js
// PURPOSE: Manages team-related data, such as fetching team information and player lists.
// DEPENDS_ON: firebase/firestore, ./firestoreRefs.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 1.0
// ============================================================================

// services/teamService.js

/**
 * @file Manages team-related data, such as fetching team information and player lists.
 */

import { getDocs } from "firebase/firestore";
import { teamsCollectionRef } from "./firestoreRefs.js";

/**
 * Fetches all teams from Firestore.
 * @returns {Promise<Array>} A list of team objects.
 */
export async function getAllTeams() {
  const snapshot = await getDocs(teamsCollectionRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// # === AI-CONTEXT-MAP ===
// phase: tier1_services_injection
// aicp_category: service
// exports: getAllTeams
// linked_files: []
// status: stable
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// sync_state: aligned
// # === END ===
