// ============================================================================
// MODULE: gameTimer.js
// PURPOSE: Unified countdown lifecycle with pause / resume support
// NOTE: Pure timer utilities — no Firestore side-effects here
// ============================================================================

let timerId = null;
let endTime = null;
let remainingMs = 0;
let tickHandler = null;
let endHandler = null;

function formatTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '00:00:00';
  }
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

function updateDisplay(text) {
  const ids = ['control-timer-display', 'timer-display', 'player-timer'];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
  });
}

function publishTimerState() {
  if (typeof window === 'undefined') return;
  window.__rrTimerState = {
    active: timerId != null,
    endTime,
    remainingMs,
    updatedAt: Date.now(),
  };
}

function defaultTick(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    updateDisplay('00:00:00');
  } else {
    updateDisplay(formatTime(ms));
  }
}

function defaultEnd() {
  updateDisplay('00:00:00');
}

function notifyTick() {
  if (!Number.isFinite(endTime)) return;
  const now = Date.now();
  remainingMs = Math.max(0, endTime - now);
  publishTimerState();

  const handler = typeof tickHandler === 'function' ? tickHandler : defaultTick;
  handler(remainingMs);

  if (remainingMs <= 0) {
    clearInterval(timerId);
    timerId = null;
    const endCb = typeof endHandler === 'function' ? endHandler : defaultEnd;
    endCb();
    publishTimerState();
  }
}

export function startCountdownTimer(durationMs, onTick, onEnd) {
  clearCountdownTimer();

  remainingMs = Math.max(0, Number(durationMs) || 0);
  endTime = Date.now() + remainingMs;
  tickHandler = typeof onTick === 'function' ? onTick : null;
  endHandler = typeof onEnd === 'function' ? onEnd : null;

  publishTimerState();
  notifyTick();
  if (remainingMs > 0) {
    timerId = setInterval(notifyTick, 1000);
  }
  return remainingMs;
}

export function pauseCountdownTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (Number.isFinite(endTime)) {
    remainingMs = Math.max(0, endTime - Date.now());
  }
  publishTimerState();
  return remainingMs;
}

export function resumeCountdownTimer(overrideRemainingMs, onTick, onEnd) {
  if (Number.isFinite(overrideRemainingMs) && overrideRemainingMs > 0) {
    remainingMs = overrideRemainingMs;
  }
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 0;
  }

  if (typeof onTick === 'function') tickHandler = onTick;
  if (typeof onEnd === 'function') endHandler = onEnd;

  endTime = Date.now() + remainingMs;
  publishTimerState();
  notifyTick();
  if (remainingMs > 0) {
    timerId = setInterval(notifyTick, 1000);
  }
  return remainingMs;
}

export function clearCountdownTimer(resetDisplay = true) {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  endTime = null;
  remainingMs = 0;
  tickHandler = null;
  endHandler = null;
  publishTimerState();
  if (resetDisplay) {
    updateDisplay('--:--:--');
  }
}

export function getRemainingMs() {
  return remainingMs;
}

export function getEndTime() {
  return endTime;
}

export function isTimerRunning() {
  return timerId != null;
}
