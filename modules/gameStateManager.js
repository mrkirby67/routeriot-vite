// ============================================================================
// MODULE: gameStateManager.js (FULLY SYNCED + PLAYER TIMER FIX + STANDARDIZED)
// Purpose: Centralized Firestore game state + pause/resume logic
// Firestore structure:
//   game/gameState → { status, zonesReleased, startTime, endTime, ... }
//   teamStatus/{teamName} → { lastKnownLocation, timestamp, score, ... }
// ============================================================================

import { db } from './config.js';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  collection,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  showCountdownBanner,
  showFlashMessage,
  startCountdownTimer,
  clearElapsedTimer,
} from './gameUI.js';
import { handleStatusChange } from './gameTimer.js';

let cachedGameState = null;

function publishStateDiagnostics(state) {
  if (!state) return;
  cachedGameState = state;
  const timerState = typeof window !== 'undefined' ? window.__rrTimerState || {} : {};
  const diag = {
    timerActive: !!timerState.active,
    pausedAt: timerState.pausedAt ?? null,
    remainingMs: state.remainingMs ?? timerState.remainingMs ?? null,
  };
  if (typeof window !== 'undefined') {
    window.__rrGameState = state;
  }
  try {
    console.log('[STATE]', state.status, diag);
  } catch {
    /* no-op logging safeguard */
  }
}

function handleWaitingState() {
  clearElapsedTimer?.();
  showFlashMessage?.('Waiting for host...', '#616161');
  countdownShown = false;
  console.debug('[GameState]', 'waiting', { remainingMs: null, endTime: null });
  return { status: 'waiting', remainingMs: null, endTime: null };
}

function computeEndMs({ startTime, endTime, durationMinutes, remainingMs }) {
  let endMs = normalizeTimestamp(endTime);
  if (!Number.isFinite(endMs) && Number.isFinite(durationMinutes)) {
    const startMs = normalizeTimestamp(startTime);
    if (Number.isFinite(startMs)) {
      endMs = startMs + durationMinutes * 60_000;
    }
  }
  if (!Number.isFinite(endMs) && typeof remainingMs === 'number') {
    endMs = Date.now() + remainingMs;
  }
  return Number.isFinite(endMs) ? endMs : null;
}

function handleActiveState(snapshotData) {
  if (!countdownShown) {
    countdownShown = true;
    showCountdownBanner?.({ parent: document.body });
    showFlashMessage?.('🏁 The Race is ON!', '#2e7d32');
  }

  const endMs = computeEndMs(snapshotData);
  if (endMs) {
    startCountdownTimer?.(endMs);
  } else {
    clearElapsedTimer?.();
    console.warn('⚠️ No valid end time for countdown.');
  }

  const remaining = endMs ? Math.max(0, endMs - Date.now()) : null;
  console.debug('[GameState]', 'active', { remainingMs: remaining, endTime: endMs });
  return { status: 'active', remainingMs: remaining, endTime: endMs };
}

function handlePausedState(snapshotData) {
  clearElapsedTimer?.();
  showFlashMessage?.('⏸️ Game paused by host.', '#ff9800', 2500);
  const remaining = typeof snapshotData?.remainingMs === 'number'
    ? Math.max(0, snapshotData.remainingMs)
    : null;
  console.debug('[GameState]', 'paused', { remainingMs: remaining, endTime: null });
  return { status: 'paused', remainingMs: remaining, endTime: null };
}

function handleOverState(status) {
  clearElapsedTimer?.();
  showFlashMessage?.('🏁 Game Over! Return to base.', '#c62828', 4000);
  console.debug('[GameState]', status, { remainingMs: null, endTime: null });
  return { status, remainingMs: null, endTime: null };
}

export function getCachedGameState() {
  return cachedGameState;
}

