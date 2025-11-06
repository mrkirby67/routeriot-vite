// ============================================================================
// Shared state utilities for Team Surprise shield, wild card, and cooldown
// tracking. Extracted from the event module to avoid circular dependencies.
// ============================================================================

import {
  SurpriseTypes,
  SHIELD_DURATION_STORAGE_KEY,
  DEFAULT_SHIELD_MINUTES,
  DEFAULT_COOLDOWN_MINUTES
} from './teamSurpriseTypes.js';

export const activeShields = Object.create(null);   // { [teamName]: expiresAtMs }
export const activeWildCards = Object.create(null); // { [teamName]: { type, expires } }
export const activeCooldowns = Object.create(null); // { [teamName]: expiresAtMs }

export function readShieldDurationMinutes() {
  if (typeof window === 'undefined' || !window?.localStorage) return DEFAULT_SHIELD_MINUTES;
  const parsed = Number.parseInt(window.localStorage.getItem(SHIELD_DURATION_STORAGE_KEY), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SHIELD_MINUTES;
  return Math.min(60, Math.max(1, parsed));
}

export function getShieldDurationMs() {
  const minutes = readShieldDurationMinutes();
  return minutes * 60 * 1000;
}

export function activateShield(teamName, expiresAtMs) {
  if (!teamName) return null;
  const durationMs = getShieldDurationMs();
  const candidate = Number(expiresAtMs);
  const expiresAt = Number.isFinite(candidate) ? candidate : Date.now() + durationMs;
  activeShields[teamName] = expiresAt;
  console.log(`🛡️ Shield active for ${teamName} until ${new Date(expiresAt).toLocaleTimeString()}`);
  return expiresAt;
}

export function isShieldActive(teamName) {
  if (!teamName) return false;
  const expiresAt = activeShields[teamName];
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    delete activeShields[teamName];
    return false;
  }
  return true;
}

export function deactivateShield(teamName) {
  if (!teamName) return;
  delete activeShields[teamName];
}

export function getShieldTimeRemaining(teamName) {
  if (!teamName) return 0;
  const expiresAt = activeShields[teamName];
  if (!expiresAt) return 0;
  if (expiresAt <= Date.now()) {
    delete activeShields[teamName];
    return 0;
  }
  return expiresAt - Date.now();
}

export function isUnderWildCard(team) {
  if (!team) return false;
  const entry = activeWildCards[team];
  if (!entry) return false;
  if (entry.expires <= Date.now()) {
    delete activeWildCards[team];
    return false;
  }
  return true;
}

export function startWildCard(team, type, durationMs) {
  if (!team) return;
  const expires = Date.now() + Math.max(0, Number(durationMs) || 0);
  activeWildCards[team] = { type, expires };
}

export function clearWildCard(team) {
  if (!team) return;
  delete activeWildCards[team];
}

function getCooldownDurationMs() {
  return DEFAULT_COOLDOWN_MINUTES * 60 * 1000;
}

export function startCooldown(team) {
  if (!team) return;
  const ms = getCooldownDurationMs();
  activeCooldowns[team] = Date.now() + Math.max(0, Number(ms) || 0);
}

export function resetSurpriseCaches() {
  for (const key of Object.keys(activeShields)) delete activeShields[key];
  for (const key of Object.keys(activeWildCards)) delete activeWildCards[key];
  for (const key of Object.keys(activeCooldowns)) delete activeCooldowns[key];
}
