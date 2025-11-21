// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/gameRulesManager.js
// PURPOSE: Persists game rule settings to Firestore and reloads them for control clients.
// DEPENDS_ON: /core/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js
// USED_BY: components/GameControls/GameControls.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP SERVICE HEADER ===

// ============================================================================
// PATCH: gameRulesManager.js — Persistent Game Rules
// ============================================================================

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
import { isShieldActive } from '../features/team-surprise/teamSurpriseState.js';

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
  return !!isShieldActive(teamId);
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
