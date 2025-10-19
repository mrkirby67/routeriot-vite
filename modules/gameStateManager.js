// ============================================================================
// GAME STATE MANAGER (FINAL SAFE + UI MERGE)
// Controls and syncs the global game lifecycle (start, release, end, listen)
// ============================================================================

import { db } from './config.js';
import {
  doc,
  setDoc,
  onSnapshot,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  showCountdownBanner,
  showFlashMessage,
  startCountdownTimer, // <-- IMPORT THE CORRECT COUNTDOWN TIMER
  clearElapsedTimer
} from './gameUI.js';

// ---------------------------------------------------------------------------
// 🔗 Firestore Reference
// ---------------------------------------------------------------------------
const gameStateRef = doc(db, "game", "gameState");
let countdownShown = false;

// ---------------------------------------------------------------------------
// 🔹 Set Game Status
// ---------------------------------------------------------------------------
export async function setGameStatus(status, zonesReleased = false) {
  try {
    await setDoc(
      gameStateRef,
      {
        status, // "waiting" | "active" | "ended" | "finished" | "paused"
        zonesReleased,
        updatedAt: serverTimestamp(),
        ...(status === 'active'   && { startTime: serverTimestamp(), endTime: null }),
        ...(status === 'ended'    && { endTime: serverTimestamp() }),
        ...(status === 'finished' && { endTime: serverTimestamp() }),
      },
      { merge: true }
    );
    console.log(`✅ Game status updated to "${status}" (zonesReleased=${zonesReleased})`);
  } catch (err) {
    console.error("❌ Error updating game status:", err);
  }
}

// ---------------------------------------------------------------------------
// 🔹 Release Zones (mid-game unlock)
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
// 🔹 Handle UI + State Change
// ---------------------------------------------------------------------------
function handleGameStateUpdate({
  status = 'waiting',
  zonesReleased = false,
  startTime = null,
  endTime = null
}) {
  const statusEl = document.getElementById('game-status');
  if (statusEl) statusEl.textContent = status.toUpperCase();

  // Share across modules
  window.zonesEnabled = (status === 'active' && !!zonesReleased);

  switch (status) {
    case 'waiting':
      clearElapsedTimer?.();
      showFlashMessage?.('Waiting for host to start...', '#616161');
      countdownShown = false;
      break;

    case 'active':
      if (window.zonesEnabled && !countdownShown) {
        countdownShown = true;
        showCountdownBanner?.({ parent: document.body });
        showFlashMessage?.('The Race is ON!', '#2e7d32');
      }
      // --- THIS IS THE FIX: Use the countdown timer if endTime exists ---
      if (endTime) {
        startCountdownTimer?.(endTime);
      } else if (startTime) {
        // Fallback to count-up if only startTime is available
        startElapsedTimer?.(startTime);
      }
      break;

    case 'ended':
    case 'finished':
      clearElapsedTimer?.();
      showFlashMessage?.('🏁 Game Over! Return to base.', '#c62828', 4000);
      break;

    case 'paused':
      showFlashMessage?.('Game paused by host.', '#ff9800');
      clearElapsedTimer?.(); // Also clear the timer on pause
      break;

    default:
      console.warn(`⚠️ Unknown game status: ${status}`);
      break;
  }
}

// ---------------------------------------------------------------------------
// 🔹 Listen for Game State Changes (real-time)
// ---------------------------------------------------------------------------
export function listenForGameStatus(callback) {
  return onSnapshot(gameStateRef, (docSnap) => {
    if (!docSnap.exists()) {
      console.warn("⚠️ No game state yet — defaulting to waiting.");
      const defaultState = {
        status: 'waiting',
        zonesReleased: false,
        startTime: null,
        endTime: null,
        updatedAt: null,
      };
      handleGameStateUpdate(defaultState);
      callback?.(defaultState);
      return;
    }

    const data = docSnap.data() || {};
    const gameState = {
      status: data.status || 'waiting',
      zonesReleased: !!data.zonesReleased,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      updatedAt: data.updatedAt || null,
    };

    handleGameStateUpdate(gameState);
    callback?.(gameState);
  });
}

// ---------------------------------------------------------------------------
// 🔹 Get Current Game State (one-time read)
// ---------------------------------------------------------------------------
export async function getCurrentGameState() {
  try {
    const snap = await getDoc(gameStateRef);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("❌ Error fetching current game state:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 🔹 Reset Game State (optional admin tool)
// ---------------------------------------------------------------------------
export async function resetGameState() {
  try {
    await setDoc(
      gameStateRef,
      {
        status: 'waiting',
        zonesReleased: false,
        startTime: null,
        endTime: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log("🧹 Game state reset to waiting.");
  } catch (err) {
    console.error("❌ Error resetting game state:", err);
  }
}

