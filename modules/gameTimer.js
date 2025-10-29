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
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let timerInterval = null;
let currentEndTime = null;
let currentRemainingMs = null;
let lastPausedAt = null;

function publishTimerState() {
  if (typeof window === 'undefined') return;
  window.__rrTimerState = {
    active: !!timerInterval,
    endTime: currentEndTime,
    remainingMs: currentRemainingMs,
    pausedAt: lastPausedAt,
    updatedAt: Date.now(),
  };
}
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

function deriveRemainingMs(snapshotData) {
  const explicit = typeof snapshotData?.remainingMs === 'number'
    ? Math.max(0, snapshotData.remainingMs)
    : null;
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const endTimeMs = normalizeTimestamp(snapshotData?.endTime);
  if (Number.isFinite(endTimeMs)) {
    const diff = endTimeMs - Date.now();
    return diff > 0 ? diff : 0;
  }
  if (snapshotData?.startTime && snapshotData?.durationMinutes) {
    const startMs = normalizeTimestamp(snapshotData.startTime);
    if (Number.isFinite(startMs)) {
      const computed = startMs + snapshotData.durationMinutes * 60_000 - Date.now();
      return computed > 0 ? computed : 0;
    }
  }
  return 0;
}

function updateTimerDisplay(remainingMs, display = getTimerDisplay()) {
  if (!display) return;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    display.textContent = '00:00:00';
    return;
  }
  display.textContent = formatTime(remainingMs);
}

// ---------------------------------------------------------------------------
// 🕒 Draw the remaining time continuously
// ---------------------------------------------------------------------------
function getTimerDisplay(selector) {
  if (selector) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return document.getElementById('timer-display') ||
    document.getElementById('control-timer-display');
}

function startCountdownTimer(endMs, displaySelector) {
  const display = getTimerDisplay(displaySelector);
  if (!display || !endMs) return;

  clearElapsedTimer();
  currentEndTime = endMs;
  lastPausedAt = null;
  publishTimerState();

  const update = () => {
    const remaining = endMs - Date.now();
    currentRemainingMs = remaining;
    publishTimerState();
    if (remaining <= 0) {
      updateTimerDisplay(0, display);
      clearElapsedTimer();
      currentRemainingMs = 0;
      publishTimerState();
      return;
    }
    updateTimerDisplay(remaining, display);
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
  currentEndTime = null;
  currentRemainingMs = null;
  publishTimerState();
}

// ---------------------------------------------------------------------------
// ⏸️ Pause Game Timer (Control-side)
// ---------------------------------------------------------------------------
export async function pauseGameTimer() {
  try {
    const ref = doc(db, 'game', 'gameState');
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("No gameState document found.");

    const data = snap.data();
    const now = Date.now();

    // Safely compute remaining time
    let remainingMs = 0;
    if (data.endTime?.toMillis) {
      remainingMs = Math.max(data.endTime.toMillis() - now, 0);
    } else if (currentRemainingMs != null) {
      remainingMs = Math.max(currentRemainingMs, 0);
    }

    await updateDoc(ref, {
      status: 'paused',
      remainingMs,
      endTime: null,
      updatedAt: serverTimestamp()
    });

    clearElapsedTimer();
    currentRemainingMs = remainingMs;
    currentEndTime = null;
    lastPausedAt = Date.now();
    publishTimerState();
    console.log(`⏸️ Paused with ${Math.floor(remainingMs / 1000)}s left`);
  } catch (err) {
    console.error('❌ pauseGameTimer error:', err);
  }
}

// ---------------------------------------------------------------------------
// ▶️ Resume Game Timer (Control-side)
// ---------------------------------------------------------------------------
export async function resumeGameTimer() {
  try {
    const ref = doc(db, 'game', 'gameState');
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("No gameState document found.");

    const data = snap.data();
    const now = Date.now();
    const remainingMs = data.remainingMs ?? currentRemainingMs ?? 0;
    const newEndTime = Timestamp.fromMillis(now + remainingMs);

    await updateDoc(ref, {
      status: 'active',
      endTime: newEndTime,
      remainingMs: null,
      updatedAt: serverTimestamp()
    });

    currentEndTime = newEndTime.toMillis();
    currentRemainingMs = remainingMs;
    lastPausedAt = null;
    publishTimerState();
    console.log(`▶️ Resumed — new endTime = ${newEndTime.toDate().toLocaleTimeString()}`);
  } catch (err) {
    console.error('❌ resumeGameTimer error:', err);
  }
}

function rebuildTimer(snapshotData) {
  const remainingMs = deriveRemainingMs(snapshotData);
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    console.warn('[GameTimer] No remaining time detected while rebuilding timer.');
    clearElapsedTimer();
    return;
  }

  const display = getTimerDisplay();
  const endMs = Date.now() + remainingMs;

  updateTimerDisplay(remainingMs, display);
  startCountdownTimer(endMs);

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent?.(new CustomEvent('overlay:resume', {
        detail: { remainingMs, resumedAt: Date.now() }
      }));
    } catch (err) {
      console.warn('[GameTimer] Failed to emit overlay resume event:', err);
    }
  }
}

