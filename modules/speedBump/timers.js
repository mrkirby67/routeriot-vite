// ============================================================================
// TIMERS – proof validation countdowns + auto release
// ============================================================================

import { validationTimers } from './core.js';

// ⏱️ Lazy reference injection to avoid circular import between timers ↔ interactions
let _releaseSpeedBump = null;

/*
 * Registers the release function after interactions.js has loaded.
 * interactions.js should call registerReleaseHandler(releaseSpeedBump)
 */
export function registerReleaseHandler(fn) {
  if (typeof fn === 'function') {
    _releaseSpeedBump = fn;
  } else {
    console.warn('⚠️ Invalid release handler passed to registerReleaseHandler');
  }
}

export function scheduleValidationTimer(teamName, expiresAt) {
  if (!expiresAt) return;

  const remaining = Math.max(0, expiresAt - Date.now());
  const existing = validationTimers.get(teamName);
  if (existing?.timerId) clearTimeout(existing.timerId);

  const timerId = setTimeout(() => {
    validationTimers.delete(teamName);
    if (_releaseSpeedBump) {
      _releaseSpeedBump(teamName, 'Auto Timer');
    } else {
      console.warn('⚠️ releaseSpeedBump not yet registered — skipping auto release for', teamName);
    }
  }, remaining);

  validationTimers.set(teamName, { expiresAt, timerId });
}

export function clearValidationTimer(teamName) {
  const entry = validationTimers.get(teamName);
  if (entry?.timerId) clearTimeout(entry.timerId);
  validationTimers.delete(teamName);
}