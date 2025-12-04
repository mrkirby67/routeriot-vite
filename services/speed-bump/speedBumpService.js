// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/speed-bump/speedBumpService.js
// PURPOSE: Core Speed Bump assignment + lifecycle Firestore data layer
// LAYER: services
// DEPENDS_ON: /core/config.js, firebase-firestore, services/gameRulesManager.js
// AUTHOR: Route Riot – Speed Bump
// CREATED: 2025-01-01
// AICP_VERSION: 1.0
// ============================================================================
// === END AICP SERVICE HEADER ===

// ============================================================================
// FILE: services/speed-bump/speedBumpService.js
// PURPOSE: Core Speed Bump assignment + lifecycle logic (attacker → victim)
// NOTES: Phase 1 restoration of legacy behavior (no UI changes)
// ============================================================================

import { db } from '/core/config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  getRandomSpeedBumpPrompt,
  getSpeedBumpPromptBank
} from '../../modules/speedBumpChallenges.js';
import ChatServiceV2 from '../ChatServiceV2.js';
import { canTeamBeAttacked, canUseWildCards } from '../gameRulesManager.js';

// ----------------------------------------------------------------------------
// 🔢 Constants
// ----------------------------------------------------------------------------

export const SPEEDBUMP_STATUS = Object.freeze({
  PENDING: 'pending',           // assigned, victim not yet acknowledged
  ACTIVE: 'active',             // victim overlay shown / in progress
  WAITING_RELEASE: 'waiting_release', // victim requested release / completed; 5-min window
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
});

// Durations
export const BLOCK_DURATION_MS = 20 * 60 * 1000;   // 20 minutes
export const RELEASE_DURATION_MS = 5 * 60 * 1000;  // 5 minutes
const CHIRP_LIMIT = 2;
export const SPEEDBUMP_CHIRP_LIMIT = CHIRP_LIMIT;

// Root collection for assignments. One document per (game, attacker, victim).
const ROOT_COLLECTION = 'speedBumpAssignments';

// ----------------------------------------------------------------------------
// 🧩 Helpers
// ----------------------------------------------------------------------------

function makeDocId(gameId, attackerId, victimId) {
  if (victimId) return `${gameId}__${attackerId}__${victimId}`;
  return `${gameId}__${attackerId}`;
}

