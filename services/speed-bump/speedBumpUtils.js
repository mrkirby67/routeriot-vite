// Utility helpers for Speed Bump service (pure functions only).
// These are internal to the speed-bump service and should not change behavior.

export function makeDocId(gameId, attackerId, victimId) {
  if (victimId) return `${gameId}__${attackerId}__${victimId}`;
  return `${gameId}__${attackerId}`;
}

export function assertNonEmpty(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing or invalid ${fieldName}.`);
  }
}

export function normalizeTeamId(id) {
  return typeof id === 'string' ? id.trim().toLowerCase() : '';
}

export function normalizeStatus(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return v || null;
}

export function toMillis(value) {
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  return null;
}
