// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/team-surprise/teamSurpriseEvents.js
// PURPOSE: Client-side state helpers for shields, wild cards, and cooldowns.
// DEPENDS_ON: ./teamSurpriseTypes.js
// USED_BY: features/team-surprise/teamSurpriseController.js, ui/team-surprise/teamSurpriseUI.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

import {
  SurpriseTypes,
  SHIELD_DURATION_STORAGE_KEY,
  DEFAULT_SHIELD_MINUTES,
  DEFAULT_COOLDOWN_MINUTES
} from './teamSurpriseTypes.js';

// === BEGIN RECOVERED BLOCK ===
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
// === END RECOVERED BLOCK ===

// === AICP FEATURE FOOTER ===
// aicp_category: feature
// ai_origin: features/team-surprise/teamSurpriseEvents.js
// ai_role: Logic Layer
// codex_phase: tier2_features_injection
// export_bridge: components/*
// exports: activeShields, activeWildCards, activeCooldowns, readShieldDurationMinutes, getShieldDurationMs, activateShield, isShieldActive, deactivateShield, getShieldTimeRemaining, isUnderWildCard, startWildCard, clearWildCard, startCooldown, resetSurpriseCaches
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
