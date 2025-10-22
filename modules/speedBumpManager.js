// ============================================================================
// FILE: modules/speedBumpManager.js
// PURPOSE: Shared helpers for sending, tracking, and releasing Speed Bumps
// NOTE: Uses broadcasts (communications collection) to sync state across clients.
// ============================================================================

import { allTeams } from '../data.js';
import { broadcastEvent } from './zonesFirestore.js';
import { db } from './config.js';
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const COOLDOWN_MS = 60_000;

const activeBumps = new Map(); // teamName -> { by, challenge, startedAt }
const cooldowns = new Map(); // `${team}:${type}` -> expiresAt
const subscribers = new Set();
const processedMessages = new Set();

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
  const speedBumpMatch = message.match(/Speed Bump: ([^]+?) challenged ([^!]+)! Challenge: ([^]+)/);
  if (speedBumpMatch) {
    const [, fromTeam, toTeam, challengeRaw] = speedBumpMatch;
    const challenge = challengeRaw.trim();
    activeBumps.set(toTeam.trim(), {
      by: fromTeam.trim(),
      challenge,
      startedAt: Date.now()
    });
    notify();
    return;
  }

  const releaseMatch = message.match(/Speed Bump Cleared: ([^]+?) is/);
  if (releaseMatch) {
    const [, team] = releaseMatch;
    activeBumps.delete(team.trim());
    notify();
  }
}

function sanitize(text) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/</g, '')
    .replace(/>/g, '')
    .trim();
}

function buildMailto(toTeam, fromTeam, challenge) {
  const target = allTeams.find(t => t.name === toTeam) || {};
  const email = target.email || '';
  const subject = encodeURIComponent('Route Riot Speed Bump!');
  const body = encodeURIComponent(
    `Team ${fromTeam} just hit you with a Speed Bump!\n\nYour photo challenge: ${challenge}\n\nSend proof back to control to get released. Good luck!`
  );
  const base = email ? `mailto:${email}` : 'mailto:';
  return `${base}?subject=${subject}&body=${body}`;
}

function openDirectMessage(url) {
  try {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener');
    }
  } catch (err) {
    console.warn('⚠️ Unable to launch mailto window:', err);
  }
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

  const mailtoUrl = buildMailto(toTeam, fromTeam, challenge);
  openDirectMessage(mailtoUrl);

  const message = `🚧 Speed Bump: ${fromTeam} challenged ${toTeam}! Challenge: ${challenge}`;
  await broadcastEvent('Game Master', message, true);

  activeBumps.set(toTeam, { by: fromTeam, challenge, startedAt: now });
  startCooldown(fromTeam, 'bump', override ? 0 : COOLDOWN_MS);
  notify();
  return { ok: true };
}

export async function releaseSpeedBump(teamName, releasedBy = 'Game Master') {
  ensureCommsListener();
  activeBumps.delete(teamName);
  const message = `🟢 Speed Bump Cleared: ${teamName} is back on the road! (Released by ${releasedBy})`;
  await broadcastEvent('Game Master', message, true);
  notify();
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
  return activeBumps.get(teamName) || null;
}

export function subscribeSpeedBumps(callback) {
  subscribers.add(callback);
  ensureCommsListener();
  notify();
  return () => subscribers.delete(callback);
}

function notify() {
  const payload = {
    activeBumps: Array.from(activeBumps.entries()),
    cooldowns: Array.from(cooldowns.entries())
  };
  subscribers.forEach(fn => {
    try { fn(payload); } catch (err) { console.warn('speedBump subscriber error:', err); }
  });
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
