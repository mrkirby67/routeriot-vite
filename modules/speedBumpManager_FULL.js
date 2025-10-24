// ============================================================================
// FILE: modules/speedBump/index.js
// PURPOSE: Shared helpers for sending, tracking, and releasing Speed Bumps
// NOTE: Uses broadcasts (communications collection) to sync state across clients.
// ============================================================================

import { broadcastEvent } from './zonesFirestore.js';
import { db } from './config.js';
import { allTeams } from '../data.js';
import { escapeHtml } from './utils.js';
import { getRandomTaunt } from './messages/taunts.js';
import { sendPrivateMessage } from './chatManager/messageService.js';
import {
  isUnderWildCard,
  startWildCard,
  clearWildCard,
  isOnCooldown as isTeamOnCooldown,
  startCooldown as startGuardCooldown,
  isShieldActive,
  deactivateShield
} from './teamSurpriseManager.js';
import { showWreckedOverlay } from './playerUI/overlays.js';
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COOLDOWN_MS = 60_000;
const VALIDATION_MS = 5 * 60_000;
const INTERACTION_COOLDOWN_MS = 60_000;
const WILD_CARD_DURATION_MS = 90_000;
const REVERSAL_DELAY_MS = 10_000;

const TEAM_DIRECTORY = Array.isArray(allTeams)
  ? new Map(allTeams.map(team => [String(team?.name || '').trim(), team]))
  : new Map();

const activeBumps = new Map(); // teamName -> { by, challenge, startedAt, proofSentAt, countdownEndsAt }
const cooldowns = new Map(); // `${team}:${type}` -> expiresAt
const subscribers = new Set();
const processedMessages = new Set();
const validationTimers = new Map(); // teamName -> { expiresAt, timerId }
const interactionCooldowns = new Map(); // `${from}->${to}:${type}` -> last timestamp

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

