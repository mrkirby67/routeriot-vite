// ============================================================================
// MODULE: gameTimer.js (FULLY SYNCED + STABLE PAUSE/RESUME)
// Purpose: Keeps control + player timers synchronized in real-time via Firestore
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
// 🧭 Format milliseconds into HH:MM:SS
// ---------------------------------------------------------------------------
function formatTime(ms) {
  if (ms == null || isNaN(ms)) return '--:--:--';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 🕒 Draw the remaining time continuously
// ---------------------------------------------------------------------------
function startCountdownTimer(endMs) {
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

  update();
  timerInterval = setInterval(update, 1000);
}

// ---------------------------------------------------------------------------
// 🔹 Clear interval safely
// ---------------------------------------------------------------------------
export function clearElapsedTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ---------------------------------------------------------------------------
// ⏸️ Pause (control-side): saves remainingMs, removes endTime
// ---------------------------------------------------------------------------
export async function pauseGameTimer() {
  try {
    const ref = doc(db, 'game', 'gameState');
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("No gameState doc.");

    const data = snap.data();
    const now = Date.now();
    const endTimeMs = data.endTime?.toMillis?.() ?? data.endTime?.getTime?.();
    const remainingMs = endTimeMs
      ? Math.max(endTimeMs - now, 0)
      : currentRemainingMs ?? 0;

    await updateDoc(ref, {
      status: 'paused',
      remainingMs,
      endTime: null,
      updatedAt: serverTimestamp(),
    });

    clearElapsedTimer();
    console.log(`⏸️ Paused with ${Math.floor(remainingMs / 1000)}s left`);
  } catch (err) {
    console.error('❌ pauseGameTimer error:', err);
  }
}

// ---------------------------------------------------------------------------
// ▶️ Resume (control-side): restores endTime and restarts
// ---------------------------------------------------------------------------
export async function resumeGameTimer() {
  try {
    const ref = doc(db, 'game', 'gameState');
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("No gameState doc.");

    const data = snap.data();
    const now = Date.now();
    const remainingMs = data.remainingMs ?? currentRemainingMs ?? 0;
    const newEndTime = Timestamp.fromMillis(now + remainingMs);

    await updateDoc(ref, {
      status: 'active',
      endTime: newEndTime,
      remainingMs: null,
      updatedAt: serverTimestamp(),
    });

    console.log(`▶️ Resumed — new endTime = ${newEndTime.toDate().toLocaleTimeString()}`);
  } catch (err) {
    console.error('❌ resumeGameTimer error:', err);
  }
}

// ---------------------------------------------------------------------------
// 📡 Live sync for all clients (control + player)
// ---------------------------------------------------------------------------
export function listenToGameTimer() {
  const display = document.getElementById('timer-display');
  if (!display) return;

  const ref = doc(db, 'game', 'gameState');

  onSnapshot(ref, (snap) => {
    const data = snap.data();
    if (!data) return;

    const { status, endTime, startTime, durationMinutes, remainingMs } = data;
    let endMs = null;

    // Resolve a reliable end timestamp
    if (endTime?.toMillis) {
      endMs = endTime.toMillis();
    } else if (startTime?.toMillis && durationMinutes) {
      endMs = startTime.toMillis() + durationMinutes * 60_000;
    } else if (remainingMs) {
      endMs = Date.now() + remainingMs;
    }

    switch (status) {
      case 'active':
        if (endMs) startCountdownTimer(endMs);
        else {
          clearElapsedTimer();
          display.textContent = '--:--:--';
        }
        break;

      case 'paused':
        clearElapsedTimer();
        display.textContent = remainingMs ? formatTime(remainingMs) : '--:--:--';
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
    }
  });
}