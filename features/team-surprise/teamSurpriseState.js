// ============================================================================
// Shared state utilities for Team Surprise shield, wild card, and cooldown
// tracking. Extracted from the event module to avoid circular dependencies.
// ============================================================================

import { db } from '/core/config.js';
import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  SurpriseTypes,
  SHIELD_DURATION_STORAGE_KEY,
  DEFAULT_SHIELD_MINUTES,
  DEFAULT_COOLDOWN_MINUTES
} from '/services/team-surprise/teamSurpriseTypes.js';

let shieldStateUnsub = null;

export function initializeShieldStateFromFirestore(teamName) {
  if (shieldStateUnsub) {
    shieldStateUnsub();
  }

  const teamStatusRef = doc(db, "teamStatus", teamName);
  shieldStateUnsub = onSnapshot(teamStatusRef, (docSnap) => {
    const data = docSnap.data() || {};
    const expiresAt = data.shieldExpiresAt ? data.shieldExpiresAt.toMillis() : 0;

    if (expiresAt > Date.now()) {
      activeShields[teamName] = expiresAt;
    } else {
      if (activeShields[teamName]) {
        delete activeShields[teamName];
      }
    }
    emitShieldState();
  });

  return shieldStateUnsub;
}

export const activeShields = Object.create(null);   // { [teamName]: expiresAtMs }
export const activeWildCards = Object.create(null); // { [teamName]: { type, expires } }
export const activeCooldowns = Object.create(null); // { [teamName]: expiresAtMs }
export const activeEffects = Object.create(null);   // { [teamName]: Effect[] }
const teamAttackTimestamps = Object.create(null);   // { [teamName]: lastAttackTimestamp }
let globalCooldownMs = DEFAULT_COOLDOWN_MINUTES * 60 * 1000;
const shieldListeners = new Set();
const effectListeners = new Set(); // [{ callback, team }]
let shieldObserverTeam = null;
let shieldTickerId = null;
const SHIELD_TICK_INTERVAL_MS = 1000;

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

export async function activateShield(teamName, expiresAtMs) {
  if (!teamName) return null;
  const durationMs = getShieldDurationMs();
  const candidate = Number(expiresAtMs);
  const expiresAt = Number.isFinite(candidate) ? candidate : Date.now() + durationMs;
  activeShields[teamName] = expiresAt;

  try {
    await setDoc(doc(db, "teamStatus", teamName), {
      shieldExpiresAt: new Date(expiresAt)
    }, { merge: true });
  } catch (err) {
    console.error(`[teamSurpriseState] Failed to write shield status for ${teamName}:`, err);
  }

  console.log(`🛡️ Shield active for ${teamName} until ${new Date(expiresAt).toLocaleTimeString()}`);
  emitShieldState();
  return expiresAt;
}

export function isShieldActive(teamName) {
  if (!teamName) return false;
  const expiresAt = activeShields[teamName];
  if (!expiresAt) return false;

  if (expiresAt <= Date.now()) {
    deactivateShield(teamName); // This will handle both local and firestore updates
    return false;
  }
  return true;
}

export async function deactivateShield(teamName) {
  if (!teamName) return;
  delete activeShields[teamName];

  try {
    await setDoc(doc(db, "teamStatus", teamName), {
      shieldExpiresAt: null
    }, { merge: true });
  } catch (err) {
    console.error(`[teamSurpriseState] Failed to write shield deactivation for ${teamName}:`, err);
  }

  emitShieldState();
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
  if (typeof window === 'undefined' || !window?.localStorage) return DEFAULT_COOLDOWN_MINUTES * 60 * 1000;
  const savedDuration = window.localStorage.getItem('cooldownDuration');
  const parsed = Number.parseInt(savedDuration, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_COOLDOWN_MINUTES * 60 * 1000;
  return parsed * 60 * 1000;
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
  for (const key of Object.keys(teamAttackTimestamps)) delete teamAttackTimestamps[key];
  emitShieldState();
}

export function recordTeamAttackTimestamp(teamName, timestamp = Date.now()) {
  const normalized = typeof teamName === 'string' ? teamName.trim() : '';
  if (!normalized) return 0;
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return 0;
  teamAttackTimestamps[normalized] = value;
  return value;
}

export function getLastTeamAttackTimestamp(teamName) {
  const normalized = typeof teamName === 'string' ? teamName.trim() : '';
  if (!normalized) return 0;
  const value = teamAttackTimestamps[normalized];
  return Number.isFinite(value) ? value : 0;
}

export function setGlobalCooldownMs(nextValue) {
  const numeric = Number(nextValue);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return globalCooldownMs;
  }
  globalCooldownMs = numeric;
  return globalCooldownMs;
}

export function getGlobalCooldown() {
  return globalCooldownMs;
}

export function setShieldObserverTeam(teamName) {
  const normalized = typeof teamName === 'string' ? teamName.trim() : '';
  shieldObserverTeam = normalized || null;
  emitShieldState();
}

