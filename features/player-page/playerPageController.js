// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/player-page/playerPageController.js
// PURPOSE: Controller for the main player page.
// DEPENDS_ON: components/OpponentList/OpponentList.js, features/chat/playerChat.state.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

/**
 * @file Controller for the main player page.
 * It orchestrates the initialization of different UI components and features
 * for the player view.
 */

import { initializeOpponentList } from "../../components/OpponentList/OpponentList.js";
import { initializeChat } from "../chat/playerChat.state.js";

/**
 * Initializes the player page.
 */
export function initializePlayerPage() {
  console.log("Initializing player page...");
  initializeOpponentList();
  initializeChat();
  // Other initialization logic will go here.
}

// === AICP FEATURE FOOTER ===
// ai_origin: features/player-page/playerPageController.js
// ai_role: Logic Layer
// aicp_category: feature
// aicp_version: 3.0
// codex_phase: tier2_features_injection
// depends_on: services/*
// export_bridge: components/*
// exports: initializePlayerPage
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
