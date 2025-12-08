// ============================================================================
// FILE: modules/zoneManager.js
// PURPOSE: Shared helpers for zone metadata (display names, caching)
// ============================================================================

import { db } from '/core/config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const zoneNameCache = new Map();
const activeCooldowns = new Map(); // key(zoneId::team) -> expiresAt (ms)
const cooldownTimers = new Map(); // key -> timeout id

function normalizeZoneId(zoneId) {
  if (typeof zoneId !== 'string') return '';
  return zoneId.trim();
}

function cooldownKey(zoneId, teamName) {
  const z = (zoneId || '').trim();
  const t = (teamName || 'GLOBAL').trim() || 'GLOBAL';
  return `${z}::${t}`;
}

/*
 * Resolve a zone identifier to its human-friendly display name.
 * Falls back to the raw identifier if the zone cannot be found.
 */
export async function getZoneDisplayName(zoneId) {
  const normalized = normalizeZoneId(zoneId);
  if (!normalized) return zoneId ?? '';

  if (zoneNameCache.has(normalized)) {
    return zoneNameCache.get(normalized);
  }

  try {
    const ref = doc(db, 'zones', normalized);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() || {};
      const label = data.displayName || data.name || normalized;
      zoneNameCache.set(normalized, label);
      return label;
    }
  } catch (err) {
    console.warn('⚠️ Zone name lookup failed for', normalized, err);
  }

  zoneNameCache.set(normalized, normalized);
  return normalized;
}

function toMillis(input) {
  if (!input) return null;
  if (typeof input === 'number') return input;
  if (typeof input === 'string') {
    const num = Number(input);
    return Number.isFinite(num) ? num : null;
  }
  if (typeof input.toMillis === 'function') return input.toMillis();
  if (input.seconds) return input.seconds * 1000 + Math.floor((input.nanoseconds || 0) / 1e6);
  return null;
}

function scheduleCooldownCleanup(key, expiresAt) {
  if (!key || !Number.isFinite(expiresAt)) return;
  const msRemaining = expiresAt - Date.now();
  if (msRemaining <= 0) {
    cooldownTimers.get(key)?.();
    cooldownTimers.delete(key);
    activeCooldowns.delete(key);
    return;
  }
  cooldownTimers.get(key)?.();
  const timeoutId = setTimeout(() => {
    cooldownTimers.delete(key);
    const expiry = activeCooldowns.get(key);
    if (expiry && expiry <= Date.now()) {
      activeCooldowns.delete(key);
    }
  }, msRemaining + 25);
  cooldownTimers.set(key, () => clearTimeout(timeoutId));
}

export function hydrateZoneCooldown(zoneId, expiresAt, teamName) {
  const normalized = normalizeZoneId(zoneId);
  const expiry = toMillis(expiresAt);
  if (!normalized || !expiry) return;
  const key = cooldownKey(normalized, teamName);
  if (expiry <= Date.now()) {
    activeCooldowns.delete(key);
    cooldownTimers.get(key)?.();
    cooldownTimers.delete(key);
    return;
  }
  activeCooldowns.set(key, expiry);
  scheduleCooldownCleanup(key, expiry);
}

export async function startZoneCooldown(zoneId, minutes = 15, teamName, { persist = true } = {}) {
  const normalized = normalizeZoneId(zoneId);
  const duration = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  if (!normalized || duration <= 0) return null;

  const expiresAt = Date.now() + duration * 60 * 1000;
  const key = cooldownKey(normalized, teamName);
  activeCooldowns.set(key, expiresAt);
  scheduleCooldownCleanup(key, expiresAt);
  console.log(`⏳ Cooldown started for ${normalized} (${duration} min) [team=${teamName || 'GLOBAL'}]`);

  if (persist && !teamName) {
    try {
      await setDoc(
        doc(db, 'zones', normalized),
        {
          cooldownUntil: expiresAt,
          cooldownMinutes: duration
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('⚠️ Failed to persist cooldown for', normalized, err);
    }
  }

  return expiresAt;
}

export function isZoneOnCooldown(zoneId, teamName) {
  const normalized = normalizeZoneId(zoneId);
  if (!normalized) return false;
  const key = cooldownKey(normalized, teamName);
  const expiresAt = activeCooldowns.get(key);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    activeCooldowns.delete(key);
    cooldownTimers.get(key)?.();
    cooldownTimers.delete(key);
    return false;
  }
  return true;
}

export function getZoneCooldownRemaining(zoneId, teamName) {
  const normalized = normalizeZoneId(zoneId);
  if (!normalized) return 0;
  const key = cooldownKey(normalized, teamName);
  const expiresAt = activeCooldowns.get(key);
  if (!expiresAt) return 0;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    activeCooldowns.delete(key);
    cooldownTimers.get(key)?.();
    cooldownTimers.delete(key);
    return 0;
  }
  return remaining;
}

export async function clearZoneCooldown(zoneId, teamName, { persist = true } = {}) {
  const normalized = normalizeZoneId(zoneId);
  if (!normalized) return;
  const key = cooldownKey(normalized, teamName);
  activeCooldowns.delete(key);
  cooldownTimers.get(key)?.();
  cooldownTimers.delete(key);
  if (persist && !teamName) {
    try {
      await setDoc(
        doc(db, 'zones', normalized),
        {
          cooldownUntil: null
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('⚠️ Failed to clear cooldown for', normalized, err);
    }
  }
}