function parseBroadcast(message = '') {
  if (!message) return;
  const speedBumpMatch = message.match(/Speed Bump:\s*([^\n]+?)\s+challenged\s+([^\n!]+)!/);
  if (speedBumpMatch) {
    const [, fromTeamRaw, toTeamRaw] = speedBumpMatch;
    const challengeMatch = message.match(/Challenge:\s*([^\n]+)/);
    const emailMatch = message.match(/Contact Email:\s*([^\n]+)/);
    const phoneMatch = message.match(/Contact Phone:\s*([^\n]+)/);

    const challenge = (challengeMatch?.[1] || '').trim();
    const contactEmail = (emailMatch?.[1] || '').trim();
    const contactPhone = (phoneMatch?.[1] || '').trim();
    applySpeedBump(toTeamRaw.trim(), {
      by: fromTeamRaw.trim(),
      challenge,
      startedAt: Date.now(),
      proofSentAt: null,
      countdownEndsAt: null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null
    });
    return;
  }

  const releaseMatch = message.match(/Speed Bump Cleared: ([^]+?) is/);
  if (releaseMatch) {
    const [, team] = releaseMatch;
    clearValidationTimer(team.trim());
    clearWildCard(team.trim());
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

function sanitizeForBroadcast(value) {
  return String(value || '')
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

function normalizeTeamKey(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function getInteractionKey(fromTeam, toTeam, type) {
  const senderKey = normalizeTeamKey(fromTeam);
  const targetKey = normalizeTeamKey(toTeam);
  if (!senderKey || !targetKey) return null;
  const category = typeof type === 'string' && type.trim() ? type.trim().toLowerCase() : 'generic';
  return `${senderKey}->${targetKey}:${category}`;
}

function getInteractionCooldownState(fromTeam, toTeam, type) {
  const key = getInteractionKey(fromTeam, toTeam, type);
  if (!key) return { key: null, remainingMs: 0 };
  const last = interactionCooldowns.get(key) || 0;
  const elapsed = Date.now() - last;
  const remainingMs = Math.max(0, INTERACTION_COOLDOWN_MS - elapsed);
  return { key, remainingMs };
}

function commitInteractionCooldown(key) {
  if (key) interactionCooldowns.set(key, Date.now());
}

function showGuardAlert(message) {
  if (!message) return;
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message);
  } else {
    console.warn(message);
  }
}

function requestShieldConfirm(message) {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  console.warn('Shield confirmation requested outside browser context; proceeding by default.');
  return true;
}

function interceptSpeedBump(attacker, victim) {
  if (!attacker || !victim) return false;
  if (isTeamOnCooldown(attacker)) {
    showGuardAlert('⏳ Your crew needs a breather before another attack!');
    return true;
  }
  if (isUnderWildCard(attacker)) {
    showGuardAlert('⚠️ You can’t attack while dealing with your own Wild Card!');
    return true;
  }
  if (isUnderWildCard(victim)) {
    showGuardAlert('⚠️ That team is already in trouble. Let them breathe!');
    return true;
  }
  if (isShieldActive(attacker)) {
    const proceed = requestShieldConfirm(
      "Now why would you get that new Polish tarnished with those dirty deeds? Proceeding will cancel your Shield."
    );
    if (!proceed) {
      return true;
    }
    deactivateShield(attacker);
  }
  return false;
}

function findActiveBumpByAttacker(teamName) {
  for (const [victimTeam, data] of activeBumps.entries()) {
    if (data?.by === teamName) {
      return { victimTeam, data };
    }
  }
  return null;
}

function handleReversal(priorAttacker, priorVictim, newAttacker, challenge) {
  console.log(`💥 Reversal triggered: ${newAttacker} attacked ${priorAttacker} while they had ${priorVictim}`);
  if (typeof document !== 'undefined' && typeof showWreckedOverlay === 'function') {
    showWreckedOverlay(priorAttacker, priorVictim, newAttacker);
  }
  const message = `💥 Instant Karma! ${newAttacker} attacked ${priorAttacker} mid-Speed-Bump — both got WRECKED!`;
  broadcastEvent('Game Master', message, false);

  setTimeout(() => {
    clearWildCard(priorVictim);
    clearValidationTimer(priorVictim);
    activeBumps.delete(priorVictim);
    notify();

    startWildCard(priorAttacker, 'speedBump', WILD_CARD_DURATION_MS);
    startGuardCooldown(priorAttacker);
    startGuardCooldown(priorVictim);

    const startedAt = Date.now();
    applySpeedBump(priorAttacker, {
      by: newAttacker,
      challenge,
      startedAt,
      proofSentAt: null,
      countdownEndsAt: null,
      contactEmail: null,
      contactPhone: null
    });

    sendPrivateMessage(priorAttacker, '🚧 You hit your own bump! Time to slow down.');
    sendPrivateMessage(priorVictim, '🛞 You’re free! The road’s clear again.');
    sendPrivateMessage(newAttacker, '😈 Instant Karma delivered!');
  }, REVERSAL_DELAY_MS);
}

export async function sendSpeedBumpChirp({ fromTeam, toTeam, message } = {}) {
  const sender = typeof fromTeam === 'string' ? fromTeam.trim() : '';
  const recipient = typeof toTeam === 'string' ? toTeam.trim() : '';
  if (!sender) return { ok: false, reason: 'missing_sender' };
  if (!recipient) return { ok: false, reason: 'missing_target' };

  const { key, remainingMs } = getInteractionCooldownState(sender, recipient, 'chirp');
  if (remainingMs > 0) {
    return {
      ok: false,
      reason: Math.ceil(remainingMs / 1000),
      retryInMs: remainingMs
    };
  }

  const trimmed = typeof message === 'string' ? message.trim() : '';
  const text = trimmed || getRandomTaunt('speedBump');

  try {
    const result = await sendPrivateMessage(sender, recipient, text);
    if (!result?.ok) {
      return { ok: false, reason: result?.reason || 'send_failed' };
    }
    commitInteractionCooldown(key);
    return { ok: true };
  } catch (err) {
    console.error('❌ Failed to send Speed Bump chirp:', err);
    return { ok: false, reason: err?.message || 'send_failed' };
  }
}

export function controlSendSpeedBumpChirp(targetTeam, customText) {
  return sendSpeedBumpChirp({
    fromTeam: 'Control',
    toTeam: targetTeam,
    message: customText
  });
}

export async function sendSpeedBump(fromTeam, toTeam, challengeText, { override = false } = {}) {
  ensureCommsListener();
  const challenge = normalizeChallenge(challengeText) || 'Complete a surprise photo challenge!';

  const attacker = typeof fromTeam === 'string' && fromTeam.trim() ? fromTeam.trim() : 'Unknown Team';
  const defender = typeof toTeam === 'string' && toTeam.trim() ? toTeam.trim() : 'Unknown Team';

  const { key: pairKey, remainingMs } = getInteractionCooldownState(attacker, defender, 'bump');
  if (remainingMs > 0) {
    return { ok: false, reason: Math.ceil(remainingMs / 1000) };
  }

  if (interceptSpeedBump(attacker, defender)) {
    return { ok: false, reason: 'guard_blocked' };
  }

  const cooldownKey = `${attacker}:bump`;
  const now = Date.now();
  if (!override && cooldowns.has(cooldownKey) && cooldowns.get(cooldownKey) > now) {
    const remaining = cooldowns.get(cooldownKey) - now;
    return { ok: false, reason: Math.ceil(remaining / 1000) };
  }

  const reversal = findActiveBumpByAttacker(defender);
  if (reversal && !override) {
    handleReversal(defender, reversal.victimTeam, attacker, challenge);
    startGuardCooldown(attacker);
    startCooldown(attacker, 'bump', override ? 0 : COOLDOWN_MS);
    commitInteractionCooldown(pairKey);
    startWildCard(defender, 'speedBump', WILD_CARD_DURATION_MS);
    return { ok: true, reason: 'reversal_triggered' };
  }

  const { email: senderEmail, phone: senderPhone } = formatSenderContact(attacker);
  const contactEmail = senderEmail && senderEmail !== 'not provided' ? sanitizeForBroadcast(senderEmail) : '';
  const contactPhone = senderPhone && senderPhone !== 'not provided' ? sanitizeForBroadcast(senderPhone) : '';

  const messageLines = [
    `🚧 Speed Bump: ${sanitizeForBroadcast(attacker)} challenged ${sanitizeForBroadcast(defender)}!`,
    '',
    `Challenge: ${challenge}`
  ];

  if (contactEmail) {
    messageLines.push('', `Contact Email: ${contactEmail}`);
  }
  if (contactPhone) {
    messageLines.push('', `Contact Phone: ${contactPhone}`);
  }

  messageLines.push('', 'Reply with a proof photo / video to clear your Speed Bump!');
  const message = messageLines.join('\n');

  await broadcastEvent('Game Master', message, true);

  applySpeedBump(defender, {
    by: attacker,
    challenge,
    startedAt: now,
    proofSentAt: null,
    countdownEndsAt: null,
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null
  });
  startCooldown(attacker, 'bump', override ? 0 : COOLDOWN_MS);
  commitInteractionCooldown(pairKey);
  startGuardCooldown(attacker);
  startWildCard(defender, 'speedBump', WILD_CARD_DURATION_MS);

  return { ok: true };
}

export async function releaseSpeedBump(teamName, releasedBy = 'Game Master') {
  ensureCommsListener();
  clearValidationTimer(teamName);
  clearWildCard(teamName);
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
  const email = typeof data?.contactEmail === 'string' ? data.contactEmail.trim() : '';
  const phone = typeof data?.contactPhone === 'string' ? data.contactPhone.trim() : '';
  activeBumps.set(teamName, {
    ...data,
    contactEmail: email || null,
    contactPhone: phone || null
  });
  startWildCard(teamName, 'speedBump', WILD_CARD_DURATION_MS);
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
