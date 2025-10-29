// ============================================================================
// FILE: modules/speedBump/index.js
// PURPOSE: Unified export hub for all Speed Bump logic (core, comms, timers, etc.)
// ============================================================================

import { db } from '../config.js';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  where,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  SPEEDBUMP_COLLECTION,
  SPEEDBUMP_STATUS,
  buildSpeedBumpRecord,
  activeBumps
} from './core.js';

import {
  sendSpeedBump as legacySendSpeedBump,
  releaseSpeedBump as legacyReleaseSpeedBump,
  getCooldownRemaining,
  getActiveBump,
  applyProofSent,
  applySpeedBump,
  isTeamBumped,
  sendSpeedBumpChirp
} from './interactions.js';

export * from './core.js';
export * from './comms.js';
export { clearValidationTimer } from './timers.js';
export * from './reversals.js';

export {
  getCooldownRemaining,
  getActiveBump,
  applyProofSent,
  applySpeedBump,
  isTeamBumped,
  sendSpeedBumpChirp,
  applyProofSent as markProofSent
};

export async function sendSpeedBump(attackerTeam, targetTeam, durationMs = 60_000, extraData = {}) {
  const normalizedAttacker = typeof attackerTeam === 'string' ? attackerTeam.trim() : '';
  const normalizedTarget = typeof targetTeam === 'string' ? targetTeam.trim() : '';

  if (!normalizedAttacker || !normalizedTarget) {
    return { ok: false, reason: 'missing_team' };
  }

  const challenge = typeof extraData.challenge === 'string' ? extraData.challenge.trim() : '';
  const legacyResult = await legacySendSpeedBump(
    normalizedAttacker,
    normalizedTarget,
    challenge,
    { override: !!extraData.override }
  );

  if (!legacyResult?.ok) {
    return legacyResult;
  }

  const record = {
    ...buildSpeedBumpRecord({
      by: normalizedAttacker,
      toTeam: normalizedTarget,
      countdownMs: durationMs
    }),
    challenge,
    details: challenge,
    lastUpdatedAt: Date.now(),
    ...extraData
  };

  const ref = doc(db, SPEEDBUMP_COLLECTION, normalizedTarget);
  await setDoc(ref, { ...record, createdAtServer: serverTimestamp() }, { merge: true });
  console.log(`✅ Speed bump sent to ${normalizedTarget}`);

  return { ok: true, record };
}

export async function releaseSpeedBump(teamName, releasedBy = 'Game Master', options = {}) {
  const normalizedTeam = typeof teamName === 'string' ? teamName.trim() : '';
  if (!normalizedTeam) return;

  const ref = doc(db, SPEEDBUMP_COLLECTION, normalizedTeam);
  await setDoc(ref, {
    status: SPEEDBUMP_STATUS.released,
    releasedBy,
    releasedAt: Date.now()
  }, { merge: true });

  return legacyReleaseSpeedBump(normalizedTeam, releasedBy, options);
}