export function getShieldState(teamName = shieldObserverTeam) {
  const normalized = typeof teamName === 'string' ? teamName.trim() : '';
  if (!normalized) {
    return { active: false, remainingMs: 0 };
  }
  const remainingMs = getShieldTimeRemaining(normalized);
  return { active: remainingMs > 0, remainingMs: Math.max(0, remainingMs) };
}

export function onShieldStateChange(callback) {
  if (typeof callback !== 'function') return () => {};
  shieldListeners.add(callback);
  try {
    callback(getShieldState());
  } catch (err) {
    console.warn('⚠️ shield listener failed on initial emit:', err);
  }
  return () => {
    shieldListeners.delete(callback);
    if (!shieldListeners.size) {
      stopShieldTicker();
    }
  };
}

function emitShieldState(forcedState) {
  if (!shieldListeners.size) return;
  const state = forcedState || getShieldState();
  for (const listener of Array.from(shieldListeners)) {
    try {
      listener(state);
    } catch (err) {
      console.warn('⚠️ shield listener error:', err);
    }
  }
  if (state.active) {
    ensureShieldTicker();
  } else {
    stopShieldTicker();
  }
}

function ensureShieldTicker() {
  if (shieldTickerId || !shieldListeners.size) return;
  shieldTickerId = setInterval(() => {
    emitShieldState();
  }, SHIELD_TICK_INTERVAL_MS);
}

function normalizeTeam(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed;
}

function cloneEffect(effect) {
  if (!effect || typeof effect !== 'object') return null;
  const clone = { ...effect };
  if (effect.contactInfo && typeof effect.contactInfo === 'object') {
    clone.contactInfo = { ...effect.contactInfo };
  }
  return clone;
}

function emitActiveEffectsChange(teamName) {
  if (!effectListeners.size) return;
  for (const listener of effectListeners) {
    try {
      const targetTeam = listener.team;
      if (targetTeam) {
        if (teamName && targetTeam !== teamName) continue;
        listener.callback(getActiveEffects(targetTeam));
      } else {
        listener.callback(getActiveEffects());
      }
    } catch (err) {
      console.warn('⚠️ active effect listener error:', err);
    }
  }
}

function syncWildCardForTeam(teamName) {
  const normalized = normalizeTeam(teamName);
  if (!normalized) return;
  const effects = activeEffects[normalized] || [];
  const blocking = effects.find(
    (effect) => effect?.type === 'speedBump' && effect?.status !== 'released'
  );

  if (blocking) {
    const now = Date.now();
    const targetTime = Number(blocking.releaseAvailableAt ?? blocking.expiresAt);
    const remaining = Number.isFinite(targetTime) ? Math.max(0, targetTime - now) : 5 * 60 * 1000;
    const durationMs = Math.max(30_000, remaining || 5 * 60 * 1000);
    startWildCard(normalized, 'speedBump', durationMs);
    return;
  }

  if (activeWildCards[normalized]?.type === 'speedBump') {
    clearWildCard(normalized);
  }
}

export function setTeamActiveEffects(teamName, effects = []) {
  const normalized = normalizeTeam(teamName);
  if (!normalized) return;
  const next = Array.isArray(effects)
    ? effects
        .filter(Boolean)
        .map((entry) => cloneEffect(entry))
    : [];

  if (!next.length) {
    if (activeEffects[normalized]) {
      delete activeEffects[normalized];
      syncWildCardForTeam(normalized);
      emitActiveEffectsChange(normalized);
    }
    return;
  }

  activeEffects[normalized] = next;
  syncWildCardForTeam(normalized);
  emitActiveEffectsChange(normalized);
}

export function clearTeamActiveEffects(teamName) {
  const normalized = normalizeTeam(teamName);
  if (!normalized) return;
  if (activeEffects[normalized]) {
    delete activeEffects[normalized];
    syncWildCardForTeam(normalized);
    emitActiveEffectsChange(normalized);
  }
}

function snapshotActiveEffects() {
  const snapshot = {};
  for (const [teamName, effects] of Object.entries(activeEffects)) {
    snapshot[teamName] = effects.map((effect) => cloneEffect(effect)).filter(Boolean);
  }
  return snapshot;
}

export function getActiveEffects(teamName) {
  const normalized = normalizeTeam(teamName);
  if (!normalized) {
    return snapshotActiveEffects();
  }
  const list = activeEffects[normalized];
  return Array.isArray(list) ? list.map((effect) => cloneEffect(effect)).filter(Boolean) : [];
}

export function onActiveEffectsChange(callback, options = {}) {
  if (typeof callback !== 'function') return () => {};
  const listener = {
    callback,
    team: normalizeTeam(options.team)
  };
  effectListeners.add(listener);
  try {
    callback(getActiveEffects(listener.team));
  } catch (err) {
    console.warn('⚠️ active effect listener failed on initial emit:', err);
  }
  return () => {
    effectListeners.delete(listener);
  };
}

function stopShieldTicker() {
  if (!shieldTickerId) return;
  clearInterval(shieldTickerId);
  shieldTickerId = null;
}
