// ============================================================================
// MODULE: chirpCooldown.js
// PURPOSE: Enforce a per-team chirp cooldown (2 minutes)
// STORAGE: in-memory Map + localStorage fallback
// ============================================================================

const CHIRP_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const memoryStore = new Map();

function storageKey(team) {
  return `chirp:last:${team}`;
}

export function lastChirpAt(team) {
  if (!team) return 0;
  const trimmed = String(team).trim();
  if (!trimmed) return 0;

  if (memoryStore.has(trimmed)) {
    const value = memoryStore.get(trimmed);
    if (typeof value === 'number') return value;
  }

  try {
    const raw = localStorage.getItem(storageKey(trimmed));
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      memoryStore.set(trimmed, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn('⚠️ chirpCooldown localStorage read failed:', err);
  }

  return 0;
}

export function canChirp(team, now = Date.now()) {
  return now - lastChirpAt(team) >= CHIRP_COOLDOWN_MS;
}

export function chirpRemainingMs(team, now = Date.now()) {
  const remaining = CHIRP_COOLDOWN_MS - (now - lastChirpAt(team));
  return remaining > 0 ? remaining : 0;
}

export function markChirp(team, when = Date.now()) {
  if (!team) return;
  const trimmed = String(team).trim();
  if (!trimmed) return;
  memoryStore.set(trimmed, when);
  try {
    localStorage.setItem(storageKey(trimmed), String(when));
  } catch (err) {
    console.warn('⚠️ chirpCooldown localStorage write failed:', err);
  }
}

export const CHIRP_COOLDOWN_MS_CONST = CHIRP_COOLDOWN_MS;
