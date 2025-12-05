// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/gameRulesManager.js
// PURPOSE: Persisted game rules and cross-feature orchestration helpers
// LAYER: services
// DEPENDS_ON: /core/config.js, firebase-firestore, modules/emailTeams.js
// AUTHOR: Route Riot – Game Rules
// CREATED: 2025-01-01
// AICP_VERSION: 1.0
// ============================================================================
// === END AICP SERVICE HEADER ===

import { db } from '/core/config.js';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { isTeamShielded } from '../modules/scoreboardManager.js';
import { emailAllTeams } from '../modules/emailTeams.js';
import { assignSpeedBump, SPEEDBUMP_STATUS } from './speed-bump/speedBumpService.js';
import { allTeams } from '../data.js';
import { getRacersByTeam } from '../modules/racerManagement.js';

const rulesRef = doc(db, 'config', 'gameRules');
const SPEEDBUMP_COLLECTION = 'speedBumpAssignments';
const LIVE_STATUSES = ['pending', 'active'];

export async function saveRules(rules) {
  try {
    console.log('Saving rules:', rules);
    await setDoc(rulesRef, rules, { merge: true });
    console.info('✅ Rules saved successfully.');
  } catch (err) {
    console.error('❌ Failed to save rules:', err);
  }
}

export async function loadRules() {
  try {
    const snap = await getDoc(rulesRef);
    if (snap.exists()) {
      const rules = snap.data();
      console.log('Loaded rules:', rules);
      console.info('📜 Rules loaded successfully.');
      return rules;
    }
    console.warn('⚠️ No rules found. Returning empty defaults.');
    return {};
  } catch (err) {
    console.error('❌ Failed to load rules:', err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Shield + SpeedBump protection helpers
// ---------------------------------------------------------------------------
export function isShielded(teamId) {
  if (!teamId) return false;
  return isTeamShielded(teamId);
}

async function hasLiveSpeedBump(field, teamId) {
  if (!teamId) return false;
  const colRef = collection(db, SPEEDBUMP_COLLECTION);
  const qy = query(colRef, where(field, '==', teamId));
  try {
    const snap = await getDocs(qy);
    let live = false;
    snap.forEach(docSnap => {
      const status = String(docSnap.data()?.status || '').toLowerCase();
      if (LIVE_STATUSES.includes(status)) {
        live = true;
      }
    });
    return live;
  } catch (err) {
    console.warn('[gameRulesManager] speed bump check failed:', err);
    return false;
  }
}

export async function attackerProtectedBySpeedBump(teamId) {
  return hasLiveSpeedBump('attackerId', teamId);
}

export async function victimBusyWithSpeedBump(teamId) {
  return hasLiveSpeedBump('victimId', teamId);
}

export async function canTeamBeAttacked(attackerId, victimId, attackType = 'attack') {
  const attacker = typeof attackerId === 'string' ? attackerId.trim() : '';
  const victim = typeof victimId === 'string' ? victimId.trim() : '';

  if (!attacker || !victim) {
    return { allowed: false, reason: 'INVALID' };
  }
  if (attacker === victim) {
    return { allowed: false, reason: 'Cannot target self.' };
  }

  if (isShielded(victim)) {
    return { allowed: false, reason: 'SHIELD' };
  }

  if (await attackerProtectedBySpeedBump(victim)) {
    return { allowed: false, reason: 'ATTACKER_PROTECTED' };
  }

  if (await victimBusyWithSpeedBump(victim)) {
    return { allowed: false, reason: 'VICTIM_BUSY' };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 🚦 Wild Card Gate — only allow when the core game is ACTIVE
// ---------------------------------------------------------------------------
export async function canUseWildCards(gameId = 'global') {
  try {
    const stateRef = doc(db, 'game', 'gameState');
    const snap = await getDoc(stateRef);
    if (!snap.exists()) return false;
    const data = snap.data() || {};
    const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
    return status === 'active';
  } catch (err) {
    console.warn(`[gameRulesManager] wild card gate failed for ${gameId}:`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 🟢 Game state helpers
// ---------------------------------------------------------------------------
export async function isGameActive(gameId = 'global') {
  return canUseWildCards(gameId);
}

async function getActiveTeamNames() {
  try {
    const activeSnap = await getDoc(doc(db, 'game', 'activeTeams'));
    if (activeSnap.exists()) {
      const list = Array.isArray(activeSnap.data()?.list) ? activeSnap.data().list : [];
      const clean = list.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
      if (clean.length) return clean;
    }
  } catch (err) {
    console.warn('[gameRulesManager] failed to read activeTeams:', err);
  }

  // Fallback to racers assignment if activeTeams is missing
  try {
    const racersSnap = await getDocs(collection(db, 'racers'));
    const teams = new Set();
    racersSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      if (data.team && data.team !== '-') teams.add(String(data.team).trim());
    });
    if (teams.size) return Array.from(teams);
  } catch (err) {
    console.warn('[gameRulesManager] failed to derive teams from racers:', err);
  }

  // Last-resort fallback: all defined teams
  return allTeams.map((t) => t.name);
}

// ---------------------------------------------------------------------------
// 🏁 Pre-race orchestration ("Racers Take Your Marks")
// ---------------------------------------------------------------------------
async function randomizeSpeedBumpsForGame(gameId = 'global', teams = []) {
  const roster = Array.isArray(teams) ? teams.slice().filter(Boolean) : [];
  if (roster.length < 2) {
    console.info('[Marks] Speed Bump shuffle skipped — need at least 2 teams.');
    return { ok: false, reason: 'not_enough_teams' };
  }

  // Shuffle roster
  for (let i = roster.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }

  let assigned = 0;
  for (let i = 0; i < roster.length; i += 1) {
    const attacker = roster[i];
    const victim = roster[(i + 1) % roster.length];
    if (!attacker || !victim || attacker === victim) continue;
    try {
      const attackerRacers = await getRacersByTeam(attacker);

      await assignSpeedBump({
        gameId,
        attackerId: attacker,
        victimId: victim,
        status: SPEEDBUMP_STATUS.PENDING,
        attackerContact: attackerRacers.map(r => ({ name: r.name, email: r.email, phone: r.cell }))
      });
      assigned += 1;
    } catch (err) {
      console.warn(`[Marks] Speed Bump assignment skipped for ${attacker} → ${victim}:`, err?.message || err);
    }
  }
  console.info(`[Marks] Speed Bump shuffle complete (${assigned} assignments).`);
  return { ok: true, assigned };
}

async function randomizeFlatTireTargets(gameId = 'global', teams = []) {
  // Placeholder: no safe auto-assignment logic defined; log and exit.
  console.info('[Marks] Flat Tire pre-race randomization not implemented (placeholder).');
  return { ok: true, assigned: 0 };
}

async function sendGameLinksToParticipants() {
  try {
    const racersSnap = await getDocs(collection(db, 'racers'));
    const racers = racersSnap.docs.map((d) => d.data() || {});
    const activeTeams = {};

    racers.forEach((r) => {
      if (r.team && r.team !== '-' && r.email) {
        const key = String(r.team).trim();
        if (!activeTeams[key]) activeTeams[key] = [];
        activeTeams[key].push(r);
      }
    });

    const teamNames = Object.keys(activeTeams);
    if (!teamNames.length) {
      console.info('[Marks] No racers with teams/emails to send links.');
      return { ok: false, reason: 'no_active_teams' };
    }

    let rulesText = '';
    try {
      const rulesSnap = await getDoc(rulesRef);
      rulesText = rulesSnap.exists() ? rulesSnap.data()?.content || '' : '';
    } catch (err) {
      console.warn('[Marks] Could not load rules text for emails:', err);
    }

    emailAllTeams(rulesText, activeTeams);
    console.info(`[Marks] Game links prepared for ${teamNames.length} team(s).`);
    return { ok: true, teams: teamNames.length };
  } catch (err) {
    console.error('[Marks] Failed to send game links:', err);
    return { ok: false, reason: err?.message || 'email_failed' };
  }
}

export async function runPreRaceMarksSequence(gameId = 'global') {
  const active = await isGameActive(gameId);
  if (!active) {
    console.warn('[Marks] Ignoring request — game is not active.');
    return { ok: false, reason: 'inactive_game' };
  }

  const teams = await getActiveTeamNames();
  const summary = { ok: true };

  try {
    summary.speedBumps = await randomizeSpeedBumpsForGame(gameId, teams);
  } catch (err) {
    console.error('[Marks] Speed Bump shuffle failed:', err);
    summary.speedBumps = { ok: false, reason: err?.message || 'speedbump_failed' };
  }

  try {
    summary.flatTires = await randomizeFlatTireTargets(gameId, teams);
  } catch (err) {
    console.error('[Marks] Flat Tire randomization failed:', err);
    summary.flatTires = { ok: false, reason: err?.message || 'flattire_failed' };
  }

  try {
    summary.links = await sendGameLinksToParticipants();
  } catch (err) {
    console.error('[Marks] Link/email step failed:', err);
    summary.links = { ok: false, reason: err?.message || 'links_failed' };
  }

  return summary;
}
