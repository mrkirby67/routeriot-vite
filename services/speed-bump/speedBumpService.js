// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/speed-bump/speedBumpService.js
// PURPOSE: Firestore helpers for triggering and monitoring Speed Bump events.
// DEPENDS_ON: ../../modules/config.js
// USED_BY: components/SpeedBumpControl/SpeedBumpControl.js, modules/speedBumpPlayer.js
// AUTHOR: Route Riot – Speed Bump Refresh
// CREATED: 2025-10-30
// AICP_VERSION: 3.1
// ============================================================================
// === END AICP SERVICE HEADER ===

import { db } from '../../modules/config.js';
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  collection
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SPEED_BUMP_COLLECTION = 'speedBumps';

function normalizeTeamId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function toSpeedBumpPayload(id, data = {}) {
  if (!id) return null;
  const normalizedId = typeof id === 'string' ? id.toLowerCase() : id;
  return { id: normalizedId, type: data.type || 'slowdown', active: !!data.active, ...data };
}

/*
 * Triggers a speed bump for the given team and type.
 */
export async function triggerSpeedBump(teamId, bumpType, meta = {}) {
  const normalizedTeam = normalizeTeamId(teamId);
  if (!normalizedTeam) {
    throw new Error('triggerSpeedBump requires a valid teamId');
  }

  const type = typeof bumpType === 'string' && bumpType.trim() ? bumpType.trim().toLowerCase() : 'slowdown';
  const ref = doc(db, SPEED_BUMP_COLLECTION, normalizedTeam);
  const payload = {
    active: true,
    type,
    triggeredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    teamId: normalizedTeam,
    teamName: typeof teamId === 'string' ? teamId.trim() : normalizedTeam
  };

  Object.entries(meta || {}).forEach(([key, value]) => {
    if (typeof key !== 'string') return;
    payload[key] = value;
  });

  await setDoc(ref, payload, { merge: true });
}

/*
 * Marks a team speed bump as cleared.
 */
export async function clearSpeedBump(teamId) {
  const normalizedTeam = normalizeTeamId(teamId);
  if (!normalizedTeam) return;
  const ref = doc(db, SPEED_BUMP_COLLECTION, normalizedTeam);
  try {
    await updateDoc(ref, {
      active: false,
      clearedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    if (error?.code === 'not-found') {
      await setDoc(
        ref,
        {
          active: false,
          clearedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } else {
      throw error;
    }
  }
}

/*
 * Subscribes to a single team's speed bump document.
 */
export function subscribeToSpeedBump(teamId, callback = () => {}, onError = () => {}) {
  const normalizedTeam = normalizeTeamId(teamId);
  if (!normalizedTeam) return () => {};

  const ref = doc(db, SPEED_BUMP_COLLECTION, normalizedTeam);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(toSpeedBumpPayload(snap.id, snap.data()));
    },
    (error) => {
      onError?.(error);
      callback(null);
    }
  );
}

/*
 * Subscribes to all speed bump documents for control dashboard status updates.
 */
export function subscribeToSpeedBumpStatuses(callback = () => {}) {
  const colRef = collection(db, SPEED_BUMP_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const statusMap = new Map();
      snapshot.forEach((docSnap) => {
        const key = typeof docSnap.id === 'string' ? docSnap.id.toLowerCase() : docSnap.id;
        statusMap.set(key, toSpeedBumpPayload(docSnap.id, docSnap.data()));
      });
      callback(statusMap);
    },
    (error) => {
      console.error('[speedBumpService] subscribeToSpeedBumpStatuses error:', error);
      callback(new Map());
    }
  );
}

// === AICP SERVICE FOOTER ===
// ai_origin: services/speed-bump/speedBumpService.js
// ai_role: Data Layer
// aicp_category: service
// aicp_version: 3.1
// codex_phase: tier1_services_injection
// export_bridge: components/*
// exports: triggerSpeedBump, clearSpeedBump, subscribeToSpeedBump, subscribeToSpeedBumpStatuses
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier1_services_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// === END AICP SERVICE FOOTER ===
