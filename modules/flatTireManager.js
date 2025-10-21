// ============================================================================
// MODULE: flatTireManager.js
// PURPOSE: Plan and reveal Flat Tire tow assignments using Firestore
// ============================================================================

import { db } from './config.js';
import { calculateDistance } from './zonesUtils.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ASSIGNMENTS_COLLECTION = collection(db, 'flatTireAssignments');
const COMMUNICATIONS_COLLECTION = collection(db, 'communications');

// Cache to avoid re-fetching zone docs repeatedly
const zoneCache = new Map();

// ----------------------------------------------------------------------------
// 📅 planAssignments
// ----------------------------------------------------------------------------
export async function planAssignments({
  teams = [],
  towZones = [],
  strategy = 'random',
  flatsPerTeam = 1,
  windowStartMs,
  windowEndMs
}) {
  if (!Array.isArray(teams) || !teams.length) {
    throw new Error('No teams provided for Flat Tire planning.');
  }
  if (!Array.isArray(towZones) || !towZones.length) {
    throw new Error('Select at least one tow zone.');
  }
  const startMs = normalizeToMillis(windowStartMs);
  const endMs = normalizeToMillis(windowEndMs);
  if (!startMs || !endMs) {
    throw new Error('Invalid window start/end.');
  }
  if (endMs <= startMs) {
    throw new Error('Window end must be after start.');
  }

  const assignmentLimit = Math.max(1, flatsPerTeam | 0);
  const selectedTeams = shuffleArray([...teams]).slice(0, Math.min(assignmentLimit, teams.length));
  if (!selectedTeams.length) {
    throw new Error('No teams available to schedule.');
  }

  const windowDuration = endMs - startMs;
  const intervalMs = selectedTeams.length > 1
    ? Math.floor(windowDuration / selectedTeams.length)
    : windowDuration;

  const assignments = [];
  for (let index = 0; index < selectedTeams.length; index++) {
    const teamName = selectedTeams[index];
    const scheduledMs = startMs + index * intervalMs;
    const baseDue = index === selectedTeams.length - 1
      ? endMs
      : Math.min(endMs, startMs + (index + 1) * intervalMs);
    const dueMs = Math.min(endMs, Math.max(baseDue, scheduledMs + 5 * 60 * 1000));

    const zone = await selectTowZoneForTeam({
      teamName,
      towZones,
      strategy
    });

    assignments.push({
      teamName,
      towZone: zone,
      assignedAt: Timestamp.fromMillis(scheduledMs),
      dueBy: Timestamp.fromMillis(dueMs),
      status: 'scheduled'
    });
  }

  await Promise.all(assignments.map(({ teamName, towZone, assignedAt, dueBy, status }) => {
    const ref = doc(ASSIGNMENTS_COLLECTION, teamName);
    return setDoc(ref, {
      towZoneId: towZone?.id || null,
      assignedAt,
      dueBy,
      revealedAt: null,
      completedAt: null,
      status,
      selectionStrategy: strategy,
      flatsPerTeam: assignmentLimit,
      updatedAt: serverTimestamp()
    }, { merge: false });
  }));

  console.log(`✅ Planned ${assignments.length} Flat Tire assignments.`);
  return assignments;
}

// ----------------------------------------------------------------------------
// 🚨 revealAssignmentForTeam
// ----------------------------------------------------------------------------
export async function revealAssignmentForTeam(teamName, now = Date.now()) {
  if (!teamName) throw new Error('teamName is required to reveal assignment.');

  const assignmentRef = doc(ASSIGNMENTS_COLLECTION, teamName);
  const assignmentSnap = await getDoc(assignmentRef);
  if (!assignmentSnap.exists()) {
    throw new Error(`No Flat Tire assignment found for ${teamName}.`);
  }

  const data = assignmentSnap.data();
  if (!data.towZoneId) {
    throw new Error(`Assignment for ${teamName} is missing towZoneId.`);
  }

  const zoneData = await loadZoneData(data.towZoneId);
  const zoneName = zoneData?.name || data.towZoneId;

  await updateDoc(assignmentRef, {
    status: 'revealed',
    revealedAt: Timestamp.fromMillis(now),
    updatedAt: serverTimestamp()
  });

  await addDoc(COMMUNICATIONS_COLLECTION, {
    teamName: teamName,
    sender: teamName,
    senderDisplay: teamName,
    message: `🚨 ${teamName} blew a tire! Head to ${zoneName}.`,
    type: 'flatTire',
    audience: 'players',
    isBroadcast: true,
    createdAt: serverTimestamp(),
    timestamp: serverTimestamp()
  });

  console.log(`📣 Revealed Flat Tire assignment for ${teamName} (${zoneName}).`);
}

