// ============================================================================
// FILE: modules/speedBumpManager.js
// PURPOSE: Shared helpers for sending, tracking, and releasing Speed Bumps
// NOTE: Uses broadcasts (communications collection) to sync state across clients.
// ============================================================================

import { broadcastEvent } from './zonesFirestore.js';
import { db } from './config.js';
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COOLDOWN_MS = 60_000;
const VALIDATION_MS = 5 * 60_000;

const activeBumps = new Map(); // teamName -> { by, challenge, startedAt, proofSentAt, countdownEndsAt }
const cooldowns = new Map(); // `${team}:${type}` -> expiresAt
const subscribers = new Set();
const processedMessages = new Set();
const validationTimers = new Map(); // teamName -> { expiresAt, timerId }

let commsUnsub = null;
let tickerId = null;

function ensureCommsListener() {
  if (commsUnsub || typeof window === 'undefined') return;
  const commsQuery = query(collection(db, 'communications'), orderBy('timestamp', 'desc'));
  commsUnsub = onSnapshot(commsQuery, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type !== 'added') return;
      const id = change.doc.id;
      if (processedMessages.has(id)) return;
      processedMessages.add(id);
      const data = change.doc.data();
      const rawMessage = (data?.message || '').toString();
      parseBroadcast(rawMessage);
    });
  });
}

function parseBroadcast(message) {
  if (!message) return;
  const speedBumpMatch = message.match(/Speed Bump: ([^]+?) challenged ([^!]+)! Challenge: ([^]+?)(?: —|\.|$)/);
  if (speedBumpMatch) {
    const [, fromTeam, toTeam, challengeRaw] = speedBumpMatch;
    const challenge = challengeRaw.trim();
    applySpeedBump(toTeam.trim(), {
      by: fromTeam.trim(),
      challenge,
      startedAt: Date.now(),
      proofSentAt: null,
      countdownEndsAt: null
    });
    return;
  }

  const releaseMatch = message.match(/Speed Bump Cleared: ([^]+?) is/);
  if (releaseMatch) {
    const [, team] = releaseMatch;
    clearValidationTimer(team.trim());
    activeBumps.delete(team.trim());
    notify();
    return;
  }

  const proofMatch = message.match(/Proof Sent: ([^|]+)\|([0-9]+)\|([0-9]+)/);
  if (proofMatch) {
    const [, team, expires, proofAt] = proofMatch;
    applyProofSent(team.trim(), Number(expires), Number(proofAt));
  }
}

function sanitize(text) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/</g, '')
    .replace(/>/g, '')
    .trim();
}

export async function sendSpeedBump(fromTeam, toTeam, challengeText, { override = false } = {}) {
  ensureCommsListener();
  const challenge = sanitize(challengeText) || 'Complete a surprise photo challenge!';
  const key = `${fromTeam}:bump`;
  const now = Date.now();
  if (!override && cooldowns.has(key) && cooldowns.get(key) > now) {
    const remaining = cooldowns.get(key) - now;
    return { ok: false, reason: Math.ceil(remaining / 1000) };
  }

  const message = `🚧 Speed Bump: ${fromTeam} challenged ${toTeam}! Challenge: ${challenge} — wait for their proof photo before releasing.`;
  await broadcastEvent('Game Master', message, true);

  applySpeedBump(toTeam, {
    by: fromTeam,
    challenge,
    startedAt: now,
    proofSentAt: null,
    countdownEndsAt: null
  });
  startCooldown(fromTeam, 'bump', override ? 0 : COOLDOWN_MS);
  return { ok: true };
}

export async function releaseSpeedBump(teamName, releasedBy = 'Game Master') {
  ensureCommsListener();
  clearValidationTimer(teamName);
  activeBumps.delete(teamName);
  const message = `🟢 Speed Bump Cleared: ${teamName} is back on the road! (Released by ${releasedBy})`;
  await broadcastEvent('Game Master', message, true);
  notify();
}

export async function markProofSent(teamName) {
  await startValidationTimer(teamName, VALIDATION_MS);
}

export async function startValidationTimer(teamName, durationMs = VALIDATION_MS) {
  const entry = activeBumps.get(teamName);
  if (!entry) return;
  const proofAt = Date.now();
  const expiresAt = proofAt + durationMs;
  applyProofSent(teamName, expiresAt, proofAt);
  const message = `📸 Proof Sent: ${teamName}|${expiresAt}|${proofAt}`;
  await broadcastEvent('Game Master', message, true);
}

export function startCooldown(teamName, type, durationMs = COOLDOWN_MS) {
  const key = `${teamName}:${type}`;
  const expiresAt = Date.now() + Math.max(0, durationMs);
  cooldowns.set(key, expiresAt);
  scheduleTicker();
  notify();
  return expiresAt;
}

export function getCooldownRemaining(teamName, type) {
  const key = `${teamName}:${type}`;
  const expiresAt = cooldowns.get(key);
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - Date.now());
}

export function isTeamBumped(teamName) {
  return activeBumps.has(teamName);
}

export function getActiveBump(teamName) {
  const bump = activeBumps.get(teamName);
  if (!bump) return null;
  const countdownMs = bump.countdownEndsAt ? Math.max(bump.countdownEndsAt - Date.now(), 0) : null;
  return { ...bump, countdownMs };
}

export function subscribeSpeedBumps(callback) {
  subscribers.add(callback);
  ensureCommsListener();
  notify();
  return () => subscribers.delete(callback);
}

export function getAllActiveBumps() {
  return Array.from(activeBumps.entries()).map(([teamName, data]) => ({
    teamName,
    ...data
  }));
}

function notify() {
  const payload = {
    activeBumps: Array.from(activeBumps.entries()),
    cooldowns: Array.from(cooldowns.entries()),
    validationTimers: Array.from(validationTimers.entries())
  };
  subscribers.forEach(fn => {
    try { fn(payload); } catch (err) { console.warn('speedBump subscriber error:', err); }
  });
}

function applySpeedBump(teamName, data) {
  clearValidationTimer(teamName);
  activeBumps.set(teamName, { ...data });
  notify();
}

function applyProofSent(teamName, expiresAt, proofTimestamp = Date.now()) {
  const current = activeBumps.get(teamName);
  if (!current) return;
  clearValidationTimer(teamName);
  const updated = {
    ...current,
    proofSentAt: proofTimestamp,
    countdownEndsAt: expiresAt
  };
  activeBumps.set(teamName, updated);
  scheduleValidationTimer(teamName, expiresAt);
  notify();
}

function scheduleValidationTimer(teamName, expiresAt) {
  if (!expiresAt) return;
  const remaining = Math.max(0, expiresAt - Date.now());
  const existing = validationTimers.get(teamName);
  if (existing?.timerId) clearTimeout(existing.timerId);
  const timerId = setTimeout(() => {
    validationTimers.delete(teamName);
    releaseSpeedBump(teamName, 'Auto Timer');
  }, remaining);
  validationTimers.set(teamName, { expiresAt, timerId });
}

function clearValidationTimer(teamName) {
  const entry = validationTimers.get(teamName);
  if (entry?.timerId) clearTimeout(entry.timerId);
  validationTimers.delete(teamName);
}

function scheduleTicker() {
  if (tickerId) return;
  tickerId = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [key, expiresAt] of cooldowns.entries()) {
      if (expiresAt <= now) {
        cooldowns.delete(key);
        changed = true;
      }
    }
    if (changed) notify();
    if (!cooldowns.size) {
      clearInterval(tickerId);
      tickerId = null;
    }
  }, 1000);
}
