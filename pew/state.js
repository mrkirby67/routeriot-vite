// ============================================================================
// Pew Pursuit game state listener + Firestore cache.
// Strictly scoped to the gameState_pew/current document.
// ============================================================================

import { db } from '../modules/config.js';
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  EMPTY_GAME_STATE,
  PEW_COLLECTIONS,
  resolveScoringMode,
  ensureVisitedMap,
} from './config.js';

const GAME_STATE_DOC = doc(db, PEW_COLLECTIONS.gameState, 'current');

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

let cachedState = clone(EMPTY_GAME_STATE);
let isBootstrapped = false;

function coerceState(payload) {
  if (!payload) return clone(EMPTY_GAME_STATE);
  return {
    ...EMPTY_GAME_STATE,
    ...payload,
    scoringMode: resolveScoringMode(payload.scoringMode),
    visited: ensureVisitedMap(payload.visited),
  };
}

export function getCachedGameState() {
  return cachedState;
}

export async function initializeGameStateIfNeeded() {
  if (isBootstrapped) return cachedState;
  try {
    const snap = await getDoc(GAME_STATE_DOC);
    if (!snap.exists()) {
      await setDoc(GAME_STATE_DOC, EMPTY_GAME_STATE);
      cachedState = clone(EMPTY_GAME_STATE);
    } else {
      cachedState = coerceState(snap.data());
    }
    isBootstrapped = true;
  } catch (error) {
    console.error('⚠️ Pew Pursuit failed to bootstrap game state.', error);
  }
  return cachedState;
}

export function listenToGameState(callback) {
  const unsub = onSnapshot(
    GAME_STATE_DOC,
    (snapshot) => {
      cachedState = coerceState(snapshot.data());
      callback?.(cachedState);
    },
    (error) => {
      console.error('❌ Pew Pursuit state listener errored.', error);
    },
  );
  return unsub;
}

export async function patchGameState(partial = {}) {
  try {
    await updateDoc(GAME_STATE_DOC, partial);
  } catch (error) {
    console.warn('⚠️ Falling back to merge set for Pew Pursuit state.', error);
    await setDoc(GAME_STATE_DOC, partial, { merge: true });
  }
}

export function setGamePhase(phase, metadata = {}) {
  // TODO: Apply additional validation (phase order, timers, etc.).
  return patchGameState({
    status: phase,
    lastUpdated: Date.now(),
    ...metadata,
  });
}

export function updateVisitedZones(teamName, zoneId) {
  if (!teamName || !zoneId) return Promise.resolve();
  const visited = ensureVisitedMap(cachedState.visited);
  const teamVisits = new Set(visited[teamName] || []);
  teamVisits.add(zoneId);
  return patchGameState({
    visited: {
      ...visited,
      [teamName]: Array.from(teamVisits),
    },
  });
}

// TODO: implement pause/resume timestamp math for countdown tracking.
