// ============================================================================
// FILE: /*file_path*/
// PURPOSE: /*short_description*/
// DEPENDS_ON: /*dependencies*/
// USED_BY: /*consumers*/
// AUTHOR: James Kirby / Route Riot Project
// CREATED: /*date*/
// AICP_VERSION: 1.0
// ============================================================================

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
// === AICP METADATA ===
// AICP phase tag validated
// phase: validated
