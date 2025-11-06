// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/game-state/gameStateController.js
// PURPOSE: Provides helpers to read, write, and observe the Firestore game state.
// DEPENDS_ON: ../../modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js
// USED_BY: components/GameControls/GameControls.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

// ============================================================================
// PATCH: gameStateController.js — Game State Helpers
// ============================================================================

import { db } from '../../modules/config.js';
import { doc, getDoc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const gameStateRef = doc(db, 'state', 'gameStatus');

export async function getGameStatus() {
  const snap = await getDoc(gameStateRef);
  if (snap.exists()) return snap.data().status;
  return 'idle';
}

export async function setGameStatus(status) {
  await setDoc(gameStateRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
}

export function listenToGameStateUpdates(callback) {
  return onSnapshot(gameStateRef, (snap) => {
    if (snap.exists()) callback(snap.data().status);
  });
}
