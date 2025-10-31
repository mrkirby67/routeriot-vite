// ============================================================================
// FILE: features/game-state/gameStateController.js
// PURPOSE: Handles UI interactions related to game state changes.
// DEPENDS_ON: ../../services/gameStateService.js, ../../ui/gameNotifications.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 1.0
// ============================================================================

// features/game-state/gameStateController.js

/**
 * @file Handles UI interactions related to game state changes.
 * This controller connects UI elements (e.g., pause/resume buttons) to the gameStateService.
 */

import * as gameStateService from "../../services/gameStateService.js";
import * as notifications from "../../ui/gameNotifications.js";

/**
 * Event handler for a "pause game" button click.
 */
export async function handlePauseGame() {
  try {
    await gameStateService.pauseGame();
    notifications.showSuccess("Game paused successfully.");
  } catch (error) {
    notifications.showError("Failed to pause game.");
    console.error(error);
  }
}

/**
 * Event handler for a "resume game" button click.
 */
export async function handleResumeGame() {
  try {
    await gameStateService.resumeGame();
    notifications.showSuccess("Game resumed.");
  } catch (error) {
    notifications.showError("Failed to resume game.");
    console.error(error);
  }
}

// # === AI-CONTEXT-MAP ===
// phase: tier2_features_injection
// aicp_category: feature
// exports: handlePauseGame, handleResumeGame
// linked_files: []
// status: stable
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// sync_state: aligned
// # === END ===