export function subscribeSpeedBumps(arg1, arg2) {
  // Overload:
  //  1. subscribeSpeedBumps(callback)           -> Control dashboard snapshot of all active bumps
  //  2. subscribeSpeedBumps(teamName, callback) -> Player-side single team watcher
  if (typeof arg1 === 'string' && typeof arg2 === 'function') {
    const teamName = arg1.trim();
    const callback = arg2;
    if (!teamName) return () => {};
    const ref = doc(db, SPEEDBUMP_COLLECTION, teamName);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        legacyReleaseSpeedBump(teamName, 'Firestore Sync', { fromComms: true });
        callback(null);
        return;
      }
      const data = snap.data();
      if (data?.toTeam === teamName && data?.status === SPEEDBUMP_STATUS.active) {
        applySpeedBump(teamName, {
          by: data.by,
          challenge: data.challenge || '',
          startedAt: data.createdAt ?? Date.now(),
          countdownEndsAt: data.expiresAt ?? null,
          countdownMs: data.countdownMs ?? null,
          contactEmail: data.contactEmail || null,
          contactPhone: data.contactPhone || null
        });
        callback({ id: teamName, ...data });
      } else {
        legacyReleaseSpeedBump(teamName, 'Firestore Sync', { fromComms: true });
        callback(null);
      }
    }, (err) => {
      console.error('[SpeedBump] subscribeSpeedBumps error (team):', err);
      callback(null);
    });
  }

  const callback = typeof arg1 === 'function' ? arg1 : () => {};
  const q = query(
    collection(db, SPEEDBUMP_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    const active = [];
    const activeTeams = new Set();
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data?.status === SPEEDBUMP_STATUS.active) {
        const teamName = docSnap.id;
        active.push([teamName, data]);
        activeTeams.add(teamName);

        const current = activeBumps.get(teamName) || {};
        const proposed = {
          ...current,
          by: data.by || data.attacker || current.by,
          challenge: data.details || data.challenge || current.challenge || '',
          startedAt: data.createdAt ?? current.startedAt ?? Date.now(),
          countdownEndsAt: data.expiresAt ?? null,
          countdownMs: data.countdownMs ?? null,
          contactEmail: data.contactEmail || current.contactEmail || null,
          contactPhone: data.contactPhone || current.contactPhone || null,
          chirp: data.chirp || current.chirp || null
        };

        const hasChanged =
          current.by !== proposed.by ||
          current.challenge !== proposed.challenge ||
          current.countdownEndsAt !== proposed.countdownEndsAt ||
          current.countdownMs !== proposed.countdownMs ||
          current.chirp !== proposed.chirp;

        if (hasChanged) {
          applySpeedBump(teamName, proposed);
        }
      }
    });

    for (const existingTeam of Array.from(activeBumps.keys())) {
      if (!activeTeams.has(existingTeam)) {
        legacyReleaseSpeedBump(existingTeam, 'Firestore Sync', { fromComms: true });
      }
    }

    callback({ activeBumps: active });
  }, (err) => {
    console.error('[SpeedBump] subscribeSpeedBumps error (all):', err);
    callback({ activeBumps: [] });
  });
}

export function subscribeSpeedBumpsForAttacker(teamName, onUpdate) {
  const normalizedTeam = typeof teamName === 'string' ? teamName.trim() : '';
  if (!normalizedTeam || typeof onUpdate !== 'function') return () => {};

  const consumeSnapshot = (snap) => {
    const data = [];
    snap?.forEach((docSnap) => {
      data.push({ id: docSnap.id, ...docSnap.data() });
    });
    console.debug(`[SpeedBump][Attacker] Snapshot for ${normalizedTeam}`, data);
    onUpdate(data);
  };

  const ref = collection(db, SPEEDBUMP_COLLECTION);

  try {
    const orderedQuery = query(ref, where('attacker', '==', normalizedTeam), orderBy('timestamp', 'desc'));
    console.info('[SpeedBump][Attacker] Listener attached for', normalizedTeam);

    let unsubscribe = onSnapshot(
      orderedQuery,
      consumeSnapshot,
      (err) => {
        console.error('[SpeedBump][Attacker] Error:', err);
        console.warn('⚠️ Retrying SpeedBump subscription without orderBy.');
        unsubscribe?.();
        const fallbackQuery = query(ref, where('attacker', '==', normalizedTeam));
        unsubscribe = onSnapshot(fallbackQuery, consumeSnapshot);
      }
    );

    return () => {
      unsubscribe?.();
    };
  } catch (err) {
    console.error('[SpeedBump][Attacker] Error:', err);
    console.warn('⚠️ Retrying SpeedBump subscription without orderBy.');
    const fallbackQuery = query(ref, where('attacker', '==', normalizedTeam));
    return onSnapshot(fallbackQuery, consumeSnapshot);
  }
}

export async function verifySpeedBump(targetTeam) {
  const normalized = typeof targetTeam === 'string' ? targetTeam.trim() : '';
  if (!normalized) return null;
  const snap = await getDoc(doc(db, SPEEDBUMP_COLLECTION, normalized));
  const data = snap.exists() ? snap.data() : null;
  console.log('🔍 Verify:', normalized, snap.exists(), data);
  return data;
}
