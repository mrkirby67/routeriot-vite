// ============================================================================
// MODULE: gameTimer.js (FINAL PAUSE/RESUME ENABLED)
// Purpose: Centralized countdown display for Control screen.
// ============================================================================

import { db } from './config.js';
import { onSnapshot, doc, serverTimestamp, updateDoc, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let timerInterval = null;
let currentEndTime = null;
let currentRemainingMs = null;

// ---------------------------------------------------------------------------
// 🔹 Format milliseconds into HH:MM:SS
// ---------------------------------------------------------------------------
function formatTime(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 🔹 Start countdown timer until a fixed end time
// ---------------------------------------------------------------------------
export function startCountdownTimer(endTime) {
  const display = document.getElementById('timer-display');
  if (!display) return;
  clearElapsedTimer();

  currentEndTime = endTime;

  timerInterval = setInterval(() => {
    const remaining = endTime - Date.now();
    currentRemainingMs = remaining;

    if (remaining <= 0) {
      display.textContent = "00:00:00";
      clearElapsedTimer();
      currentRemainingMs = 0;
      return;
    }

    display.textContent = formatTime(remaining);
  }, 1000);
}

// ---------------------------------------------------------------------------
// 🔹 Start elapsed timer (fallback)
// ---------------------------------------------------------------------------
export function startElapsedTimer(startTime) {
  const display = document.getElementById('timer-display');
  if (!display) return;
  clearElapsedTimer();

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    display.textContent = formatTime(elapsed);
  }, 1000);
}

// ---------------------------------------------------------------------------
// 🔹 Clear timer
// ---------------------------------------------------------------------------
export function clearElapsedTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ---------------------------------------------------------------------------
// 🔹 Pause Game (Control-side) - Saves remainingMs and clears endTime
// ---------------------------------------------------------------------------
export async function pauseGameTimer() {
  try {
    const gameRef = doc(db, 'game', 'gameState');
    const snap = await getDoc(gameRef);
    if (!snap.exists()) throw new Error("No game state document found.");

    const data = snap.data();
    const now = Date.now();
    let remainingMs = data.endTime?.toMillis
      ? data.endTime.toMillis() - now
      : currentRemainingMs;

    await updateDoc(gameRef, {
      status: 'paused',
      remainingMs: remainingMs > 0 ? remainingMs : 0,
      endTime: null,
      updatedAt: serverTimestamp(),
    });

    clearElapsedTimer();
    console.log(`⏸️ Game paused — ${Math.floor(remainingMs / 1000)}s remaining.`);
  } catch (err) {
    console.error('❌ pauseGameTimer error:', err);
  }
}

// ---------------------------------------------------------------------------
// 🔹 Resume Game (Control-side) - Restores endTime from remainingMs
// ---------------------------------------------------------------------------
export async function resumeGameTimer() {
  try {
    const gameRef = doc(db, 'game', 'gameState');
    const snap = await getDoc(gameRef);
    if (!snap.exists()) throw new Error("No game state document found.");
    const data = snap.data();
    const now = Date.now();

    const remainingMs = data.remainingMs ?? currentRemainingMs ?? 0;
    const newEndTime = new Date(now + remainingMs);

    await updateDoc(gameRef, {
      status: 'active',
      endTime: newEndTime,
      remainingMs: null,
      updatedAt: serverTimestamp(),
    });

    console.log('▶️ Game resumed — new endTime:', newEndTime);
  } catch (err) {
    console.error('❌ resumeGameTimer error:', err);
  }
}

// ---------------------------------------------------------------------------
// 🔹 Live listener - reacts to gameState changes
// ---------------------------------------------------------------------------
export function listenToGameTimer() {
  const display = document.getElementById('timer-display');
  if (!display) return;

  const gameRef = doc(db, 'game', 'gameState');

  onSnapshot(gameRef, (docSnap) => {
    const data = docSnap.data();
    if (!data) return;

    if (data.status === 'active' && data.endTime) {
      const endMs = data.endTime.seconds * 1000;
      startCountdownTimer(endMs);
    } 
    else if (data.status === 'paused') {
      clearElapsedTimer();
      if (data.remainingMs !== undefined) {
        display.textContent = formatTime(data.remainingMs);
      } else {
        display.textContent = '--:--:--';
      }
    } 
    else if (data.status === 'waiting') {
      clearElapsedTimer();
      display.textContent = '--:--:--';
    } 
    else if (data.status === 'finished' || data.status === 'ended') {
      clearElapsedTimer();
      display.textContent = '00:00:00';
    }
  });
}