// ============================================================================
// FILE: services/gameStateService.js
// PURPOSE: Manages core game state logic, such as pausing, resuming, and resetting the game.
// DEPENDS_ON: firebase/firestore, ./firestoreRefs.js
// USED_BY: features/game-state/gameStateController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 1.0
// ============================================================================

/**
 * @file Manages core game state logic, such as pausing, resuming, and resetting the game.
 * This service will interact with Firestore to update and listen for game state changes.
 */

import { doc, updateDoc, getDoc } from "firebase/firestore";
import { gameStateRef } from "./firestoreRefs.js";

/**
 * Pauses the game.
 * This function will be moved from modules/gameStateManager.js
 */
export async function pauseGame() {
  console.log("Pausing game...");
  // Logic to update game state to "paused" in Firestore.
  await updateDoc(gameStateRef, { status: "paused" });
}

/**
 * Resumes the game.
 * This function will be moved from modules/gameStateManager.js
 */
export async function resumeGame() {
  console.log("Resuming game...");
  // Logic to update game state to "running" in Firestore.
  await updateDoc(gameStateRef, { status: "running" });
}

/**
 * Gets the current game state.
 * @returns {Promise<Object>} The current game state object.
 */
export async function getGameState() {
  const docSnap = await getDoc(gameStateRef);
  return docSnap.exists() ? docSnap.data() : null;
}

// === AI-CONTEXT-MAP ===
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// aicp_category: service
// exports: pauseGame, resumeGame, getGameState
// linked_files: []
// phase: tier1_services_injection
// status: stable
// sync_state: aligned
// === END ===
