// ============================================================================
// FILE: modules/teamSurpriseManager.js
// PURPOSE: Firestore helpers for team surprise counters (Flat Tire, Bug Splat, Super SHIELD Wax)
// ============================================================================

import { db } from './config.js';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ----------------------------------------------------------------------------
// 🎯 Types
// ----------------------------------------------------------------------------
export const SurpriseTypes = Object.freeze({
  FLAT_TIRE: 'flatTire',
  BUG_SPLAT: 'bugSplat',
  WILD_CARD: 'wildCard',
  SPEED_BUMP: 'speedBump'
});

// ----------------------------------------------------------------------------
/** Shield duration (minutes) is stored in localStorage with a sane default. */
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 🛡️ Shield state (client-side cache)
// ----------------------------------------------------------------------------
export const activeShields = Object.create(null); // { [teamName]: expiresAtMs }

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

// ----------------------------------------------------------------------------
// 📚 Firestore refs & helpers
// ----------------------------------------------------------------------------
const COLLECTION = collection(db, 'teamSurprises');

function teamDocRef(teamName) {
  return doc(COLLECTION, String(teamName || '').replace(/[\\/#?]/g, '_'));
}

// ----------------------------------------------------------------------------
// 🔁 Firestore Listeners & Counters
// ----------------------------------------------------------------------------
export function subscribeTeamSurprises(callback) {
  console.log('🧩 Subscribed to team surprises for UI sync…');
  // Optional pre-fill hook for local demos
  if (typeof window !== 'undefined' && window?.fakeTeamData && typeof callback === 'function') {
    try { callback([], window.fakeTeamData); } catch {}
  }
  return onSnapshot(COLLECTION, snapshot => {
    const entries = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      teamName: docSnap.id,
      counts: docSnap.data().counts || {}
    }));
    const byTeam = Object.create(null);
    entries.forEach(entry => { byTeam[entry.teamName] = entry.counts || {}; });
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

// alias exports
export const increment = incrementSurprise;
export const decrement = decrementSurprise;

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
    const bug  = normalizeCount(counts[SurpriseTypes.BUG_SPLAT] ?? counts.bugSplat);
    const wax  = normalizeCount(counts[SurpriseTypes.WILD_CARD]  ?? counts.superShieldWax ?? counts.wildCard);
    const speed = normalizeCount(counts[SurpriseTypes.SPEED_BUMP] ?? counts.speedBump ?? counts.speedbump);
    callback({
      team: teamName,
      flatTire: flat,
      bugSplat: bug,
      superShieldWax: wax,
      speedBump: speed
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
    if (current < amount) return;
    counts[normalizedKey] = Math.max(0, current - amount);
    tx.set(ref, { counts, updatedAt: serverTimestamp() }, { merge: true });
    success = true;
  });
  return success;
}

function defaultSurpriseLabel(type) {
  switch (type) {
    case SurpriseTypes.FLAT_TIRE:
      return 'Flat Tire';
    case SurpriseTypes.BUG_SPLAT:
      return 'Bug Splat';
    case SurpriseTypes.WILD_CARD:
      return 'Super Shield Wax';
    case SurpriseTypes.SPEED_BUMP:
      return 'Speed Bump';
    default:
      return 'Surprise';
  }
}

function defaultCommunicationMessage(type, fromTeam, toTeam) {
  const label = defaultSurpriseLabel(type);
  switch (type) {
    case SurpriseTypes.FLAT_TIRE:
      return `🚗 ${fromTeam} sent a FLAT TIRE to ${toTeam}!`;
    case SurpriseTypes.BUG_SPLAT:
      return `🐞 ${fromTeam} launched a BUG SPLAT on ${toTeam}!`;
    case SurpriseTypes.WILD_CARD:
      return `🛡️ ${fromTeam} activated Super Shield Wax.`;
    case SurpriseTypes.SPEED_BUMP:
      return `🚧 ${fromTeam} dropped a SPEED BUMP on ${toTeam}!`;
    default:
      return `${fromTeam} used ${label} on ${toTeam}.`;
  }
}

function sanitizeTeam(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function sendSurpriseToTeam(fromTeam, toTeam, type, options = {}) {
  const sender = sanitizeTeam(fromTeam);
  const target = sanitizeTeam(toTeam);

  if (!sender) {
    return { ok: false, message: 'Missing sending team.' };
  }
  if (!target || sender === target) {
    return { ok: false, message: 'Choose a different team.' };
  }

  const normalizedType = normalizeSurpriseKey(type);
  if (!normalizedType) {
    return { ok: false, message: 'Unknown surprise type.' };
  }

  const consumed = await consumeSurprise(sender, normalizedType);
  if (!consumed) {
    const label = defaultSurpriseLabel(normalizedType);
    return { ok: false, message: `No ${label} surprises remaining.` };
  }

  const message = options.message || defaultCommunicationMessage(normalizedType, sender, target);
  const commPayload = {
    type: normalizedType,
    from: sender,
    to: target,
    message,
    timestamp: serverTimestamp(),
    teamName: sender,
    sender,
    senderDisplay: sender,
    toTeam: target,
    isBroadcast: options.isBroadcast ?? true
  };

  if (options.extraFields && typeof options.extraFields === 'object') {
    Object.assign(commPayload, options.extraFields);
  }

  try {
    await addDoc(collection(db, 'communications'), commPayload);
  } catch (err) {
    console.warn('⚠️ Failed to record surprise communication:', err);
  }

  try {
    await addDoc(collection(db, 'surpriseAudit'), {
      from: sender,
      to: target,
      type: normalizedType,
      timestamp: serverTimestamp(),
      teamName: sender,
      kind: normalizedType
    });
  } catch (err) {
    console.debug('🔍 surprise audit skipped:', err?.message || err);
  }

  console.info(`🎯 Sent ${normalizedType} to ${target}`);

  return { ok: true, type: normalizedType, message };
}

export async function auditUse(teamName, kind, meta = {}) {
  try {
    const auditRef = doc(collection(db, 'surpriseAudit'), `${teamName}-${Date.now()}`);
    const timestamp = serverTimestamp();
    await setDoc(auditRef, {
      teamName,
      kind,
      meta,
      from: teamName,
      to: meta?.targetTeam ?? meta?.to ?? null,
      type: kind,
      timestamp,
      updatedAt: timestamp
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
  if (key === SurpriseTypes.BUG_SPLAT  || key === 'bugSplat')  return SurpriseTypes.BUG_SPLAT;
  if (key === SurpriseTypes.WILD_CARD  || key === 'wildCard' || key === 'superShieldWax') return SurpriseTypes.WILD_CARD;
  if (key === SurpriseTypes.SPEED_BUMP || key === 'speedBump' || key === 'speedbump') return SurpriseTypes.SPEED_BUMP;
  return null;
}

// =========================================================
// 🚫 Wild Card & Cooldown Guards
// =========================================================
export const activeWildCards  = Object.create(null); // { teamName: { type, expires } }
export const activeCooldowns  = Object.create(null); // { teamName: expiresAtMs }

const DEFAULT_COOLDOWN_MINUTES = 2;
function getCooldownDurationMs() {
  // If you later add settings-backed cooldowns, swap this with a real reader.
  return DEFAULT_COOLDOWN_MINUTES * 60 * 1000;
}

export async function clearAllTeamSurprises() {
  for (const key of Object.keys(activeShields))   delete activeShields[key];
  for (const key of Object.keys(activeWildCards)) delete activeWildCards[key];
  for (const key of Object.keys(activeCooldowns)) delete activeCooldowns[key];

  try {
    const snap = await getDocs(collection(db, 'teamSurprises'));
    const deletions = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
    if (deletions.length) await Promise.allSettled(deletions);
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

export function startCooldown(team) {
  if (!team) return;
  const ms = getCooldownDurationMs();
  activeCooldowns[team] = Date.now() + Math.max(0, Number(ms) || 0);
}

export async function isOnCooldown(team) {
  if (!team) return false;
  try {
    const ref = doc(db, 'teamCooldowns', team);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const expiresAt = snap.data().expiresAt || 0;
    return expiresAt > Date.now();
  } catch (err) {
    console.error(`❌ Cooldown check failed for ${team}:`, err);
    return false; // Fail open
  }
}

export async function getCooldownTimeRemaining(teamName) {
  if (!teamName) return 0;
  try {
    const ref = doc(db, 'teamCooldowns', teamName);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 0;
    const expiresAt = snap.data().expiresAt || 0;
    return Math.max(0, expiresAt - Date.now());
  } catch (err) {
    console.error(`❌ Cooldown remaining time check failed for ${teamName}:`, err);
    return 0;
  }
}

export function subscribeAllCooldowns(callback) {
  if (typeof callback !== 'function') return () => {};
  const ref = collection(db, 'teamCooldowns');
  return onSnapshot(ref, (snapshot) => {
    const cooldowns = {};
    snapshot.forEach(docSnap => {
      cooldowns[docSnap.id] = docSnap.data().expiresAt || 0;
    });
    callback(cooldowns);
  });
}

// =========================================================
// 🧼 Shield Confirmation Gate (UI modal or confirm() fallback)
// =========================================================
export function checkShieldBeforeAttack(teamName, onProceed) {
  if (typeof onProceed !== 'function') return Promise.resolve(null);

  const execute = () => Promise.resolve(onProceed());

  // No shield? just proceed.
  if (!teamName || !isShieldActive(teamName)) {
    return execute();
  }

  // Non-DOM environments: use confirm() if available, else auto-proceed after deactivating.
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

  // DOM modal flow
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
export const isTeamOnCooldown = isOnCooldown;

// 🔐 Unified attackability check
export async function isTeamAttackable(teamName) {
  if (!teamName) return false;
  // if shield is active → cannot be attacked
  if (isShieldActive(teamName)) return false;
  // if under wild-card / special protection → cannot be attacked
  if (isUnderWildCard(teamName)) return false;
  return true;
}

// 🧠 Centralized offensive-action helper
// params: { fromTeam, toTeam, type, onSuccess }
// - fromTeam: string (attacker)
// - toTeam:   string (victim)
// - type:     string ('flatTire' | 'bugSplat' | 'speedBump' | etc.)
// - onSuccess: async fn that actually performs the effect ONLY WHEN
//              the target is attackable
//
// Behavior:
//   1. attacker ALWAYS loses the token (if they had it)
//   2. if target is protected → send both messages and STOP
//   3. else → run onSuccess() and send success messages
export async function attemptSurpriseAttack({
  fromTeam,
  toTeam,
  type,
  onSuccess
}) {
  const normalizedType = normalizeSurpriseKey(type);
  const label = defaultSurpriseLabel(normalizedType || type);

  // 1) attacker always consumes their surprise, if they have it
  if (fromTeam && normalizedType) {
    try {
      await consumeSurprise(fromTeam, normalizedType, 1);
    } catch (err) {
      console.warn('⚠️ Failed to consume surprise for', fromTeam, normalizedType, err);
    }
  }

  // 2) cannot attack if victim is protected
  const attackable = await isTeamAttackable(toTeam);
  if (!attackable) {
    // notify both sides
    try {
      // attacker message
      if (typeof window !== 'undefined' && window?.chatManager?.sendPrivateSystemMessage) {
        window.chatManager.sendPrivateSystemMessage(
          fromTeam,
          `🚫 ${toTeam} was protected by a Shield / Wax. Your ${label} was blocked.`
        );
      }
      // victim message
      if (typeof window !== 'undefined' && window?.chatManager?.sendPrivateSystemMessage) {
        window.chatManager.sendPrivateSystemMessage(
          toTeam,
          `✨ Your shiny wax protected you from a ${label} from ${fromTeam}.`
        );
      }
    } catch (err) {
      console.debug('💬 shield-block notify failed:', err?.message || err);
    }
    return { ok: false, reason: 'shielded' };
  }

  // 3) proceed with real effect
  if (typeof onSuccess === 'function') {
    await onSuccess();
  }

  // 4) notify both sides on success
  try {
    if (typeof window !== 'undefined' && window?.chatManager?.sendPrivateSystemMessage) {
      window.chatManager.sendPrivateSystemMessage(
        fromTeam,
        `✅ ${toTeam} was successfully hit with ${label}.`
      );
      window.chatManager.sendPrivateSystemMessage(
        toTeam,
        `💥 You were hit by ${label} from ${fromTeam}!`
      );
    }
  } catch (err) {
    console.debug('💬 success notify failed:', err?.message || err);
  }

  return { ok: true };
}

/** Keeps player UI inventories in live sync with Firestore updates. */
export function subscribeAllTeamInventories(callback) {
  if (typeof callback !== 'function') return () => {};
  const ref = collection(db, 'teamSurprises');
  return onSnapshot(ref, (snapshot) => {
    const inventories = {};
    snapshot.forEach((docSnap) => {
      const raw = docSnap.data() || {};
      const counts = raw.counts || {};
      const flat = normalizeCount(counts[SurpriseTypes.FLAT_TIRE] ?? counts.flatTire);
      const bug = normalizeCount(counts[SurpriseTypes.BUG_SPLAT] ?? counts.bugSplat);
      const shield = normalizeCount(counts[SurpriseTypes.WILD_CARD] ?? counts.superShieldWax ?? counts.wildCard);
      const speed = normalizeCount(counts[SurpriseTypes.SPEED_BUMP] ?? counts.speedBump ?? counts.speedbump);
      inventories[docSnap.id] = {
        flatTire: flat,
        bugSplat: bug,
        wildCard: shield,
        superShieldWax: shield,
        speedBump: speed
      };
    });
    callback(inventories);
  });
}
