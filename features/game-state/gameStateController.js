// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/game-state/gameStateController.js
// PURPOSE: Handles UI interactions related to game state changes.
// DEPENDS_ON: services/gameStateService.js, ui/gameNotifications.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

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

// === AICP FEATURE FOOTER ===
// ai_origin: features/game-state/gameStateController.js
// ai_role: Logic Layer
// aicp_category: feature
// aicp_version: 3.0
// codex_phase: tier2_features_injection
// depends_on: services/*
// export_bridge: components/*
// exports: handlePauseGame, handleResumeGame
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
