// ============================================================================
// MODULE: gameStateManager.js
// Purpose: Centralized Firestore game state (pause/resume + synced timer)
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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  showCountdownBanner,
  showFlashMessage,
  startCountdownTimer,
  clearElapsedTimer,
} from './gameUI.js';

const gameStateRef = doc(db, "game", "gameState");
let countdownShown = false;

// ---------------------------------------------------------------------------
// 🔹 Set Game Status (start / finish / waiting)
// ---------------------------------------------------------------------------
export async function setGameStatus(status, zonesReleased = false, durationMinutes = 60) {
  try {
    const base = {
      status,
      zonesReleased,
      updatedAt: serverTimestamp(),
    };

    if (status === 'active') {
      const startTimestamp = Timestamp.now();
      const endTimestamp = Timestamp.fromMillis(Date.now() + durationMinutes * 60 * 1000);

      base.startTime = startTimestamp;
      base.endTime = endTimestamp;
      base.durationMinutes = durationMinutes;
      base.remainingMs = null;
    }

    if (status === 'finished' || status === 'ended') {
      base.endTime = serverTimestamp();
      base.remainingMs = null;
    }

    await setDoc(gameStateRef, base, { merge: true });
    console.log(`✅ Game status set to "${status}"`);
  } catch (err) {
    console.error("❌ Error setting game status:", err);
  }
}

// ---------------------------------------------------------------------------
// 🔹 Pause the Game — saves remaining time
// ---------------------------------------------------------------------------
export async function pauseGame() {
  try {
    const snap = await getDoc(gameStateRef);
    if (!snap.exists()) throw new Error("Game state not found");
    const data = snap.data();
    if (!data.endTime) throw new Error("No end time set");

    const endTimeMs = data.endTime.toMillis?.() ?? data.endTime.getTime?.();
    const remainingMs = endTimeMs - Date.now();

    await updateDoc(gameStateRef, {
      status: 'paused',
      remainingMs,
      updatedAt: serverTimestamp(),
    });

    console.log(`⏸️ Game paused with ${Math.floor(remainingMs / 1000)}s remaining`);
  } catch (err) {
    console.error("❌ Error pausing game:", err);
  }
}

// ---------------------------------------------------------------------------
// 🔹 Resume the Game — recalculates new end time
// ---------------------------------------------------------------------------
export async function resumeGame() {
  try {
    const snap = await getDoc(gameStateRef);
    if (!snap.exists()) throw new Error("Game state not found");
    const data = snap.data();
    if (!data.remainingMs) throw new Error("No remaining time recorded");

    const newEndTime = Timestamp.fromMillis(Date.now() + data.remainingMs);

    await updateDoc(gameStateRef, {
      status: 'active',
      endTime: newEndTime,
      remainingMs: null,
      updatedAt: serverTimestamp(),
    });

    console.log("▶️ Game resumed!");
  } catch (err) {
    console.error("❌ Error resuming game:", err);
  }
}

// ---------------------------------------------------------------------------
// 🔹 Release Zones Mid-Game
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
// 🔹 Handle UI Feedback + Timer Integration
// ---------------------------------------------------------------------------
function handleGameStateUpdate({
  status = 'waiting',
  zonesReleased = false,
  startTime = null,
  endTime = null,
  durationMinutes = null,
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

    case 'active':
      if (!countdownShown) {
        countdownShown = true;
        showCountdownBanner?.({ parent: document.body });
        showFlashMessage?.('🏁 The Race is ON!', '#2e7d32');
      }

      if (endTime?.toMillis) {
        // ✅ This ensures *both Control and Player* pages display timer correctly
        const endMs = endTime.toMillis();
        startCountdownTimer?.(endMs);
      } else if (durationMinutes && startTime?.toMillis) {
        const startMs = startTime.toMillis();
        const endMs = startMs + durationMinutes * 60 * 1000;
        startCountdownTimer?.(endMs);
      }
      break;

    case 'paused':
      clearElapsedTimer?.();
      showFlashMessage?.('⏸️ Game paused by host.', '#ff9800', 3000);
      break;

    case 'finished':
    case 'ended':
      clearElapsedTimer?.();
      showFlashMessage?.('🏁 Game Over! Return to base.', '#c62828', 4000);
      break;

    default:
      console.warn(`⚠️ Unknown status: ${status}`);
  }
}

// ---------------------------------------------------------------------------
// 🔹 Listen for Live Game State Changes (Players + Control)
// ---------------------------------------------------------------------------
export function listenForGameStatus(callback) {
  return onSnapshot(gameStateRef, (docSnap) => {
    if (!docSnap.exists()) {
      console.warn("⚠️ No game state yet; initializing default.");
      const defaultState = {
        status: 'waiting',
        zonesReleased: false,
        startTime: null,
        endTime: null,
        durationMinutes: null,
      };
      handleGameStateUpdate(defaultState);
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
    callback?.(state);
  });
}

// ---------------------------------------------------------------------------
// 🔹 Reset Game State (Admin)
// ---------------------------------------------------------------------------
export async function resetGameState() {
  try {
    await setDoc(gameStateRef, {
      status: 'waiting',
      zonesReleased: false,
      startTime: null,
      endTime: null,
      durationMinutes: null,
      remainingMs: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log("🧹 Game state reset.");
  } catch (err) {
    console.error("❌ Error resetting game state:", err);
  }
}