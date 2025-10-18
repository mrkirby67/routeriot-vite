// ============================================================================
// GAME STATE MANAGER
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

// Reference to the single game state document
const gameStateRef = doc(db, "game", "gameState");

// ---------------------------------------------------------------------------
// 🔹 Set Game Status
// ---------------------------------------------------------------------------
export async function setGameStatus(status, zonesReleased = false) {
  try {
    await setDoc(
      gameStateRef,
      {
        status,            // "waiting" | "active" | "ended"
        zonesReleased,     // true if zones can be captured
        updatedAt: serverTimestamp(),
        ...(status === 'active' && { startTime: serverTimestamp(), endTime: null }),
        ...(status === 'ended' && { endTime: serverTimestamp() }),
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
// 🔹 Listen for Game State Changes (real-time)
// ---------------------------------------------------------------------------
// callback receives: { status, zonesReleased, startTime, endTime, updatedAt }
export function listenForGameStatus(callback) {
  return onSnapshot(gameStateRef, (docSnap) => {
    if (!docSnap.exists()) {
      console.warn("⚠️ No game state found yet.");
      // Provide a default state to the callback if nothing exists
      callback({ status: 'waiting', zonesReleased: false, startTime: null, endTime: null });
      return;
    }
    const data = docSnap.data();
    callback({
      status: data.status || 'waiting',
      zonesReleased: data.zonesReleased || false,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      updatedAt: data.updatedAt || null,
    });
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
      { merge: true } // Use merge to avoid overwriting other potential fields
    );
    console.log("🧹 Game state reset to waiting.");
  } catch (err) {
    console.error("❌ Error resetting game state:", err);
  }
}

