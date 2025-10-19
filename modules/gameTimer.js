// ============================================================================
// MODULE: gameTimer.js (FINAL SYNCED + PAUSE/RESUME ENABLED)
// Purpose: Centralized countdown display for Control screen (fully synced)
// ============================================================================
import { db } from './config.js';
import {
  onSnapshot,
  doc,
  serverTimestamp,
  updateDoc,
  getDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let timerInterval = null;
let currentEndTime = null;
let currentRemainingMs = null;

// ---------------------------------------------------------------------------
// 🔹 Format milliseconds into HH:MM:SS
// ---------------------------------------------------------------------------
function formatTime(ms) {
  if (ms == null || isNaN(ms)) return '--:--:--';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 🔹 Start countdown timer until a fixed end time (ms epoch)
// ---------------------------------------------------------------------------
export function startCountdownTimer(endMs) {
  const display = document.getElementById('timer-display');
  if (!display || !endMs) return;

  clearElapsedTimer();
  currentEndTime = endMs;

  const update = () => {
    const remaining = endMs - Date.now();
    currentRemainingMs = remaining;
    if (remaining <= 0) {
      display.textContent = '00:00:00';
      clearElapsedTimer();
      currentRemainingMs = 0;
      return;
    }
    display.textContent = formatTime(remaining);
  };

  update(); // immediate draw
  timerInterval = setInterval(update, 1000);
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
// 🔹 Pause timer manually (Control-side)
// ---------------------------------------------------------------------------
export async function pauseGameTimer() {
  try {
    const gameRef = doc(db, 'game', 'gameState');
    const snap = await getDoc(gameRef);
    if (!snap.exists()) throw new Error("No game state document found.");

    const data = snap.data();
    const now = Date.now();
    const endTimeMs = data.endTime?.toMillis?.() ?? data.endTime?.getTime?.();
    const remainingMs = endTimeMs ? endTimeMs - now : currentRemainingMs ?? 0;

    await updateDoc(gameRef, {
      status: 'paused',
      remainingMs: Math.max(remainingMs, 0),
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
// 🔹 Resume timer (Control-side)
// ---------------------------------------------------------------------------
export async function resumeGameTimer() {
  try {
    const gameRef = doc(db, 'game', 'gameState');
    const snap = await getDoc(gameRef);
    if (!snap.exists()) throw new Error("No game state document found.");

    const data = snap.data();
    const now = Date.now();
    const remainingMs = data.remainingMs ?? currentRemainingMs ?? 0;
    const newEndTime = Timestamp.fromMillis(now + remainingMs);

    await updateDoc(gameRef, {
      status: 'active',
      endTime: newEndTime,
      remainingMs: null,
      updatedAt: serverTimestamp(),
    });

    console.log(`▶️ Game resumed — new endTime: ${newEndTime.toDate().toLocaleTimeString()}`);
  } catch (err) {
    console.error('❌ resumeGameTimer error:', err);
  }
}

// ---------------------------------------------------------------------------
// 🔹 Live listener - Reacts to Firestore updates and updates Control timer
// ---------------------------------------------------------------------------
export function listenToGameTimer() {
  const display = document.getElementById('timer-display');
  if (!display) return;

  const gameRef = doc(db, 'game', 'gameState');

  onSnapshot(gameRef, (docSnap) => {
    const data = docSnap.data();
    if (!data) return;

    const { status, endTime, startTime, durationMinutes, remainingMs } = data;
    if (!status) return;

    switch (status) {
      case 'active': {
        let endMs = null;
        if (endTime?.toMillis) endMs = endTime.toMillis();
        else if (startTime?.toMillis && durationMinutes)
          endMs = startTime.toMillis() + durationMinutes * 60 * 1000;
        else if (remainingMs) endMs = Date.now() + remainingMs;

        if (endMs) startCountdownTimer(endMs);
        else display.textContent = '--:--:--';
        break;
      }

      case 'paused':
        clearElapsedTimer();
        display.textContent = remainingMs
          ? formatTime(remainingMs)
          : '--:--:--';
        break;

      case 'waiting':
        clearElapsedTimer();
        display.textContent = '--:--:--';
        break;

      case 'finished':
      case 'ended':
        clearElapsedTimer();
        display.textContent = '00:00:00';
        break;

      default:
        clearElapsedTimer();
        display.textContent = '--:--:--';
        break;
    }
  });
}