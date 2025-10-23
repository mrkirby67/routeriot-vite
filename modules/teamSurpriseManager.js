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
  setDoc
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

export const activeShieldUntil = new Map();

export function activateShield(teamName, expiresAtMs) {
  if (!teamName) return null;
  const durationMs = getShieldDurationMs();
  const candidate = Number(expiresAtMs);
  const expiresAt = Number.isFinite(candidate) ? candidate : Date.now() + durationMs;
  activeShieldUntil.set(teamName, expiresAt);
  console.log(`🛡️ ${teamName} protected until ${new Date(expiresAt).toLocaleTimeString()}`);
  return expiresAt;
}

export function isShieldActive(teamName) {
  if (!teamName) return false;
  const expiresAt = activeShieldUntil.get(teamName);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    activeShieldUntil.delete(teamName);
    return false;
  }
  return true;
}

const COLLECTION = collection(db, 'teamSurprises');

function teamDocRef(teamName) {
  return doc(COLLECTION, teamName.replace(/[\\/#?]/g, '_'));
}

export function subscribeTeamSurprises(callback) {
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