export function handleStatusChange(prevStatus, newStatus, snapshotData) {
  if (prevStatus === 'paused' && newStatus === 'active') {
    console.debug('[GameTimer] Resuming countdown...');
    rebuildTimer(snapshotData);
  }
}

// ---------------------------------------------------------------------------
// 📡 Live Sync for All Clients (Control + Player)
// ---------------------------------------------------------------------------
export function listenToGameTimer() {
  const display = getTimerDisplay();
  if (!display) {
    console.warn('⏱️ Timer display not found — skipping listener init.');
    return;
  }

  const ref = doc(db, 'game', 'gameState');

  onSnapshot(ref, (snap) => {
    const data = snap.data();
    if (!data) return;

    const { status, endTime, startTime, durationMinutes, remainingMs } = data;
    let endMs = null;

    // Compute valid end timestamp
    if (endTime?.toMillis) {
      endMs = endTime.toMillis();
    } else if (startTime?.toMillis && durationMinutes) {
      endMs = startTime.toMillis() + durationMinutes * 60_000;
    } else if (remainingMs) {
      endMs = Date.now() + remainingMs;
    }

    switch (status) {
      case 'active':
        lastPausedAt = null;
        if (endMs) startCountdownTimer(endMs);
        else {
          clearElapsedTimer();
          currentRemainingMs = typeof remainingMs === 'number' ? remainingMs : null;
          currentEndTime = null;
          display.textContent = '--:--:--';
          publishTimerState();
        }
        break;

      case 'paused':
        clearElapsedTimer();
        currentRemainingMs = typeof remainingMs === 'number' ? remainingMs : null;
        currentEndTime = null;
        lastPausedAt = Date.now();
        display.textContent = currentRemainingMs != null ? formatTime(currentRemainingMs) : '--:--:--';
        publishTimerState();
        break;

      case 'waiting':
        clearElapsedTimer();
        currentRemainingMs = null;
        currentEndTime = null;
        lastPausedAt = null;
        display.textContent = '--:--:--';
        publishTimerState();
        break;

      case 'finished':
      case 'ended':
      case 'over':
        clearElapsedTimer();
        currentRemainingMs = 0;
        currentEndTime = null;
        lastPausedAt = null;
        display.textContent = '00:00:00';
        publishTimerState();
        break;

      default:
        clearElapsedTimer();
        currentRemainingMs = null;
        currentEndTime = null;
        lastPausedAt = null;
        display.textContent = '--:--:--';
        publishTimerState();
    }

    if (display.id === 'control-timer-display') {
      display.hidden = status === 'waiting';
    }
  });
}