export async function pauseAllAssignments(now = Date.now()) {
  const snapshot = await getDocs(ASSIGNMENTS_COLLECTION);
  const updates = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (!data || ['completed', 'cancelled'].includes(data.status)) return;
    if (data.status === 'paused') return;

    const dueMs = data.dueBy?.toMillis ? data.dueBy.toMillis() : (typeof data.dueBy === 'number' ? data.dueBy : null);
    const remaining = dueMs ? Math.max(dueMs - now, 0) : Math.max(data.remainingMs ?? 0, 0);

    updates.push(updateDoc(docSnap.ref, {
      status: 'paused',
      prePauseStatus: data.status || 'scheduled',
      remainingMs: remaining,
      dueBy: null,
      updatedAt: serverTimestamp()
    }));
  });

  await Promise.all(updates);
}

export async function resumeAllAssignments(now = Date.now()) {
  const snapshot = await getDocs(ASSIGNMENTS_COLLECTION);
  const updates = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (!data || data.status !== 'paused') return;

    const remaining = Math.max(data.remainingMs ?? 0, 0);
    const resumeStatus = data.prePauseStatus || 'scheduled';
    const dueBy = remaining > 0 ? Timestamp.fromMillis(now + remaining) : Timestamp.fromMillis(now);

    updates.push(updateDoc(docSnap.ref, {
      status: resumeStatus,
      dueBy,
      remainingMs: null,
      prePauseStatus: null,
      updatedAt: serverTimestamp()
    }));
  });

  await Promise.all(updates);
}

export async function cancelAllAssignments() {
  const snapshot = await getDocs(ASSIGNMENTS_COLLECTION);
  const updates = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (!data || ['completed', 'cancelled'].includes(data.status)) return;

    updates.push(updateDoc(docSnap.ref, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      remainingMs: null,
      prePauseStatus: null,
      updatedAt: serverTimestamp()
    }));
  });

  await Promise.all(updates);
}

// ----------------------------------------------------------------------------
// 🧮 Helpers
// ----------------------------------------------------------------------------
async function selectTowZoneForTeam({ teamName, towZones, strategy }) {
  if (strategy === 'farthest-from-last-zone') {
    try {
      const lastZoneId = await getTeamLastZone(teamName);
      if (lastZoneId) {
        const best = await findFarthestTowZone(lastZoneId, towZones);
        if (best) return best;
      }
    } catch (err) {
      console.warn(`⚠️ Farthest strategy failed for ${teamName}:`, err);
    }
  }

  return towZones[Math.floor(Math.random() * towZones.length)];
}

async function getTeamLastZone(teamName) {
  const teamRef = doc(db, 'teamStatus', teamName);
  const snap = await getDoc(teamRef);
  if (!snap.exists()) return null;
  return snap.data()?.lastKnownLocation || null;
}

async function findFarthestTowZone(lastZoneId, towZones) {
  const baseZone = await loadZoneData(lastZoneId);
  if (!baseZone?.gps) return null;

  const [lat1, lng1] = baseZone.gps.split(',').map(Number);
  if (Number.isNaN(lat1) || Number.isNaN(lng1)) return null;

  let farthest = null;
  let farthestDistance = -1;

  for (const zone of towZones) {
    if (!zone?.data?.gps) continue;
    const [lat2, lng2] = zone.data.gps.split(',').map(Number);
    if (Number.isNaN(lat2) || Number.isNaN(lng2)) continue;

    const distance = calculateDistance(lat1, lng1, lat2, lng2);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthest = zone;
    } else if (distance === farthestDistance && Math.random() > 0.5) {
      farthest = zone;
    }
  }

  return farthest || towZones[Math.floor(Math.random() * towZones.length)];
}

async function loadZoneData(zoneId) {
  if (!zoneId) return null;
  if (zoneCache.has(zoneId)) return zoneCache.get(zoneId);

  const zoneSnap = await getDoc(doc(db, 'zones', zoneId));
  if (zoneSnap.exists()) {
    const data = zoneSnap.data();
    zoneCache.set(zoneId, data);
    return data;
  }
  return null;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeToMillis(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (value?.toDate) return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}
