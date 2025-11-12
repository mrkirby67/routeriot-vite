// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/speed-bump/speedBumpService.js
// PURPOSE: Firestore helpers for triggering and monitoring Speed Bump events.
// DEPENDS_ON: /core/config.js
// USED_BY: components/SpeedBumpControl/SpeedBumpControl.js, modules/speedBumpPlayer.js
// AUTHOR: Route Riot – Speed Bump Refresh
// CREATED: 2025-10-30
// AICP_VERSION: 3.1
// ============================================================================
// === END AICP SERVICE HEADER ===

import { db } from '/core/config.js';
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  collection,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SPEED_BUMP_COLLECTION = 'speedBumps';

// ----------------------------------------------------------------------------
// 🧩 Utilities
// ----------------------------------------------------------------------------
function normalizeTeamId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function toSpeedBumpPayload(id, data = {}) {
  if (!id) return null;
  const normalizedId = typeof id === 'string' ? id.toLowerCase() : id;
  return {
    id: normalizedId,
    type: data.type || 'slowdown',
    active: !!data.active,
    ...data,
  };
}

// ----------------------------------------------------------------------------
// 🚧 Trigger a Speed Bump
// ----------------------------------------------------------------------------
/*
 * Triggers a speed bump for the given team and type.
 * @param {string} teamId - Team identifier.
 * @param {string} bumpType - Type of bump ('slowdown', 'penalty', etc.).
 * @param {object} meta - Optional metadata to merge.
 */

export async function triggerSpeedBump(teamId, bumpType = 'slowdown', meta = {}) {
  const normalizedTeam = normalizeTeamId(teamId);
  if (!normalizedTeam) {
    throw new Error('triggerSpeedBump requires a valid teamId');
  }

  const type =
    typeof bumpType === 'string' && bumpType.trim()
      ? bumpType.trim().toLowerCase()
      : 'slowdown';
  const ref = doc(db, SPEED_BUMP_COLLECTION, normalizedTeam);
  const payload = {
    active: true,
    type,
    triggeredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    teamId: normalizedTeam,
    teamName: typeof teamId === 'string' ? teamId.trim() : normalizedTeam,
    ...meta,
  };

  await setDoc(ref, payload, { merge: true });
  console.info('🚧 Speed Bump triggered:', {
    team: payload.teamName,
    type: payload.type,
  });
  return payload;
}

// ----------------------------------------------------------------------------
// ✅ Clear a Speed Bump
// ----------------------------------------------------------------------------
/*
 * Marks a team's speed bump as cleared.
 * @param {string} teamId - Team identifier.
 */

export async function clearSpeedBump(teamId) {
  const normalizedTeam = normalizeTeamId(teamId);
  if (!normalizedTeam) return;
  const ref = doc(db, SPEED_BUMP_COLLECTION, normalizedTeam);
  try {
    await updateDoc(ref, {
      active: false,
      clearedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.info('✅ Speed Bump cleared:', normalizedTeam);
  } catch (error) {
    if (error?.code === 'not-found') {
      await setDoc(
        ref,
        {
          active: false,
          clearedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.info('✅ Speed Bump cleared (upsert):', normalizedTeam);
    } else {
      throw error;
    }
  }
}

// ----------------------------------------------------------------------------
// 🔁 Listen to a Single Team’s Bump
// ----------------------------------------------------------------------------
/*
 * Subscribes to a single team's speed bump document.
 * @param {string} teamId
 * @param {function} callback - Receives a SpeedBumpPayload or null.
 * @param {function} onError - Error handler (optional).
 * @returns {function} unsubscribe
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

// ----------------------------------------------------------------------------
// 🌐 Listen to All Teams (for Control Dashboard)
// ----------------------------------------------------------------------------
/*
 * Subscribes to all speed bump documents for Control dashboard monitoring.
 * @param {function} callback - Receives a Map(teamId -> SpeedBumpPayload)
 * @returns {function} unsubscribe
 */

export function subscribeToSpeedBumpStatuses(callback = () => {}) {
  const colRef = collection(db, SPEED_BUMP_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const statusMap = new Map();
      snapshot.forEach((docSnap) => {
        const key =
          typeof docSnap.id === 'string' ? docSnap.id.toLowerCase() : docSnap.id;
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
// export_bridge: components
// exports: triggerSpeedBump, clearSpeedBump, subscribeToSpeedBump, subscribeToSpeedBumpStatuses
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier1_services_injection
// review_status: aligned
// status: stable
// sync_state: aligned
// === END AICP SERVICE FOOTER ===
