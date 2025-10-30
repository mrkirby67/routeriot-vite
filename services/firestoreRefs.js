// services/firestoreRefs.js

/**
 * @file Centralizes all Firestore database references for the application.
 * This module provides a single source of truth for database paths, making it easier
 * to manage and update references.
 */

import { doc, collection } from "firebase/firestore";
import { db } from "../modules/config.js";

// TODO: Consolidate all firestore references from across the codebase here.

/** Reference to the main game state document. */
export const gameStateRef = doc(db, "gameState", "currentState");

/** Reference to the 'teams' collection. */
export const teamsCollectionRef = collection(db, "teams");

/**
 * Get a reference to a specific team document.
 * @param {string} teamId - The ID of the team.
 * @returns {import("firebase/firestore").DocumentReference}
 */
export const getTeamRef = (teamId) => doc(db, "teams", teamId);

/** Reference to the 'zones' collection. */
export const zonesCollectionRef = collection(db, "zones");
