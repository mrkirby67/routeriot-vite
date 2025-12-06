// ============================================================================
// MODULE: gameStateManager.js (FULLY SYNCED + PLAYER TIMER FIX + STANDARDIZED)
// Purpose: Centralized Firestore game state + pause/resume logic
// Firestore structure:
//   game/gameState → { status, zonesReleased, startTime, endTime, ... }
//   teamStatus/{teamName} → { lastKnownLocation, timestamp, score, ... }
// ============================================================================

import { db } from '/core/config.js';
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
} from './gameUI.js';
import {
  startCountdownTimer,
  pauseCountdownTimer,
  resumeCountdownTimer,
  clearCountdownTimer,
  getRemainingMs,
} from './gameTimer.js';
import { buildRosterSnapshotForGame } from '../services/game/gameRosterService.js';

let cachedGameState = null;
const ALLOWED_STATUSES = new Set(['waiting', 'active', 'paused', 'finished', 'ended', 'over', 'idle']);

function sanitizeStatus(rawStatus) {
  const normalized = typeof rawStatus === 'string'
    ? rawStatus.trim().toLowerCase().replace(/:/g, '')
    : '';
  return ALLOWED_STATUSES.has(normalized) ? normalized : 'waiting';
}

function publishStateDiagnostics(state) {
  if (!state) return;
  cachedGameState = state;
  const timerState = typeof window !== 'undefined' ? window.__rrTimerState || {} : {};
  const diag = {
    timerActive: !!timerState.active,
    pausedAt: timerState.pausedAt ?? null,
    remainingMs: state.remainingMs ?? timerState.remainingMs ?? null,
    pausedRemainingMs: state.pausedRemainingMs ?? null,
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
  clearCountdownTimer();
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

async function endGameByTimer() {
  try {
    const snap = await getDoc(gameStateRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== 'active') return; // Only end active games

    const cleanupModule = await import('./controlActions.js');
    const { safelyEndGameAndResetZones } = cleanupModule;
    if (typeof safelyEndGameAndResetZones === 'function') {
      await safelyEndGameAndResetZones({ markStatusOver: true, source: 'timer' });
    } else {
      await updateDoc(gameStateRef, {
        status: 'over',
        updatedAt: serverTimestamp(),
      });
    }
    console.log('🏁 Game Over (timer expired)');
  } catch (err) {
    console.error("❌ Error ending game by timer:", err);
    try {
      await updateDoc(gameStateRef, {
        status: 'over',
        updatedAt: serverTimestamp(),
      });
    } catch (fallbackError) {
      console.error('❌ Fallback status update failed after timer expiry:', fallbackError);
    }
  }
}

function handleActiveState(snapshotData = {}) {
  const { previousStatus } = snapshotData;
  const resumedFromPause = previousStatus === 'paused';
  const pausedRemainingMs = Number.isFinite(snapshotData?.pausedRemainingMs)
    ? Math.max(0, snapshotData.pausedRemainingMs)
    : null;
  const endMs = computeEndMs(snapshotData);
  const durationMs = Number.isFinite(endMs) ? Math.max(0, endMs - Date.now()) : null;

  let remaining = 0;
  if (resumedFromPause) {
    remaining = resumeCountdownTimer(pausedRemainingMs, null, endGameByTimer);
    if (remaining > 0) {
      showFlashMessage?.('Game resumed ▶️', '#2e7d32', 2500);
    }
  }

  if (!remaining && Number.isFinite(durationMs)) {
    remaining = startCountdownTimer(durationMs, null, endGameByTimer);
    if (!countdownShown) {
      showCountdownBanner?.({ parent: document.body });
      showFlashMessage?.('🏁 The Race is ON!', '#2e7d32');
    } else if (!resumedFromPause) {
      showFlashMessage?.('Game resumed ▶️', '#2e7d32', 2500);
    }
  }

  if (!remaining && !Number.isFinite(durationMs)) {
    clearCountdownTimer(false);
    console.warn('⚠️ No valid end time for countdown.');
  }

  countdownShown = true;
  if (!remaining && Number.isFinite(durationMs)) {
    remaining = durationMs;
  }

  console.debug('[GameState]', 'active', { remainingMs: remaining, endTime: endMs });
  return { status: 'active', remainingMs: remaining, endTime: endMs };
}

function handlePausedState(snapshotData) {
  const localRemaining = pauseCountdownTimer();
  const fallback = Number.isFinite(snapshotData?.pausedRemainingMs)
    ? snapshotData.pausedRemainingMs
    : snapshotData?.remainingMs;
  const remaining = Number.isFinite(localRemaining) && localRemaining > 0
    ? localRemaining
    : (Number.isFinite(fallback) ? Math.max(0, fallback) : null);
  showFlashMessage?.('Game paused ⏸️', '#ff9800', 2500);
  console.debug('[GameState]', 'paused', { remainingMs: remaining, endTime: null });
  return { status: 'paused', remainingMs: remaining, endTime: null };
}

function handleOverState(status) {
  clearCountdownTimer();
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
      status: typeof status === 'string' ? status.trim().replace(/:/g, '') : status,
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
    broadcast = {},
    gameId: providedGameId
  } = options || {};
  const gameId = typeof providedGameId === 'string' && providedGameId.trim()
    ? providedGameId.trim()
    : 'global';

  try {
    const snap = await getDoc(gameStateRef);
    const existing = snap.exists() ? snap.data() || {} : {};
    const currentStatus = String(existing.status || 'waiting').toLowerCase();
    const endMs = normalizeTimestamp(existing.endTime);
    const remainingMs = Number(existing.remainingMs);
    const expired =
      (Number.isFinite(remainingMs) && remainingMs <= 0) ||
      (Number.isFinite(endMs) && endMs <= Date.now());

    if (currentStatus === 'active' && !expired) {
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

    try {
      await buildRosterSnapshotForGame(gameId);
    } catch (err) {
      console.warn('[GameState] Failed to capture roster snapshot:', err);
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

    let remainingMs = pauseCountdownTimer();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      remainingMs = deriveRemainingMs(data);
    }
    remainingMs = Math.max(0, Math.round(remainingMs));

    await updateDoc(gameStateRef, {
      status: 'paused',
      pausedRemainingMs: remainingMs,
      remainingMs,
      endTime: null,
      updatedAt: serverTimestamp(),
    });

    console.log(`⏸️ Game paused (${Math.floor(remainingMs / 1000)}s remaining)`);
    publishStateDiagnostics({
      ...(cachedGameState || {}),
      status: 'paused',
      remainingMs,
      pausedRemainingMs: remainingMs,
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

    let remainingMs = Number.isFinite(data.pausedRemainingMs)
      ? data.pausedRemainingMs
      : data.remainingMs;
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      remainingMs = deriveRemainingMs(data);
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
    
    const resumeStamp = serverTimestamp();
    const newEndTime = Timestamp.fromMillis(Date.now() + remainingMs);

    await updateDoc(gameStateRef, {
      status: 'active',
      resumedAt: resumeStamp,
      endTime: newEndTime,
      remainingMs: null,
      pausedRemainingMs: null,
      updatedAt: resumeStamp,
    });

    const resumed = resumeCountdownTimer(remainingMs, null, endGameByTimer);
    if (!resumed) startCountdownTimer(remainingMs, null, endGameByTimer);

    console.log(`▶️ Game resumed (ends at ${newEndTime.toDate().toLocaleTimeString()})`);
    publishStateDiagnostics({
      ...(cachedGameState || {}),
      status: 'active',
      endTime: newEndTime,
      remainingMs: null,
      pausedRemainingMs: null,
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
function handleGameStateUpdate(state = {}, previousStatus = null) {
  const {
    status,
    zonesReleased = false,
    startTime = null,
    endTime = null,
    durationMinutes = null,
    remainingMs = null,
    pausedRemainingMs = null,
  } = state || {};

  const normalizedStatus = typeof status === 'string' ? status : null;
  if (!normalizedStatus) {
    console.warn('[GameState] Ignoring update without a valid status', state);
    clearCountdownTimer();
    return { status: 'waiting', remainingMs: null, endTime: null };
  }

  const statusEl = document.getElementById('game-status');
  if (statusEl) statusEl.textContent = normalizedStatus.toUpperCase();

  window.zonesEnabled = normalizedStatus === 'active' && zonesReleased;

  switch (normalizedStatus) {
    case 'waiting':
      return handleWaitingState();
    case 'active':
      return handleActiveState({ startTime, endTime, durationMinutes, remainingMs, pausedRemainingMs, previousStatus });
    case 'paused':
      return handlePausedState({ remainingMs, pausedRemainingMs, previousStatus });
    case 'finished':
    case 'ended':
    case 'over':
      return handleOverState(normalizedStatus);
    default:
      console.warn(`⚠️ Unknown status "${normalizedStatus}"`);
      clearCountdownTimer();
      console.debug('[GameState]', 'unknown', { status: normalizedStatus, remainingMs: null, endTime: null });
      return { status: normalizedStatus, remainingMs: null, endTime: null };
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
      pausedRemainingMs: null,
    };

    if (!docSnap.exists()) {
      clearCountdownTimer();
      let derived = null;
      try {
        derived = handleGameStateUpdate(fallbackState, lastKnownStatus);
      } catch (err) {
        console.error('handleGameStateUpdate error', err);
      }
      publishStateDiagnostics(derived || fallbackState);
      callback?.(fallbackState);
      lastKnownStatus = fallbackState.status;
      return;
    }

    const data = docSnap.data() || {};
    const nextStatus = sanitizeStatus(data.status);
    const previousStatus = lastKnownStatus;

    const state = {
      ...data,
      status: nextStatus,
      zonesReleased: !!data.zonesReleased,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      durationMinutes: data.durationMinutes || null,
      remainingMs: data.remainingMs ?? null,
      pausedRemainingMs: data.pausedRemainingMs ?? null,
    };

    let derived = null;
    try {
      derived = handleGameStateUpdate(state, previousStatus);
    } catch (err) {
      console.error('handleGameStateUpdate error', err);
    }
    publishStateDiagnostics(derived || state);
    callback?.(state);

    if (typeof window !== 'undefined' && previousStatus === 'paused' && nextStatus === 'active') {
      try {
        window.dispatchEvent?.(new Event('gameResumed'));
      } catch (err) {
        console.warn('[GameState] Failed to emit gameResumed event:', err);
      }
    }

    lastKnownStatus = nextStatus;
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
  const { db } = await import("/core/config.js");

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
