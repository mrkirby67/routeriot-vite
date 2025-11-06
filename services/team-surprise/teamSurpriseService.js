// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/team-surprise/teamSurpriseService.js
// PURPOSE: Firestore data layer for Team Surprise inventories and cooldowns.
// DEPENDS_ON: ../../modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../features/team-surprise/teamSurpriseTypes.js
// USED_BY: features/team-surprise/teamSurpriseController.js, components/SurpriseSelector/SurpriseSelector.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP SERVICE HEADER ===

import { db } from '../../modules/config.js';
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
import { SurpriseTypes } from '../../features/team-surprise/teamSurpriseTypes.js';

const TEAM_SURPRISES_COLLECTION = collection(db, 'teamSurprises');

// === BEGIN RECOVERED BLOCK ===
function normalizeCount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

export function normalizeSurpriseKey(key) {
  if (!key) return null;
  if (key === SurpriseTypes.FLAT_TIRE || key === 'flatTire') return SurpriseTypes.FLAT_TIRE;
  if (key === SurpriseTypes.BUG_SPLAT  || key === 'bugSplat')  return SurpriseTypes.BUG_SPLAT;
  if (key === SurpriseTypes.WILD_CARD  || key === 'wildCard' || key === 'superShieldWax') return SurpriseTypes.WILD_CARD;
  if (key === SurpriseTypes.SPEED_BUMP || key === 'speedBump' || key === 'speedbump') return SurpriseTypes.SPEED_BUMP;
  return null;
}

function teamDocRef(teamName) {
  return doc(TEAM_SURPRISES_COLLECTION, String(teamName || '').replace(/[\/#?]/g, '_'));
}

export function subscribeTeamSurprises(callback) {
  console.log('🧩 Subscribed to team surprises for UI sync…');
  if (typeof window !== 'undefined' && window?.fakeTeamData && typeof callback === 'function') {
    try { callback([], window.fakeTeamData); } catch {}
  }
  return onSnapshot(TEAM_SURPRISES_COLLECTION, snapshot => {
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

export const increment = incrementSurprise;
export const decrement = decrementSurprise;

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

function sanitizeTeam(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function defaultSurpriseLabel(type) {
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

export async function consumeSurprise(teamName, key, amount = 1) {
  if (!teamName || !key || amount <= 0) return false;
  const normalizedKey = normalizeSurpriseKey(key);
  if (!normalizedKey) return false;

  let success = false;
  await runTransaction(db, async (tx) => {
    const ref = teamDocRef(teamName);
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() || {} : {};
    const counts = { ...(data.counts || {}) };
    const current = normalizeCount(counts[normalizedKey]);
    if (current < amount) return;
    counts[normalizedKey] = Math.max(0, current - amount);
    tx.set(ref, { counts }, { merge: true });
    success = true;
  });

  if (success) {
    try {
      await auditUse(teamName, normalizedKey, { amount });
    } catch (err) {
      console.debug('🔍 surprise audit skipped:', err?.message || err);
    }
  }

  return success;
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
  const finalTarget = typeof target === 'string' && target.trim() ? target.trim() : 'ALL';
  const isBroadcast = options.isBroadcast ?? true;
  const commPayload = {
    type: normalizedType,
    from: sender,
    to: finalTarget,
    message,
    text: message,
    fromTeam: sender,
    recipient: isBroadcast ? 'ALL' : finalTarget,
    timestamp: serverTimestamp(),
    teamName: sender,
    sender,
    senderDisplay: sender,
    toTeam: isBroadcast ? 'ALL' : finalTarget,
    isBroadcast,
    kind: 'system'
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

export async function deleteAllTeamSurpriseDocs() {
  try {
    const snap = await getDocs(TEAM_SURPRISES_COLLECTION);
    const deletions = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
    if (deletions.length) await Promise.allSettled(deletions);
  } catch (err) {
    console.warn('⚠️ Failed to clear teamSurprises collection:', err);
  }
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
    return false;
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

export function subscribeAllTeamInventories(callback) {
  if (typeof callback !== 'function') return () => {};
  const ref = TEAM_SURPRISES_COLLECTION;
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
// === END RECOVERED BLOCK ===

// === AICP SERVICE FOOTER ===
// aicp_category: service
// ai_origin: services/team-surprise/teamSurpriseService.js
// ai_role: Data Layer
// codex_phase: tier1_services_injection
// export_bridge: features
// exports: normalizeSurpriseKey, subscribeTeamSurprises, incrementSurprise, decrementSurprise, resetSurpriseCounter, getTeamSurpriseCounts, increment, decrement, subscribeSurprisesForTeam, defaultSurpriseLabel, consumeSurprise, sendSurpriseToTeam, auditUse, deleteAllTeamSurpriseDocs, isOnCooldown, getCooldownTimeRemaining, subscribeAllCooldowns, subscribeAllTeamInventories
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier1_services_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP SERVICE FOOTER ===
