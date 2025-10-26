// ============================================================================
// INTERACTIONS – send/release logic, subscriptions, notify, and attack flow
// ============================================================================

import { broadcastEvent } from '../zonesFirestore.js';
import {
  findTeamByName,
  sanitize,
  activeBumps,
  cooldowns,
  subscribers,
  interactionCooldowns,
  COOLDOWN_MS,
  WILD_CARD_DURATION_MS,
  VALIDATION_MS,
  INTERACTION_COOLDOWN_MS,
  normalizeTeamKey
} from './core.js';
import { ensureCommsListener } from './comms.js';
import {
  startWildCard,
  clearWildCard,
  isUnderWildCard,
  isOnCooldown,          // ✅ FIXED (was isTeamOnCooldown)
  isShieldActive,
  deactivateShield
} from '../teamSurpriseManager.js';
import {
  clearValidationTimer,
  scheduleValidationTimer,
  registerReleaseHandler
} from './timers.js';
import { handleReversal } from './reversals.js';
import { getRandomTaunt } from '../messages/taunts.js';
import { sendPrivateMessage } from '../chatManager/messageService.js';

let tickerId = null;

// ----------------------------------------------------------------------------
// 🧩 Apply / update / notify core state
// ----------------------------------------------------------------------------
export function applySpeedBump(teamName, data) {
  if (!teamName || !data) return;
  const key = teamName.trim();
  if (!key) return;
  const sanitizedData = {
    ...data,
    by: sanitize(data.by),
    challenge: sanitize(data.challenge),
    startedAt: data.startedAt ?? Date.now(),
    contactEmail: data.contactEmail ? sanitize(data.contactEmail) : null,
    contactPhone: data.contactPhone ? sanitize(data.contactPhone) : null
  };
  activeBumps.set(key, sanitizedData);
  startWildCard(key, 'speedBump', WILD_CARD_DURATION_MS);
  notify();
}

export function applyProofSent(teamName, expiresAt, proofAt = Date.now()) {
  const current = activeBumps.get(teamName);
  if (!current) return;
  activeBumps.set(teamName, {
    ...current,
    proofSentAt: proofAt,
    countdownEndsAt: expiresAt
  });
  scheduleValidationTimer(teamName, expiresAt);
  notify();
}

export function notify() {
  const payload = {
    activeBumps: Array.from(activeBumps.entries()),
    cooldowns: Array.from(cooldowns.entries())
  };
  subscribers.forEach(fn => {
    try {
      fn(payload);
    } catch (e) {
      console.warn('⚠️ speedBump notify error:', e);
    }
  });
}

// ----------------------------------------------------------------------------
// 🟢 Release + cooldown control
// ----------------------------------------------------------------------------
export async function releaseSpeedBump(teamName, releasedBy = 'Game Master') {
  const key = (teamName || '').trim();
  if (!key) return;
  ensureCommsListener();
  clearValidationTimer(key);
  clearWildCard(key);
  activeBumps.delete(key);
  const cleanTeam = sanitize(teamName) || key;
  const cleanActor = sanitize(releasedBy) || releasedBy || 'Game Master';
  await broadcastEvent(
    'Game Master',
    `🟢 Speed Bump Cleared: ${cleanTeam} (by ${cleanActor})`,
    true
  );
  notify();
}

// Used by comms parser to mirror releases without rebroadcast loops.
export function applyReleaseFromComms(teamName) {
  const key = (teamName || '').trim();
  if (!key) return;
  try { clearValidationTimer(key); } catch {}
  try { clearWildCard(key); } catch {}
  activeBumps.delete(key);
  notify();
}

// Register release handler with timers.js to avoid circular import
registerReleaseHandler(releaseSpeedBump);

// ----------------------------------------------------------------------------
// 🕒 Cooldown management
// ----------------------------------------------------------------------------
export function startCooldown(team, type, ms = COOLDOWN_MS) {
  const cleanTeam = (team || '').trim();
  const cleanType = (type || '').trim() || 'generic';
  if (!cleanTeam) return;
  const key = `${cleanTeam}:${cleanType}`;
  cooldowns.set(key, Date.now() + ms);
  scheduleTicker();
  notify();
}

export function getCooldownRemaining(team, type) {
  const cleanTeam = (team || '').trim();
  const cleanType = (type || '').trim() || 'generic';
  if (!cleanTeam) return 0;
  const key = `${cleanTeam}:${cleanType}`;
  const expiresAt = cooldowns.get(key);
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - Date.now());
}

