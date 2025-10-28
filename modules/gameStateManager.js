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

export function getCachedGameState() {
  return cachedGameState;
}

function deriveRemainingMs(snapshotData) {
  const now = Date.now();
  const primary = snapshotData?.remainingMs;
  if (typeof primary === 'number' && primary > 0) return primary;

  const endTime = snapshotData?.endTime;
  if (endTime?.toMillis) {
    const diff = endTime.toMillis() - now;
    if (diff > 0) return diff;
  } else if (typeof endTime === 'number') {
    const diff = endTime - now;
    if (diff > 0) return diff;
  } else if (typeof endTime?.seconds === 'number') {
    const millis = endTime.seconds * 1000 + Math.floor((endTime.nanoseconds || 0) / 1e6);
    const diff = millis - now;
    if (diff > 0) return diff;
  }

  const startTime = snapshotData?.startTime;
  const durationMinutes = snapshotData?.durationMinutes;
  if (typeof durationMinutes === 'number') {
    if (startTime?.toMillis) {
      const diff = startTime.toMillis() + durationMinutes * 60_000 - now;
      if (diff > 0) return diff;
    } else if (typeof startTime?.seconds === 'number') {
      const millis = startTime.seconds * 1000 + Math.floor((startTime.nanoseconds || 0) / 1e6);
      const diff = millis + durationMinutes * 60_000 - now;
      if (diff > 0) return diff;
    }
  }

  if (cachedGameState?.remainingMs && cachedGameState.remainingMs > 0) {
    return cachedGameState.remainingMs;
  }
  return 0;
}

const gameStateRef = doc(db, "game", "gameState");
let countdownShown = false;
const gameStateListeners = new Set();

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
      console.warn('resumeGame() aborted — no remaining time detected. Use start to launch a new game.');
      return;
    }
    remainingMs = Math.round(remainingMs);
    const minimumResumeWindow = 1_000;
    if (remainingMs < minimumResumeWindow) {
      remainingMs = minimumResumeWindow;
    }
    const newEndTime = Timestamp.fromMillis(Date.now() + remainingMs);

    await updateDoc(gameStateRef, {
      status: 'active',
      endTime: newEndTime,
      remainingMs: null,
      updatedAt: serverTimestamp(),
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
      clearElapsedTimer?.();
      showFlashMessage?.('Waiting for host...', '#616161');
      countdownShown = false;
      break;

    case 'active': {
      if (!countdownShown) {
        countdownShown = true;
        showCountdownBanner?.({ parent: document.body });
        showFlashMessage?.('🏁 The Race is ON!', '#2e7d32');
      }

      let endMs = null;
      if (endTime?.toMillis) {
        endMs = endTime.toMillis();
      } else if (startTime?.toMillis && durationMinutes) {
        endMs = startTime.toMillis() + durationMinutes * 60_000;
      } else if (remainingMs) {
        endMs = Date.now() + remainingMs;
      }

      if (endMs) startCountdownTimer?.(endMs);
      else {
        clearElapsedTimer?.();
        console.warn("⚠️ No valid end time for countdown.");
      }
      break;
    }

    case 'paused':
      clearElapsedTimer?.();
      showFlashMessage?.('⏸️ Game paused by host.', '#ff9800', 2500);
      break;

    case 'finished':
    case 'ended':
    case 'over':
      clearElapsedTimer?.();
      showFlashMessage?.('🏁 Game Over! Return to base.', '#c62828', 4000);
      break;

    default:
      console.warn(`⚠️ Unknown status "${status}"`);
      clearElapsedTimer?.();
  }
}

// ---------------------------------------------------------------------------
// 📡 Real-time Firestore Listener (Control + Player)
// ---------------------------------------------------------------------------
export function listenForGameStatus(callback) {
  const unsub = onSnapshot(gameStateRef, (docSnap) => {
    if (!docSnap.exists()) {
      const defaultState = {
        status: 'waiting',
        zonesReleased: false,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        remainingMs: null,
      };
      handleGameStateUpdate(defaultState);
      publishStateDiagnostics(defaultState);
      callback?.(defaultState);
      return;
    }

    const data = docSnap.data();
    const state = {
      status: data.status || 'waiting',
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