function assertNonEmpty(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing or invalid ${fieldName}.`);
  }
}

function normalizeTeamId(id) {
  return typeof id === 'string' ? id.trim().toLowerCase() : '';
}

function normalizeStatus(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!v) return null;
  const match = Object.values(SPEEDBUMP_STATUS).find(s => s === v);
  return match || null;
}

function toMillis(value) {
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  return null;
}

async function fetchLatestByAttacker(gameId, attacker) {
  const colRef = collection(db, ROOT_COLLECTION);
  const q = query(
    colRef,
    where('gameId', '==', gameId),
    where('attackerId', '==', attacker),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const docs = [];
  snap.forEach(docSnap => docs.push(docSnap));
  return docs[0] || null;
}

async function assertAttackerFree(gameId, attacker) {
  const filters = [SPEEDBUMP_STATUS.PENDING, SPEEDBUMP_STATUS.ACTIVE];
  try {
    const colRef = collection(db, ROOT_COLLECTION);
    const q = query(
      colRef,
      where('gameId', '==', gameId),
      where('attackerId', '==', attacker),
      where('status', 'in', filters)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error('Attacker already has an active assignment.');
    }
  } catch (err) {
    // Fallback to defensive full scan on Firestore "in" limitations
    const assignments = await fetchAssignmentsForGame(gameId);
    const live = filterActiveLike(assignments);
    const busy = live.some(a => normalizeTeamId(a.attackerId) === attacker);
    if (busy) {
      throw new Error('Attacker already has an active assignment.');
    }
  }
}

async function assertVictimFree(gameId, victim) {
  const filters = [SPEEDBUMP_STATUS.PENDING, SPEEDBUMP_STATUS.ACTIVE];
  try {
    const colRef = collection(db, ROOT_COLLECTION);
    const q = query(
      colRef,
      where('gameId', '==', gameId),
      where('victimId', '==', victim),
      where('status', 'in', filters)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error('Victim is already slowed by an active assignment.');
    }
  } catch (err) {
    const assignments = await fetchAssignmentsForGame(gameId);
    const live = filterActiveLike(assignments);
    const busy = live.some(a => normalizeTeamId(a.victimId) === victim);
    if (busy) {
      throw new Error('Victim is already slowed by an active assignment.');
    }
  }
}

function throwRuleError(rule) {
  if (!rule || rule.allowed) return;
  switch (rule.reason) {
    case 'SHIELD':
      throw new Error('This team is shielded and cannot be attacked.');
    case 'ATTACKER_PROTECTED':
      throw new Error('This team is currently attacking with a SpeedBump and cannot be targeted.');
    case 'VICTIM_BUSY':
      throw new Error('Victim is currently slowed by a SpeedBump.');
    default:
      throw new Error(typeof rule.reason === 'string' && rule.reason.trim() ? rule.reason : 'Attack blocked.');
  }
}

// Fetch all assignments for a game, any status.
async function fetchAssignmentsForGame(gameId) {
  assertNonEmpty(gameId, 'gameId');

  const colRef = collection(db, ROOT_COLLECTION);
  const q = query(colRef, where('gameId', '==', gameId));
  const snap = await getDocs(q);

  const results = [];
  snap.forEach(docSnap => {
    results.push({ id: docSnap.id, ...docSnap.data() });
  });
  return results;
}

// Filter down to "live" assignments that matter for blocking
function filterActiveLike(assignments) {
  return assignments.filter(a =>
    a.status === SPEEDBUMP_STATUS.PENDING ||
    a.status === SPEEDBUMP_STATUS.ACTIVE ||
    a.status === SPEEDBUMP_STATUS.WAITING_RELEASE
  );
}

async function autoAdvanceIfExpired(docId, data) {
  const now = Date.now();
  const status = normalizeStatus(data?.status);
  const blockEndsAt = toMillis(data?.blockEndsAt);
  const releaseEndsAt = toMillis(data?.releaseEndsAt);

  if (status === SPEEDBUMP_STATUS.ACTIVE && Number.isFinite(blockEndsAt) && blockEndsAt <= now) {
    try {
      await updateDoc(doc(db, ROOT_COLLECTION, docId), {
        status: SPEEDBUMP_STATUS.EXPIRED,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.debug('⚠️ autoAdvanceIfExpired (block) failed:', err?.message || err);
    }
  }

  if (status === SPEEDBUMP_STATUS.WAITING_RELEASE && Number.isFinite(releaseEndsAt) && releaseEndsAt <= now) {
    try {
      await updateDoc(doc(db, ROOT_COLLECTION, docId), {
        status: SPEEDBUMP_STATUS.COMPLETED,
        updatedAt: serverTimestamp(),
        completedAt: serverTimestamp()
      });
    } catch (err) {
      console.debug('⚠️ autoAdvanceIfExpired (release) failed:', err?.message || err);
    }
  }
}

// ----------------------------------------------------------------------------
// 🎯 Public API
// ----------------------------------------------------------------------------

/**
 * Get all Speed Bump assignments for a game.
 * Used by control UI to render the table.
 */
export async function getGameSpeedBumps(gameId) {
  return fetchAssignmentsForGame(gameId);
}

/**
 * Subscribe to all Speed Bump assignments for a game.
 * callback(assignmentsArray)
 */
export function subscribeToGameSpeedBumps(gameId, callback) {
  assertNonEmpty(gameId, 'gameId');

  const colRef = collection(db, ROOT_COLLECTION);
  const q = query(colRef, where('gameId', '==', gameId));

  return onSnapshot(q, (snap) => {
    const results = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      autoAdvanceIfExpired(docSnap.id, data);
      results.push({ id: docSnap.id, ...data });
    });
    callback(results);
  });
}

/**
 * Check if a given team is currently involved in any live Speed Bump,
 * as attacker OR victim.
 */
export async function isTeamBusyWithSpeedBump(gameId, teamId) {
  assertNonEmpty(gameId, 'gameId');
  assertNonEmpty(teamId, 'teamId');

  const assignments = await fetchAssignmentsForGame(gameId);
  const live = filterActiveLike(assignments);
  const normalized = normalizeTeamId(teamId);

  return live.some(a =>
    normalizeTeamId(a.attackerId) === normalized ||
    normalizeTeamId(a.victimId) === normalized
  );
}

/**
 * Assign a Speed Bump from attacker → victim.
 * - attackerId cannot equal victimId
 * - attacker and victim cannot already be in an active Speed Bump
 * - prompt will be chosen from the bank if not provided
 * - attacking team "owns" the document and will later release the victim
 */
export async function assignSpeedBump({
  gameId,
  attackerId,
  victimId,
  prompt,
  promptId,
  exclusions = [],
  type = 'slowdown',
  contactName = null,
  contactPhone = null,
  contactEmail = null,
  status = SPEEDBUMP_STATUS.ACTIVE
}) {
  assertNonEmpty(gameId, 'gameId');
  assertNonEmpty(attackerId, 'attackerId');
  assertNonEmpty(victimId, 'victimId');

  const gameAllowed = await canUseWildCards(gameId);
  if (!gameAllowed) {
    console.warn('[SpeedBump] Ignoring assignment — game not active.');
    return { ok: false, reason: 'inactive_game' };
  }

  const attacker = normalizeTeamId(attackerId);
  const victim = normalizeTeamId(victimId);

  if (attacker === victim) {
    throw new Error('Attacker cannot target themselves.');
  }

  // Global attack rules (shield / attacker protected / victim busy)
  const rule = await canTeamBeAttacked(attacker, victim, 'speedbump');
  if (!rule.allowed) {
    if (rule.reason === 'SHIELD') {
      try {
        await ChatServiceV2.send({
          fromTeam: 'System',
          toTeam: attacker || 'Control',
          text: `🚫 Your Speed Bump was thwarted — ${victim} is shiny with Super Shield Wax.`,
          kind: 'system',
          meta: { origin: 'speedbump_shield_block' }
        });
      } catch (err) {
        console.debug('⚠️ speedbump shield chat failed:', err?.message || err);
      }
    }
    throwRuleError(rule);
  }

  await assertAttackerFree(gameId, attacker);
  await assertVictimFree(gameId, victim);

  // 1) Check if attacker already has a live Speed Bump
  const docId = makeDocId(gameId, attacker, victim);
  const ref = doc(db, ROOT_COLLECTION, docId);
  const existingSnap = await getDoc(ref);

  if (existingSnap.exists()) {
    const data = existingSnap.data();
    if (data.gameId === gameId &&
        (data.status === SPEEDBUMP_STATUS.PENDING ||
         data.status === SPEEDBUMP_STATUS.ACTIVE)) {
      throw new Error(`Attacker "${attacker}" already has an active Speed Bump.`);
    }
  }

  // 2) Check if victim is already involved in any live Speed Bump
  const assignments = await fetchAssignmentsForGame(gameId);
  const live = filterActiveLike(assignments);
  const victimBusy = live.some(a =>
    normalizeTeamId(a.victimId) === victim ||
    normalizeTeamId(a.attackerId) === victim
  );

  if (victimBusy) {
    throw new Error(`Victim "${victim}" is already involved in a Speed Bump.`);
  }

  // 3) Choose or validate prompt
  const bank = getSpeedBumpPromptBank();
  let chosenPrompt = (prompt && prompt.trim()) || null;

  if (!chosenPrompt) {
    // choose a random one, avoiding provided exclusions where possible
    chosenPrompt = getRandomSpeedBumpPrompt(exclusions);
  }

  if (!chosenPrompt || !bank.includes(chosenPrompt)) {
    // We keep this strict in Phase 1 so control UI doesn't drift from the bank
    throw new Error('Invalid or missing Speed Bump prompt.');
  }

  // 4) Persist assignment
  const nowStatus = status || SPEEDBUMP_STATUS.ACTIVE;
  const now = Date.now();
  const payload = {
    gameId,
    attackerId: attacker,
    victimId: victim,
    prompt: chosenPrompt,
    promptText: chosenPrompt,
    promptId: promptId || chosenPrompt,
    type,
    status: nowStatus,
    blockEndsAt: nowStatus === SPEEDBUMP_STATUS.ACTIVE ? now + BLOCK_DURATION_MS : null,
    releaseEndsAt: null,
    releaseRequestedAt: null,
    chirpCount: 0,
    attackerContactName: contactName,
    attackerContactPhone: contactPhone,
    attackerContactEmail: contactEmail,
    createdAt: serverTimestamp(),
    activatedAt: nowStatus === SPEEDBUMP_STATUS.ACTIVE ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
    completedAt: null
  };

  await setDoc(ref, payload, { merge: false });

  return {
    id: docId,
    ...payload
  };
}

/**
 * Mark an assignment as ACTIVE.
 * Typically called when the victim’s overlay actually shows up.
 */
export async function markSpeedBumpActive({ gameId, attackerId, victimId }) {
  assertNonEmpty(gameId, 'gameId');
  assertNonEmpty(attackerId, 'attackerId');

  const attacker = normalizeTeamId(attackerId);
  const docId = makeDocId(gameId, attacker, victimId);
  let ref = doc(db, ROOT_COLLECTION, docId);
  let snap = await getDoc(ref);

  if (!snap.exists()) {
    const latest = await fetchLatestByAttacker(gameId, attacker);
    if (!latest) throw new Error('No Speed Bump found for this attacker.');
    ref = latest.ref;
    snap = latest;
  }

  const data = snap.data();
  if (data.gameId !== gameId) {
    throw new Error('Speed Bump belongs to a different game.');
  }

  if (data.status !== SPEEDBUMP_STATUS.PENDING) {
    // We allow idempotency: if already active, just return.
    if (data.status === SPEEDBUMP_STATUS.ACTIVE) {
      return { id: docId, ...data };
    }
    throw new Error(`Cannot mark Speed Bump active from status "${data.status}".`);
  }

  const now = Date.now();
  const blockEndsAt = now + BLOCK_DURATION_MS;

  await updateDoc(ref, {
    status: SPEEDBUMP_STATUS.ACTIVE,
    activatedAt: serverTimestamp(),
    blockEndsAt,
    releaseRequestedAt: null,
    releaseEndsAt: null,
    updatedAt: serverTimestamp()
  });

  return {
    id: docId,
    ...data,
    status: SPEEDBUMP_STATUS.ACTIVE
  };
}

/**
 * Reshuffle the prompt for an attacker’s Speed Bump.
 * - Only allowed while PENDING
 * - Does NOT change victim or attacker
 */
export async function reshuffleSpeedBumpPrompt({
  gameId,
  attackerId,
  exclusions = []
}) {
  assertNonEmpty(gameId, 'gameId');
  assertNonEmpty(attackerId, 'attackerId');

  const attacker = normalizeTeamId(attackerId);
  const docId = makeDocId(gameId, attacker);
  const ref = doc(db, ROOT_COLLECTION, docId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error('No Speed Bump found for this attacker.');
  }

  const data = snap.data();
  if (data.gameId !== gameId) {
    throw new Error('Speed Bump belongs to a different game.');
  }

  if (data.status !== SPEEDBUMP_STATUS.PENDING) {
    throw new Error('Can only reshuffle prompts while Speed Bump is pending.');
  }

  const combinedExclusions = new Set([
    ...(exclusions || []),
    data.prompt
  ]);

  const newPrompt = getRandomSpeedBumpPrompt(Array.from(combinedExclusions));

  if (!newPrompt || newPrompt === data.prompt) {
    // no better option found, return unchanged
    return { id: docId, ...data };
  }

  await updateDoc(ref, {
    prompt: newPrompt,
    updatedAt: serverTimestamp()
  });

  return {
    id: docId,
    ...data,
    prompt: newPrompt
  };
}

/**
 * Complete a Speed Bump.
 * Canonical use: the **attacking team** frees the victim
 * from control UI or via some validation flow.
 */
export async function completeSpeedBump({ gameId, attackerId, victimId, assignmentId }) {
  assertNonEmpty(gameId, 'gameId');
  assertNonEmpty(attackerId, 'attackerId');

  const attacker = normalizeTeamId(attackerId);
  const computedId = assignmentId || makeDocId(gameId, attacker, victimId);
  let ref = doc(db, ROOT_COLLECTION, computedId);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    const latest = await fetchLatestByAttacker(gameId, attacker);
    if (!latest) throw new Error('No Speed Bump found for this attacker.');
    ref = latest.ref;
    snap = latest;
  }

  const data = snap.data();
  const resolvedId = ref.id;
  if (data.gameId !== gameId) {
    throw new Error('Speed Bump belongs to a different game.');
  }

  if (data.status === SPEEDBUMP_STATUS.COMPLETED ||
      data.status === SPEEDBUMP_STATUS.CANCELLED) {
    // Already terminal; idempotent
    return { id: resolvedId, ...data };
  }

  await updateDoc(ref, {
    status: SPEEDBUMP_STATUS.COMPLETED,
    updatedAt: serverTimestamp(),
    completedAt: serverTimestamp()
  });

  return {
    id: resolvedId,
    ...data,
    status: SPEEDBUMP_STATUS.COMPLETED
  };
}

/**
 * Cancel a Speed Bump entirely.
 * Control-panel-only tool: use for admin cleanup.
 */
export async function cancelSpeedBump({ gameId, attackerId, victimId, assignmentId }) {
  assertNonEmpty(gameId, 'gameId');
  assertNonEmpty(attackerId, 'attackerId');

  const attacker = normalizeTeamId(attackerId);
  const computedId = assignmentId || makeDocId(gameId, attacker, victimId);
  let ref = doc(db, ROOT_COLLECTION, computedId);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    const latest = await fetchLatestByAttacker(gameId, attacker);
    if (!latest) throw new Error('No Speed Bump found for this attacker.');
    ref = latest.ref;
    snap = latest;
  }

  const data = snap.data();
  const resolvedId = ref.id;
  if (data.gameId !== gameId) {
    throw new Error('Speed Bump belongs to a different game.');
  }

  if (data.status === SPEEDBUMP_STATUS.CANCELLED) {
    return { id: resolvedId, ...data };
  }

  await updateDoc(ref, {
    status: SPEEDBUMP_STATUS.CANCELLED,
    updatedAt: serverTimestamp()
  });

  return {
    id: resolvedId,
    ...data,
    status: SPEEDBUMP_STATUS.CANCELLED
  };
}

/**
 * Hard reset: clear ALL Speed Bumps for a game.
 * Use carefully – e.g., at game end / reset.
 */
export async function clearGameSpeedBumps(gameId) {
  assertNonEmpty(gameId, 'gameId');

  const assignments = await fetchAssignmentsForGame(gameId);
  const writePromises = assignments.map(a => {
    const ref = doc(db, ROOT_COLLECTION, a.id);
    return updateDoc(ref, {
      status: SPEEDBUMP_STATUS.CANCELLED,
      updatedAt: serverTimestamp()
    }).catch(() => {
      // best effort; ignore errors for now
    });
  });

  await Promise.all(writePromises);
  return assignments.length;
}

// ----------------------------------------------------------------------------
// 🧭 Compatibility layer for existing control UI (Phase 1)
// ----------------------------------------------------------------------------
const DEFAULT_GAME_ID = 'global';
const DEFAULT_ATTACKER = 'Game Master';

/**
 * Backward-compatible helper to allow the current control UI to trigger bumps
 * without attacker/game context. Uses DEFAULT_GAME_ID + DEFAULT_ATTACKER.
 */
export async function triggerSpeedBump(teamId, bumpType = 'slowdown', meta = {}) {
  const target = normalizeTeamId(teamId);
  if (!target) {
    throw new Error('triggerSpeedBump requires a valid teamId');
  }
  const gameId = typeof meta.gameId === 'string' && meta.gameId.trim()
    ? meta.gameId.trim()
    : DEFAULT_GAME_ID;
  const attackerId = typeof meta.attackerId === 'string' && meta.attackerId.trim()
    ? meta.attackerId.trim()
    : DEFAULT_ATTACKER;

  return assignSpeedBump({
    gameId,
    attackerId,
    victimId: target,
    prompt: meta.prompt,
    exclusions: meta.exclusions || [],
    type: bumpType,
    contactName: meta.contactName,
    contactPhone: meta.contactPhone,
    contactEmail: meta.contactEmail
  });
}

/**
 * Backward-compatible helper for clearing a bump in the simplified UI.
 * Attempts to mark the DEFAULT_ATTACKER document as completed.
 */
export async function clearSpeedBump(teamId, meta = {}) {
  const gameId = typeof meta.gameId === 'string' && meta.gameId.trim()
    ? meta.gameId.trim()
    : DEFAULT_GAME_ID;
  const attackerId = typeof meta.attackerId === 'string' && meta.attackerId.trim()
    ? meta.attackerId.trim()
    : DEFAULT_ATTACKER;

  try {
    return completeSpeedBump({ gameId, attackerId });
  } catch (err) {
    // best-effort fallback
    console.warn('[speedBumpService] clearSpeedBump fallback:', err);
    return cancelSpeedBump({ gameId, attackerId });
  }
}

/**
 * Backward-compatible status subscription: maps assignments to a Map(teamId -> payload).
 */
export function subscribeToSpeedBumpStatuses(callback = () => {}) {
  return subscribeToGameSpeedBumps(DEFAULT_GAME_ID, (assignments = []) => {
    const statusMap = new Map();
    assignments.forEach((entry) => {
      const victim = normalizeTeamId(entry.victimId || '');
      if (!victim) return;
      const active = entry.status === SPEEDBUMP_STATUS.PENDING || entry.status === SPEEDBUMP_STATUS.ACTIVE;
      statusMap.set(victim, {
        id: victim,
        type: entry.type || 'slowdown',
        active,
        status: entry.status,
        prompt: entry.prompt
      });
    });
    callback(statusMap);
  });
}

/**
 * Fetch active/pending assignments for a team (attacker or victim).
 */
export async function getTeamSpeedBumpAssignments(teamId, options = {}) {
  const normalizedTeam = normalizeTeamId(teamId);
  if (!normalizedTeam) return [];

  const statusSet = new Set(
    Array.isArray(options.statuses) && options.statuses.length
      ? options.statuses.map(s => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean)
      : [SPEEDBUMP_STATUS.PENDING, SPEEDBUMP_STATUS.ACTIVE]
  );

  const roleOpt = typeof options.role === 'string' ? options.role : 'any';
  const normalizedRole = ['attacker', 'victim'].includes(roleOpt) ? roleOpt : 'any';

  const results = new Map();

  async function collect(field) {
    const colRef = collection(db, ROOT_COLLECTION);
    const q = query(colRef, where(field, '==', normalizedTeam));
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const role =
        field === 'attackerId'
          ? 'attacker'
          : 'victim';
      const status = typeof data.status === 'string' ? data.status.toLowerCase() : '';
      if (!statusSet.has(status)) return;
      if (normalizedRole !== 'any' && role !== normalizedRole) return;
      results.set(docSnap.id, {
        id: docSnap.id,
        ...data,
        role
      });
    });
  }

  await Promise.all([collect('attackerId'), collect('victimId')]);
  return Array.from(results.values());
}

/**
 * Subscribe to assignments for a specific team (attacker or victim).
 * callback receives an array of normalized assignment objects with `role`.
 */
export function subscribeToTeamSpeedBumps(teamId, callback, options = {}) {
  const normalizedTeam = normalizeTeamId(teamId);
  if (!normalizedTeam || typeof callback !== 'function') return () => {};

  const statusSet = new Set(
    Array.isArray(options.statuses) && options.statuses.length
      ? options.statuses.map(s => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean)
      : [SPEEDBUMP_STATUS.PENDING, SPEEDBUMP_STATUS.ACTIVE]
  );
  const roleOpt = typeof options.role === 'string' ? options.role : 'any';
  const normalizedRole = ['attacker', 'victim'].includes(roleOpt) ? roleOpt : 'any';
  const gameFilter = typeof options.gameId === 'string' && options.gameId.trim()
    ? options.gameId.trim()
    : null;

  let attackerEntries = [];
  let victimEntries = [];

  const emit = () => {
    const merged = new Map();
    const process = (entries) => {
      entries.forEach(entry => {
        const status = typeof entry.status === 'string' ? entry.status.toLowerCase() : '';
        if (!statusSet.has(status)) return;
        if (normalizedRole !== 'any' && entry.role !== normalizedRole) return;
        const existing = merged.get(entry.id);
        if (!existing || existing.role !== 'victim') {
          // victim role wins if duplicated
          merged.set(entry.id, entry);
        }
      });
    };
    process(attackerEntries);
    process(victimEntries);
    callback(Array.from(merged.values()));
  };

  const mapSnapshot = (snap, role) => {
    const arr = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      autoAdvanceIfExpired(docSnap.id, data);

      if (gameFilter && data.gameId && data.gameId !== gameFilter) {
        return;
      }

      const normalizedStatus = normalizeStatus(data.status) || SPEEDBUMP_STATUS.PENDING;
      const blockEndsAtMs = toMillis(data.blockEndsAt);
      const releaseEndsAtMs = toMillis(data.releaseEndsAt);
      const expiresAtMs = normalizedStatus === SPEEDBUMP_STATUS.WAITING_RELEASE && Number.isFinite(releaseEndsAtMs)
        ? releaseEndsAtMs
        : Number.isFinite(blockEndsAtMs)
          ? blockEndsAtMs
          : null;

      arr.push({
        id: docSnap.id,
        ...data,
        status: normalizedStatus,
        role,
        promptText: data.promptText || data.prompt || data.challenge || '',
        attackerId: data.attackerId || data.attacker || data.by || '',
        victimId: data.victimId || data.victim || '',
        attackerContactName: data.attackerContactName || data.contactName || '',
        attackerContactPhone: data.attackerContactPhone || data.contactPhone || '',
        attackerContactEmail: data.attackerContactEmail || data.contactEmail || '',
        blockEndsAtMs,
        releaseEndsAtMs,
        expiresAtMs
      });
    });
    return arr;
  };

  const attackerRef = query(collection(db, ROOT_COLLECTION), where('attackerId', '==', normalizedTeam));
  const victimRef = query(collection(db, ROOT_COLLECTION), where('victimId', '==', normalizedTeam));

  const unsubAttacker = onSnapshot(attackerRef, (snap) => {
    attackerEntries = mapSnapshot(snap, 'attacker');
    emit();
  }, (err) => {
    console.warn('[speedBumpService] attacker subscription error:', err);
  });

  const unsubVictim = onSnapshot(victimRef, (snap) => {
    victimEntries = mapSnapshot(snap, 'victim');
    emit();
  }, (err) => {
    console.warn('[speedBumpService] victim subscription error:', err);
  });

  return (reason) => {
    try { unsubAttacker?.(reason); } catch {}
    try { unsubVictim?.(reason); } catch {}
  };
}

// ---------------------------------------------------------------------------
// Victim-side helpers
// ---------------------------------------------------------------------------

export async function requestSpeedBumpRelease({ gameId, assignmentId, attackerId, victimId }) {
  const docId = assignmentId || makeDocId(gameId || DEFAULT_GAME_ID, attackerId || '', victimId || '');
  const ref = doc(db, ROOT_COLLECTION, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Speed Bump not found.');
  const data = snap.data();
  const now = Date.now();
  const hasRequested = !!data.releaseRequestedAt;
  const releaseEndsAt = now + RELEASE_DURATION_MS;

  await updateDoc(ref, {
    status: SPEEDBUMP_STATUS.WAITING_RELEASE,
    releaseRequestedAt: hasRequested ? data.releaseRequestedAt : serverTimestamp(),
    releaseEndsAt,
    updatedAt: serverTimestamp()
  });

  try {
    if (data.attackerId) {
      await ChatServiceV2.send({
        fromTeam: data.victimId || victimId || 'Unknown',
        toTeam: data.attackerId,
        text: `✅ ${data.victimId || victimId || 'A team'} finished the Speed Bump and requests release.`,
        kind: 'system',
        meta: { origin: 'speedbump_release_request', assignmentId: docId }
      });
    }
  } catch (err) {
    console.debug('⚠️ Speed Bump release request chat failed:', err?.message || err);
  }

  return { id: docId, releaseEndsAt };
}

export async function markSpeedBumpCompletedByVictim({ gameId, assignmentId, attackerId, victimId }) {
  return requestSpeedBumpRelease({ gameId, assignmentId, attackerId, victimId });
}

export async function sendSpeedBumpChirp({ assignmentId, message, attackerId, victimId }) {
  if (!assignmentId) throw new Error('Missing assignment id for chirp.');
  const ref = doc(db, ROOT_COLLECTION, assignmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Speed Bump not found.');
  const data = snap.data();
  const currentCount = Number(data.chirpCount || 0);
  if (currentCount >= CHIRP_LIMIT) return { ok: false, reason: 'limit_reached' };

  await updateDoc(ref, {
    chirpCount: currentCount + 1,
    updatedAt: serverTimestamp()
  });

  try {
    const toTeam = data.attackerId || attackerId || 'Control';
    const fromTeam = data.victimId || victimId || 'Unknown';
    await ChatServiceV2.send({
      fromTeam,
      toTeam,
      text: message || 'Chirp! We are working on it.',
      kind: 'system',
      meta: { origin: 'speedbump_chirp', assignmentId }
    });
  } catch (err) {
    console.debug('⚠️ Speed Bump chirp chat failed:', err?.message || err);
  }

  return { ok: true, chirpCount: currentCount + 1, limit: CHIRP_LIMIT };
}

export async function expireSpeedBump({ assignmentId }) {
  if (!assignmentId) return;
  try {
    await updateDoc(doc(db, ROOT_COLLECTION, assignmentId), {
      status: SPEEDBUMP_STATUS.EXPIRED,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('⚠️ expireSpeedBump failed:', err?.message || err);
  }
}

/**
 * Allow attackers to release victims from player overlay context.
 */
export async function completeSpeedBumpByTeamContext(teamId, entryId) {
  const normalizedTeam = normalizeTeamId(teamId);
  if (!normalizedTeam) throw new Error('Team is required to complete a Speed Bump.');
  if (!entryId || typeof entryId !== 'string') throw new Error('Entry id is required.');

  const ref = doc(db, ROOT_COLLECTION, entryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Speed Bump assignment not found.');
  }
  const data = snap.data() || {};
  if (normalizeTeamId(data.attackerId) !== normalizedTeam) {
    throw new Error('Only the attacker can complete this challenge.');
  }
  const status = typeof data.status === 'string' ? data.status.toLowerCase() : '';
  if (status !== SPEEDBUMP_STATUS.ACTIVE) {
    throw new Error('Only active challenges can be completed.');
  }

  const gameId = data.gameId || (typeof entryId === 'string' && entryId.includes('__') ? entryId.split('__')[0] : null);
  if (!gameId) throw new Error('Game id missing on assignment.');

  return completeSpeedBump({
    gameId,
    attackerId: data.attackerId
  });
}

/**
 * Allow attackers to force-complete/release an active assignment.
 */
export async function releaseSpeedBumpEarly({ assignmentId, attackerId, victimId, gameId }) {
  const attacker = normalizeTeamId(attackerId);
  if (!assignmentId && (!attacker || !victimId)) {
    throw new Error('Missing assignment context to release Speed Bump.');
  }
  return completeSpeedBump({
    gameId: gameId || DEFAULT_GAME_ID,
    attackerId: attacker || attackerId,
    victimId: victimId ? normalizeTeamId(victimId) : undefined,
    assignmentId
  });
}
