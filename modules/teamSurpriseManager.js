// ============================================================================
// FILE: modules/teamSurpriseManager.js
// PURPOSE: Firestore helpers for team surprise counters (Flat Tire, Bug Splat, Super SHIELD Wax)
// ============================================================================

import { db } from './config.js';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const SurpriseTypes = Object.freeze({
  FLAT_TIRE: 'flatTire',
  BUG_SPLAT: 'bugSplat',
  WILD_CARD: 'wildCard'
});

const SHIELD_DURATION_STORAGE_KEY = 'shieldDuration';
const DEFAULT_SHIELD_MINUTES = 15;

function readShieldDurationMinutes() {
  if (typeof window === 'undefined' || !window?.localStorage) return DEFAULT_SHIELD_MINUTES;
  const parsed = Number.parseInt(window.localStorage.getItem(SHIELD_DURATION_STORAGE_KEY), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SHIELD_MINUTES;
  return Math.min(60, Math.max(1, parsed));
}

export function getShieldDurationMs() {
  const minutes = readShieldDurationMinutes();
  return minutes * 60 * 1000;
}

export const activeShields = Object.create(null);

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

const COLLECTION = collection(db, 'teamSurprises');

function teamDocRef(teamName) {
  return doc(COLLECTION, teamName.replace(/[\\/#?]/g, '_'));
}

export function subscribeTeamSurprises(callback) {
  console.log('🧩 Subscribed to team surprises for UI sync…');
  if (typeof window !== 'undefined' && window?.fakeTeamData && typeof callback === 'function') {
    try {
      callback([], window.fakeTeamData);
    } catch (err) {
      console.warn('⚠️ team surprise callback (prefill) failed:', err);
    }
  }
  return onSnapshot(COLLECTION, snapshot => {
    const entries = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      teamName: docSnap.id,
      counts: docSnap.data().counts || {}
    }));
    const byTeam = Object.create(null);
    entries.forEach(entry => {
      byTeam[entry.teamName] = entry.counts || {};
    });
    callback?.(entries, byTeam);
  });
}

export async function incrementSurprise(teamName, type) {
  if (!teamName || !type) return;
  await runTransaction(db, async (tx) => {
    const ref = teamDocRef(teamName);
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : { counts: {} };
    const counts = { ...data.counts };
    counts[type] = Math.max(0, (counts[type] || 0) + 1);
    tx.set(ref, { counts }, { merge: true });
  });
}

export async function decrementSurprise(teamName, type) {
  if (!teamName || !type) return;
  await runTransaction(db, async (tx) => {
    const ref = teamDocRef(teamName);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const counts = { ...(data.counts || {}) };
    counts[type] = Math.max(0, (counts[type] || 0) - 1);
    tx.set(ref, { counts }, { merge: true });
  });
}

export async function resetSurpriseCounter(teamName, type) {
  if (!teamName || !type) return;
  const ref = teamDocRef(teamName);
  await setDoc(ref, { counts: { [type]: 0 } }, { merge: true });
}

export async function getTeamSurpriseCounts(teamName) {
  const snap = await getDoc(teamDocRef(teamName));
  return snap.exists() ? snap.data().counts || {} : {};
}

export const increment = incrementSurprise;
export const decrement = decrementSurprise;

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

export function subscribeSurprisesForTeam(teamName, callback) {
  if (!teamName || typeof callback !== 'function') return () => {};
  const ref = teamDocRef(teamName);
  return onSnapshot(ref, (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() || {} : {};
    const counts = data.counts || {};
    const flat = normalizeCount(counts[SurpriseTypes.FLAT_TIRE] ?? counts.flatTire);
    const bug = normalizeCount(counts[SurpriseTypes.BUG_SPLAT] ?? counts.bugSplat);
    const shield = normalizeCount(counts[SurpriseTypes.WILD_CARD] ?? counts.superShieldWax ?? counts.wildCard);
    callback({
      team: teamName,
      flatTire: flat,
      bugSplat: bug,
      superShieldWax: shield
    });
  });
}

export async function consumeSurprise(teamName, key, amount = 1) {
  if (!teamName || !key || amount <= 0) return false;
  const normalizedKey = normalizeSurpriseKey(key);
  if (!normalizedKey) return false;

  console.log(`🎯 ${teamName} used ${normalizedKey}`);

  let success = false;
  await runTransaction(db, async (tx) => {
    const ref = teamDocRef(teamName);
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() || {} : {};
    const counts = { ...(data.counts || {}) };
    const current = normalizeCount(counts[normalizedKey]);
    if (current < amount) {
      return;
    }
    counts[normalizedKey] = Math.max(0, current - amount);
    tx.set(ref, { counts, updatedAt: serverTimestamp() }, { merge: true });
    success = true;
  });
  return success;
}

export async function auditUse(teamName, kind, meta = {}) {
  try {
    const auditRef = doc(collection(db, 'surpriseAudit'), `${teamName}-${Date.now()}`);
    await setDoc(auditRef, {
      teamName,
      kind,
      meta,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('🔍 surprise audit skipped:', err?.message || err);
  }
}

function normalizeCount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function normalizeSurpriseKey(key) {
  if (!key) return null;
  if (key === SurpriseTypes.FLAT_TIRE || key === 'flatTire') return SurpriseTypes.FLAT_TIRE;
  if (key === SurpriseTypes.BUG_SPLAT || key === 'bugSplat') return SurpriseTypes.BUG_SPLAT;
  if (key === SurpriseTypes.WILD_CARD || key === 'wildCard' || key === 'superShieldWax') return SurpriseTypes.WILD_CARD;
  return null;
}