// ----------------------------------------------------------------------------
// ⏱️ Internal ticker
// ----------------------------------------------------------------------------
function scheduleTicker() {
  if (tickerId) return;
  tickerId = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [key, exp] of cooldowns) {
      if (exp <= now) {
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

// ----------------------------------------------------------------------------
// 📊 Query helpers
// ----------------------------------------------------------------------------
export function isTeamBumped(teamName) {
  const key = (teamName || '').trim();
  if (!key) return false;
  return activeBumps.has(key);
}

export function getActiveBump(teamName) {
  const key = (teamName || '').trim();
  if (!key) return null;
  const bump = activeBumps.get(key);
  if (!bump) return null;
  const countdownMs = bump.countdownEndsAt
    ? Math.max(bump.countdownEndsAt - Date.now(), 0)
    : null;
  return { ...bump, countdownMs };
}

// ----------------------------------------------------------------------------
// 🔔 Subscription system
// ----------------------------------------------------------------------------
export function subscribeSpeedBumps(callback) {
  if (typeof callback !== 'function') return () => {};
  subscribers.add(callback);
  notify();
  return () => subscribers.delete(callback);
}

export function subscribeSpeedBumpsForAttacker(fromTeam, callback) {
  if (!fromTeam || typeof callback !== 'function') return () => {};
  const attacker = sanitize(fromTeam) || fromTeam;
  return subscribeSpeedBumps((payload = {}) => {
    const now = Date.now();
    const list = Array.isArray(payload.activeBumps)
      ? payload.activeBumps
          .map(([teamName, data]) => ({ teamName, ...(data || {}) }))
          .filter(entry => entry.by === attacker)
          .map(entry => {
            const targetTimestamp =
              entry.countdownEndsAt ??
              (entry.startedAt ? entry.startedAt + VALIDATION_MS : null);
            const remainingMs = targetTimestamp
              ? Math.max(0, targetTimestamp - now)
              : 0;
            return {
              toTeam: entry.teamName,
              remainingMs
            };
          })
      : [];
    try { callback(list); } catch {}
  });
}

// ----------------------------------------------------------------------------
// 🚧 Sending Speed Bumps
// ----------------------------------------------------------------------------
export async function sendSpeedBump(fromTeam, toTeam, challengeText, { override = false } = {}) {
  ensureCommsListener();

  const attacker = (fromTeam || '').trim();
  const defender = (toTeam || '').trim();
  if (!attacker || !defender) return { ok: false, reason: 'missing_team' };

  // ✅ FIXED: cooldown check
  if (isOnCooldown(attacker)) return { ok: false, reason: 'cooldown' };

  if (isUnderWildCard(attacker)) return { ok: false, reason: 'attacker_busy' };
  if (isUnderWildCard(defender)) return { ok: false, reason: 'target_busy' };

  if (isShieldActive(attacker)) {
    let proceed = true;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      proceed = window.confirm(
        "Now why would you get that new Polish tarnished with those dirty deeds? Proceeding will cancel your Shield."
      );
      if (!proceed) return { ok: false, reason: 'shield_cancelled' };
    }
    deactivateShield(attacker);
  }

  const challenge = (challengeText || '').trim() || 'Complete a surprise photo challenge!';
  const sanitizedAttacker = sanitize(attacker) || attacker;
  const sanitizedDefender = sanitize(defender) || defender;
  const sanitizedChallenge = sanitize(challenge);

  // reversal logic fix
  const reversal = findActiveBumpByAttacker(defender);
  if (reversal && !override) {
    handleReversal(defender, reversal.victimTeam, attacker, sanitizedChallenge);
    startCooldown(attacker, 'bump', COOLDOWN_MS);
    return { ok: true, reason: 'reversal_triggered' };
  }

  const { email: contactEmail, phone: contactPhone } = formatSenderContact(attacker);
  const sanitizedEmail = contactEmail ? sanitize(contactEmail) : '';
  const sanitizedPhone = contactPhone ? sanitize(contactPhone) : '';

  const messageLines = [
    `🚧 Speed Bump: ${sanitizedAttacker} challenged ${sanitizedDefender}!`,
    '',
    `Challenge: ${sanitizedChallenge}`
  ];
  if (sanitizedEmail) messageLines.push('', `Contact Email: ${sanitizedEmail}`);
  if (sanitizedPhone) messageLines.push('', `Contact Phone: ${sanitizedPhone}`);
  messageLines.push('', 'Reply with a proof photo/video to clear your Speed Bump!');

  await broadcastEvent('Game Master', messageLines.join('\n'), true);

  applySpeedBump(defender, {
    by: attacker,
    challenge: sanitizedChallenge,
    startedAt: Date.now(),
    contactEmail: sanitizedEmail || null,
    contactPhone: sanitizedPhone || null
  });

  startCooldown(attacker, 'bump', override ? 0 : COOLDOWN_MS);
  return { ok: true };
}

export async function markProofSent(teamName, durationMs = VALIDATION_MS) {
  const key = (teamName || '').trim();
  if (!key) return;
  const entry = activeBumps.get(key);
  if (!entry) return;
  const proofAt = Date.now();
  const expiresAt = proofAt + Math.max(0, Number(durationMs) || VALIDATION_MS);
  applyProofSent(key, expiresAt, proofAt);
  const cleanTeam = sanitize(teamName) || key;
  const message = `📸 Proof Sent: ${cleanTeam}|${expiresAt}|${proofAt}`;
  await broadcastEvent('Game Master', message, true);
}

export async function sendSpeedBumpChirp({ fromTeam, toTeam, message } = {}) {
  const sender = (fromTeam || '').trim();
  const recipient = (toTeam || '').trim();
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

// ----------------------------------------------------------------------------
// 🧠 Helper functions
// ----------------------------------------------------------------------------
export function findActiveBumpByAttacker(teamName) {
  const lookupRaw = (teamName || '').trim();
  if (!lookupRaw) return null;
  const lookup = sanitize(lookupRaw);
  for (const [victimTeam, data] of activeBumps.entries()) {
    if (data?.by === lookup) {
      return { victimTeam, data };
    }
  }
  return null;
}

export function formatSenderContact(senderTeamName) {
  const team = findTeamByName(senderTeamName);
  const email = team?.email ? sanitize(String(team.email).trim()) : '';
  const phone = team?.phone ? sanitize(String(team.phone).trim()) : '';
  return { email, phone };
}

function getInteractionKey(fromTeam, toTeam, type) {
  const senderKey = normalizeTeamKey(fromTeam);
  const targetKey = normalizeTeamKey(toTeam);
  if (!senderKey || !targetKey) return null;
  const category = typeof type === 'string' && type.trim()
    ? type.trim().toLowerCase()
    : 'generic';
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