function normalizeTimestamp(ts) {
  if (ts && typeof ts.toMillis === 'function') {
    const millis = ts.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (ts instanceof Date) {
    const millis = ts.getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return ts;
  }
  return null;
}

export function deriveRemainingMs(snapshotData) {
  const endTimeMs = normalizeTimestamp(snapshotData?.endTime);
  if (!Number.isFinite(endTimeMs)) return 0;
  const diff = endTimeMs - Date.now();
  return diff > 0 ? diff : 0;
}

const gameStateRef = doc(db, "game", "gameState");
let countdownShown = false;
const gameStateListeners = new Set();
let lastKnownStatus = null;

// ---------------------------------------------------------------------------
// 🔹 Initialize / Set Game State
// ---------------------------------------------------------------------------
export async function setGameStatus(status, zonesReleased = false, durationMinutes = 60) {
  try {
    const now = Date.now();
    const payload = {
      status,
      zonesReleased,
      updatedAt: serverTimestamp(),
    };

    if (status === 'active') {
      payload.startTime = Timestamp.fromMillis(now);
      payload.endTime = Timestamp.fromMillis(now + durationMinutes * 60 * 1000);
      payload.durationMinutes = durationMinutes;
      payload.remainingMs = null;
    } else if (status === 'finished' || status === 'ended' || status === 'over') {
      payload.endTime = serverTimestamp();
      payload.remainingMs = null;
    }

    await setDoc(gameStateRef, payload, { merge: true });
    console.log(`✅ Game state set to "${status}"`);
  } catch (err) {
    console.error("❌ Error setting game status:", err);
  }
}

// ---------------------------------------------------------------------------
// ▶️ Start Game (centralized entry point)
// ---------------------------------------------------------------------------
export async function startGame(options = {}) {
  const {
    durationMinutes = 120,
    zonesReleased = true,
    teamNames = [],
    broadcast = {}
  } = options || {};

  try {
    const snap = await getDoc(gameStateRef);
    const existing = snap.exists() ? snap.data() || {} : {};
    const currentStatus = String(existing.status || 'waiting').toLowerCase();

    if (currentStatus === 'active') {
      throw new Error('Game already active');
    }

    if (teamNames.length) {
      const activeTeamsRef = doc(db, 'game', 'activeTeams');
      await setDoc(activeTeamsRef, { list: teamNames.slice().sort() }, { merge: true });
    }

    const now = Date.now();
    const startTime = Timestamp.fromMillis(now);
    const endTime = Timestamp.fromMillis(now + Math.max(1, durationMinutes) * 60 * 1000);

    await setDoc(gameStateRef, {
      status: 'active',
      startTime,
      endTime,
      durationMinutes,
      zonesReleased,
      remainingMs: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const { message, teamName, sender, senderDisplay, isBroadcast } = broadcast || {};
    if (message) {
      const communicationsRef = collection(db, 'communications');
      await addDoc(communicationsRef, {
        teamName: teamName || sender || 'Game Master',
        sender: sender || teamName || 'Game Master',
        senderDisplay: senderDisplay || sender || teamName || 'Game Master',
        message,
        isBroadcast: typeof isBroadcast === 'boolean' ? isBroadcast : true,
        timestamp: serverTimestamp(),
      });
    }

    publishStateDiagnostics({
      ...(existing || {}),
      status: 'active',
      startTime,
      endTime,
      durationMinutes,
      zonesReleased,
      remainingMs: null,
    });

    console.log(`🏁 Game started for ${durationMinutes} minute(s)`);
    return { status: 'active', startTime, endTime, durationMinutes };
  } catch (err) {
    console.error('❌ Error starting game:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// ⏸️ Pause Game (saves remaining time)
// ---------------------------------------------------------------------------
export async function pauseGame() {
  try {
    const snap = await getDoc(gameStateRef);
    if (!snap.exists()) throw new Error("Game state not found");
    const data = snap.data();
    const currentStatus = cachedGameState?.status || data.status;
    if (currentStatus && currentStatus !== 'active') {
      console.warn(`pauseGame() skipped — current status is "${currentStatus}"`);
    }

    let remainingMs = deriveRemainingMs(data);
    if (!Number.isFinite(remainingMs) || remainingMs < 0) remainingMs = 0;
    remainingMs = Math.round(remainingMs);

    await updateDoc(gameStateRef, {
      status: 'paused',
      remainingMs,
      endTime: null,
      updatedAt: serverTimestamp(),
    });

    console.log(`⏸️ Game paused (${Math.floor(remainingMs / 1000)}s remaining)`);
    publishStateDiagnostics({
      ...(cachedGameState || {}),
      status: 'paused',
      remainingMs,
      endTime: null,
    });
  } catch (err) {
    console.error("❌ Error pausing game:", err);
  }
}

// ---------------------------------------------------------------------------
// ▶️ Resume Game (rebuilds endTime from remainingMs)
// ---------------------------------------------------------------------------
export async function resumeGame() {
  try {
    const snap = await getDoc(gameStateRef);
    if (!snap.exists()) throw new Error("Game state not found");
    const data = snap.data();

    let remainingMs = deriveRemainingMs(data);
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      const stored = typeof data.remainingMs === 'number' ? data.remainingMs : null;
      if (Number.isFinite(stored) && stored > 0) {
        remainingMs = stored;
      }
    }
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      console.warn('resumeGame() aborted — no remaining time detected. Use start to launch a new game.');
      return;
    }
    remainingMs = Math.round(remainingMs);
    const minimumResumeWindow = 1_000;
    if (remainingMs < minimumResumeWindow) {
      remainingMs = minimumResumeWindow;
    }
    const resumeMarker = serverTimestamp();
    const newEndTime = Timestamp.fromMillis(Date.now() + remainingMs);

    await updateDoc(gameStateRef, {
      status: 'active',
      resumedAt: resumeMarker,
      endTime: newEndTime,
      remainingMs: null,
      updatedAt: resumeMarker,
    });

    console.log(`▶️ Game resumed (ends at ${newEndTime.toDate().toLocaleTimeString()})`);
    publishStateDiagnostics({
      ...(cachedGameState || {}),
      status: 'active',
      endTime: newEndTime,
      remainingMs: null,
    });
  } catch (err) {
    console.error("❌ Error resuming game:", err);
  }
}

// ---------------------------------------------------------------------------
// 🌍 Release Zones
// ---------------------------------------------------------------------------
export async function releaseZones() {
  try {
    await updateDoc(gameStateRef, {
      zonesReleased: true,
      updatedAt: serverTimestamp(),
    });
    console.log("✅ Zones released!");
  } catch (err) {
    console.error("❌ Error releasing zones:", err);
  }
}

// ---------------------------------------------------------------------------
// 🧠 Local handler: UI + timer reactions
// ---------------------------------------------------------------------------
function handleGameStateUpdate({
  status = 'waiting',
  zonesReleased = false,
  startTime = null,
  endTime = null,
  durationMinutes = null,
  remainingMs = null,
}) {
  const statusEl = document.getElementById('game-status');
  if (statusEl) statusEl.textContent = status.toUpperCase();

  window.zonesEnabled = status === 'active' && zonesReleased;

  switch (status) {
    case 'waiting':
      return handleWaitingState();
    case 'active':
      return handleActiveState({ startTime, endTime, durationMinutes, remainingMs });
    case 'paused':
      return handlePausedState({ remainingMs });
    case 'finished':
    case 'ended':
    case 'over':
      return handleOverState(status);
    default:
      console.warn(`⚠️ Unknown status "${status}"`);
      clearElapsedTimer?.();
      console.debug('[GameState]', 'unknown', { status, remainingMs: null, endTime: null });
      return { status, remainingMs: null, endTime: null };
  }
}

// ---------------------------------------------------------------------------
// 📡 Real-time Firestore Listener (Control + Player)
// ---------------------------------------------------------------------------
export function listenForGameStatus(callback) {
  const unsub = onSnapshot(gameStateRef, (docSnap) => {
    const fallbackState = {
      status: 'waiting',
      zonesReleased: false,
      startTime: null,
      endTime: null,
      durationMinutes: null,
      remainingMs: null,
    };

    if (!docSnap.exists()) {
      if (lastKnownStatus !== fallbackState.status) {
        try {
          handleStatusChange?.(lastKnownStatus, fallbackState.status, fallbackState);
        } catch (err) {
          console.warn('[GameState] handleStatusChange failed for default state:', err);
        }
        lastKnownStatus = fallbackState.status;
      }
      handleGameStateUpdate(fallbackState);
      publishStateDiagnostics(fallbackState);
      callback?.(fallbackState);
      return;
    }

    const data = docSnap.data();
    const nextStatus = data?.status || 'waiting';

    if (lastKnownStatus !== nextStatus) {
      try {
        handleStatusChange?.(lastKnownStatus, nextStatus, data);
      } catch (err) {
        console.warn('[GameState] handleStatusChange failed for snapshot:', err);
      }
      if (typeof window !== 'undefined' && lastKnownStatus === 'paused' && nextStatus === 'active') {
        try {
          window.dispatchEvent?.(new Event('gameResumed'));
        } catch (err) {
          console.warn('[GameState] Failed to emit gameResumed event:', err);
        }
      }
      lastKnownStatus = nextStatus;
    }

    const state = {
      status: nextStatus,
      zonesReleased: !!data.zonesReleased,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      durationMinutes: data.durationMinutes || null,
      remainingMs: data.remainingMs || null,
    };

    handleGameStateUpdate(state);
    publishStateDiagnostics(state);
    callback?.(state);
  });
  gameStateListeners.add(unsub);
  console.info('📡 [gameState] attached status listener');
  return (reason = 'manual') => {
    if (gameStateListeners.delete(unsub)) {
      try {
        unsub();
        console.info(`🧹 [gameState] detached status listener (${reason})`);
      } catch (err) {
        console.warn('⚠️ [gameState] failed to detach listener:', err);
      }
    }
  };
}

export function clearGameStatusListeners(reason = 'manual') {
  if (!gameStateListeners.size) return;
  console.info(`🧹 [gameState] detaching ${gameStateListeners.size} listener(s) (${reason})`);
  for (const unsub of Array.from(gameStateListeners)) {
    try {
      unsub();
    } catch (err) {
      console.warn('⚠️ [gameState] failed to detach listener:', err);
    }
  }
  gameStateListeners.clear();
}

// ---------------------------------------------------------------------------
// 🔁 Reset Game State (Admin only)
// ---------------------------------------------------------------------------
export async function resetGameState() {
  const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const { db } = await import("./config.js");

  const stateRef = doc(db, "game", "gameState");
  const defaultState = {
    status: "idle",
    startTime: null,
    endTime: null,
    paused: false,
    countdownShown: false,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(stateRef, defaultState, { merge: true });
    console.log("🕹️ Game state reset to default.");
  } catch (err) {
    console.error("❌ Error resetting game state:", err);
  }
}

// ---------------------------------------------------------------------------
// 🪐 Per-Team Sync Hook (future use)
// ---------------------------------------------------------------------------
export async function updateTeamState(teamName, data = {}) {
  if (!teamName) return;
  try {
    const ref = doc(db, "teamStatus", teamName);
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn(`⚠️ Could not update teamState for ${teamName}:`, err);
  }
}

export const __testHooks = { normalizeTimestamp, handleActiveState };
