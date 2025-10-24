// ============================================================================
// FILE: modules/speedBumpManager.js
// PURPOSE: Shared helpers for sending, tracking, and releasing Speed Bumps
// NOTE: Uses broadcasts (communications collection) to sync state across clients.
// ============================================================================

import { broadcastEvent } from './zonesFirestore.js';
import { db } from './config.js';
import { allTeams } from '../data.js';
import { escapeHtml } from './utils.js';
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COOLDOWN_MS = 60_000;
const VALIDATION_MS = 5 * 60_000;

const TEAM_DIRECTORY = Array.isArray(allTeams)
  ? new Map(allTeams.map(team => [String(team?.name || '').trim(), team]))
  : new Map();

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

function normalizeChallenge(text) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
}

function findTeamByName(name) {
  if (!name) return null;
  const key = String(name).trim();
  const direct = TEAM_DIRECTORY.get(key);
  if (direct) return direct;
  const lower = key.toLowerCase();
  for (const team of TEAM_DIRECTORY.values()) {
    if (team?.name && team.name.toLowerCase() === lower) return team;
  }
  return null;
}

function formatSenderContact(senderTeamName) {
  const team = findTeamByName(senderTeamName);
  const email = team?.email ? String(team.email).trim() : 'not provided';
  const phone = team?.phone ? String(team.phone).trim() : 'not provided';
  return { email: email || 'not provided', phone: phone || 'not provided' };
}

function getRecipientContact(teamName) {
  const team = findTeamByName(teamName);
  const email = team?.email ? String(team.email).trim() : null;
  const phone = team?.phone ? String(team.phone).trim() : null;
  return { email: email || null, phone: phone || null };
}

function openDirectMessage({ fromTeam, toTeam, challengeText }) {
  if (typeof window === 'undefined') return;

  const fromLabel = String(fromTeam || 'Unknown Team');
  const toLabel = String(toTeam || 'Recipient Team');
  const challenge = normalizeChallenge(challengeText) || 'Take a photo or video of the challenge';

  const { email: senderEmail, phone: senderPhone } = formatSenderContact(fromLabel);
  const { email: recipientEmail, phone: recipientPhone } = getRecipientContact(toLabel);

  const safeLines = [
    '🚧 Route Riot Speed Bump!',
    '',
    `From Team: ${escapeHtml(fromLabel)}`,
    `Sender Email: ${escapeHtml(senderEmail)}`,
    `Sender Phone: ${escapeHtml(senderPhone)}`,
    '',
    'Challenge:',
    escapeHtml(challenge),
    '',
    'Reply with a proof photo / video to clear your Speed Bump!'
  ];

  const encodedBody = encodeURIComponent(safeLines.join('\n'));
  const subject = encodeURIComponent('Route Riot Speed Bump!');

  let opened = false;

  if (recipientEmail) {
    const mailto = `mailto:${recipientEmail}?subject=${subject}&body=${encodedBody}`;
    try {
      window.open(mailto, '_blank');
      opened = true;
    } catch (err) {
      console.warn('⚠️ Failed to open mail client:', err);
    }
  } else if (recipientPhone) {
    const smsLink = `sms:${recipientPhone}?body=${encodedBody}`;
    try {
      window.open(smsLink, '_blank');
      opened = true;
    } catch (err) {
      console.warn('⚠️ Failed to open SMS client:', err);
    }
  }

  if (!opened) {
    const preview = safeLines.join('\n');
    const message = `⚠️ No contact info available for ${toLabel}. Copy the message below:\n\n${preview}`;
    window.alert(message);
  }
}

export async function sendSpeedBump(fromTeam, toTeam, challengeText, { override = false } = {}) {
  ensureCommsListener();
  const challenge = normalizeChallenge(challengeText) || 'Complete a surprise photo challenge!';
  const key = `${fromTeam}:bump`;
  const now = Date.now();
  if (!override && cooldowns.has(key) && cooldowns.get(key) > now) {
    const remaining = cooldowns.get(key) - now;
    return { ok: false, reason: Math.ceil(remaining / 1000) };
  }

  const { email: senderEmail, phone: senderPhone } = formatSenderContact(fromTeam);

  const message = `🚧 Speed Bump: ${fromTeam} challenged ${toTeam}! Challenge: ${challenge} — wait for their proof photo before releasing. Sender Email: ${senderEmail}. Sender Phone: ${senderPhone}.`;
  await broadcastEvent('Game Master', message, true);

  applySpeedBump(toTeam, {
    by: fromTeam,
    challenge,
    startedAt: now,
    proofSentAt: null,
    countdownEndsAt: null
  });
  startCooldown(fromTeam, 'bump', override ? 0 : COOLDOWN_MS);

  if (typeof window !== 'undefined') {
    try {
      openDirectMessage({ fromTeam, toTeam, challengeText: challenge });
    } catch (err) {
      console.warn('⚠️ Could not open direct message for Speed Bump:', err);
    }
  }
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

export function subscribeSpeedBumpsForAttacker(fromTeam, callback) {
  if (!fromTeam || typeof callback !== 'function') return () => {};
  return subscribeSpeedBumps((payload = {}) => {
    const now = Date.now();
    const list = Array.isArray(payload.activeBumps)
      ? payload.activeBumps
          .map(([teamName, data]) => ({ teamName, ...(data || {}) }))
          .filter(entry => entry.by === fromTeam)
          .map(entry => {
            const targetTimestamp = entry.countdownEndsAt ?? (entry.startedAt ? entry.startedAt + VALIDATION_MS : null);
            const remainingMs = targetTimestamp ? Math.max(0, targetTimestamp - now) : 0;
            return {
              toTeam: entry.teamName,
              remainingMs
            };
          })
      : [];
    try {
      callback(list);
    } catch (err) {
      console.warn('⚠️ speed bump attacker callback error:', err);
    }
  });
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
