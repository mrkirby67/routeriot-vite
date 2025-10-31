// ============================================================================
// FILE: features/player-page/playerPageController.js
// PURPOSE: Controller for the main player page.
// DEPENDS_ON: ../../components/OpponentList/OpponentList.js, ../chat/playerChat.state.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 1.0
// ============================================================================

// features/player-page/playerPageController.js

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

// # === AI-CONTEXT-MAP ===
// phase: tier2_features_injection
// aicp_category: feature
// exports: initializePlayerPage
// linked_files: []
// status: stable
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// sync_state: aligned
// # === END ===
