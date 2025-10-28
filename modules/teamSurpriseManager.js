// ============================================================================
// FILE: modules/teamSurpriseManager.js
// PURPOSE: Firestore helpers for team surprise counters (Flat Tire, Bug Splat, Super SHIELD Wax)
// ============================================================================

import { db } from './config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
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

export function deactivateShield(teamName) {
  if (!teamName) return;
  delete activeShields[teamName];
}

const COLLECTION = collection(db, 'teamSurprises');

function teamDocRef(teamName) {
  return doc(COLLECTION, teamName.replace(/[\\/#?]/g, '_'));
}

// ----------------------------------------------------------------------------
// 🔁 Firestore Listeners & Counters
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 🕒 Shield + Timer Utilities
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 🔥 Live per-team subscription helper
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 💾 Transactional surprise usage + audit
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 🧮 Normalization helpers
// ----------------------------------------------------------------------------
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

// =========================================================
// 🚫 Wild Card & Shield Guards
// =========================================================
export const activeWildCards = Object.create(null);   // { teamName: { type, expires } }
export const activeCooldowns = Object.create(null);   // { teamName: timestamp }

export async function clearAllTeamSurprises() {
  for (const key of Object.keys(activeShields)) {
    delete activeShields[key];
  }
  for (const key of Object.keys(activeWildCards)) {
    delete activeWildCards[key];
  }
  for (const key of Object.keys(activeCooldowns)) {
    delete activeCooldowns[key];
  }

  try {
    const snap = await getDocs(collection(db, 'teamSurprises'));
    const deletions = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
    if (deletions.length) {
      await Promise.allSettled(deletions);
    }
  } catch (err) {
    console.warn('⚠️ Failed to clear teamSurprises collection:', err);
  }
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

export function startCooldown(team, ms = 60_000) {
  if (!team) return;
  activeCooldowns[team] = Date.now() + Math.max(0, Number(ms) || 0);
}

export function isOnCooldown(team) {
  if (!team) return false;
  const expires = activeCooldowns[team];
  if (!expires) return false;
  if (expires <= Date.now()) {
    delete activeCooldowns[team];
    return false;
  }
  return true;
}

export const isTeamOnCooldown = isOnCooldown;

// =========================================================
// 🧼 Shield Confirmation Gate
// =========================================================
export function checkShieldBeforeAttack(teamName, onProceed) {
  if (typeof onProceed !== 'function') return Promise.resolve(null);

  const execute = () => Promise.resolve(onProceed());

  if (!teamName || !isShieldActive(teamName)) {
    return execute();
  }

  if (typeof document === 'undefined') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(
        '🧼 Now why would you get that new polish tarnished with those dirty deeds? Proceeding will cancel your shield.'
      );
      if (!confirmed) {
        return Promise.resolve({ ok: false, reason: 'shield_cancelled' });
      }
      deactivateShield(teamName);
      return execute();
    }
    deactivateShield(teamName);
    return execute();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('.shield-confirm');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'shield-confirm';
    modal.innerHTML = `
      <div class="modal-content">
        <p>🧼 Now why would you get that new polish tarnished with those dirty deeds?</p>
        <p>If you proceed you cancel your shield.</p>
        <div class="modal-actions">
          <button type="button" id="cancelAttack">Cancel</button>
          <button type="button" id="proceedAttack">Proceed Anyway</button>
        </div>
      </div>
    `;

    const cleanup = () => modal?.remove();
    const handleCancel = () => {
      cleanup();
      resolve({ ok: false, reason: 'shield_cancelled' });
    };
    const handleProceed = () => {
      cleanup();
      deactivateShield(teamName);
      execute().then(resolve).catch(reject);
    };

    modal.querySelector('#cancelAttack')?.addEventListener('click', handleCancel, { once: true });
    modal.querySelector('#proceedAttack')?.addEventListener('click', handleProceed, { once: true });

    document.body.appendChild(modal);
  });
}
