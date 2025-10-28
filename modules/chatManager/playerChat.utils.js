// ============================================================================
// FILE: modules/chatManager/playerChat.utils.js
// PURPOSE: Helper utilities for Player Chat modules
// ============================================================================

/**
 * Extracts a count value from an object using multiple possible key names.
 */
export function extractSurpriseCount(counts = {}, ...keys) {
  for (const key of keys) {
    if (key in counts) {
      const value = Number(counts[key]);
      if (Number.isFinite(value) && value >= 0) {
        return value;
      }
    }
  }
  return 0;
}

/**
 * Converts seconds into a formatted mm:ss or Xm Ys display.
 */
export function formatShieldDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder
    ? `${minutes}m ${remainder.toString().padStart(2, '0')}s`
    : `${minutes}m`;
}

/**
 * Converts Firestore shield duration (in ms) into whole minutes.
 */
export function getShieldDurationMinutes(getShieldDurationMs) {
  const durationMs = getShieldDurationMs();
  const minutes = Math.round(durationMs / 60000);
  return Math.max(1, minutes || 0);
}

/**
 * Simple debounce helper to limit rapid function calls.
 */
export function debounce(fn, delay = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Escapes HTML in user-generated text to prevent XSS.
 */
export function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}