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
// === AICP-METADATA === (sanitized)
// aicp_category: sanitized placeholder
// exports: sanitized placeholder
// linked_files: sanitized placeholder
// status: sanitized placeholder
// ai_origin:
//   primary: sanitized placeholder
//   secondary: sanitized placeholder
// sync_state: sanitized placeholder
// === END ===
// // // // // # === AI-CONTEXT-MAP === (commented out) (commented out) (commented out) (commented out) (commented out)
// phase: // /*// /*// /*// /*// /*{{phase}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// aicp_category: // /*// /*// /*// /*// /*{{category}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// exports: // /*// /*// /*// /*// /*{{exports}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// linked_files: // /*// /*// /*// /*// /*{{linked_files}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// status: // /*// /*// /*// /*// /*{{status}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// ai_origin:
// sanitized metadata line
//   secondary: // /*// /*// /*// /*// /*{{secondary_ai}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// sync_state: // /*// /*// /*// /*// /*{{sync_state}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// // // // // # === END === (commented out) (commented out) (commented out) (commented out) (commented out)
