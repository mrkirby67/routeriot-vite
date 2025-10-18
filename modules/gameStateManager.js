// ============================================================================
// GAME STATE MANAGER (FINAL MERGED BUILD)
// Controls and syncs the global game lifecycle (start, end, release zones)
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
  startElapsedTimer,
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
        status, // "waiting" | "active" | "finished"
        zonesReleased,
        updatedAt: serverTimestamp(),
        ...(status === 'active' && { startTime: serverTimestamp(), endTime: null }),
        ...(status === 'finished' && { endTime: serverTimestamp() }),
      },
      { merge: true }
    );
    console.log(`✅ Game status updated to "${status}"`);
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
// 🔹 Listen for Game State Changes (real-time, drives UI updates)
// ---------------------------------------------------------------------------
function handleGameStateUpdate({ status = 'waiting', zonesReleased = false, startTime = null }) {
  const statusEl = document.getElementById('game-status');
  if (statusEl) statusEl.textContent = status.toUpperCase();

  // Make zones globally toggleable for other modules
  window.zonesEnabled = (status === 'active' && !!zonesReleased);

  switch (status) {
    case 'waiting':
      clearElapsedTimer();
      showFlashMessage('Waiting for host to start...', '#616161');
      countdownShown = false;
      break;

    case 'active':
      if (window.zonesEnabled && !countdownShown) {
        countdownShown = true;
        showCountdownBanner({ parent: document.body });
        showFlashMessage('The Race is ON!', '#2e7d32');
      }
      if (startTime) startElapsedTimer(startTime);
      break;

    case 'finished': // match Control naming
      clearElapsedTimer();
      showFlashMessage('🏁 Game Over! Return to base.', '#c62828', 4000);
      break;

    default:
      console.warn(`⚠️ Unknown game status: ${status}`);
      break;
  }
}

export function listenForGameStatus(callback) {
  return onSnapshot(gameStateRef, (docSnap) => {
    const gameState = docSnap.exists() ? docSnap.data() : {};
    handleGameStateUpdate(gameState);
    if (callback) callback(gameState); // optional hook for Control page
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