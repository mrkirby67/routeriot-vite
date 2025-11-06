// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/team-surprise/teamSurpriseController.js
// PURPOSE: Orchestrates Team Surprise actions across UI, events, and services.
// DEPENDS_ON: ./teamSurpriseState.js, ./teamSurprise.bridge.js, ../../services/team-surprise/teamSurpriseService.js, ../../ui/team-surprise/teamSurpriseUI.js
// USED_BY: features/team-surprise/teamSurpriseController.js, components/TeamSurpriseManager/TeamSurpriseManager.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

import {
  SurpriseTypes,
  SHIELD_DURATION_STORAGE_KEY,
  DEFAULT_SHIELD_MINUTES,
  DEFAULT_COOLDOWN_MINUTES
} from './teamSurpriseTypes.js';
import {
  activeShields,
  activeWildCards,
  activeCooldowns,
  readShieldDurationMinutes,
  getShieldDurationMs,
  activateShield,
  isShieldActive as stateIsShieldActive,
  deactivateShield as stateDeactivateShield,
  getShieldTimeRemaining,
  isUnderWildCard,
  startWildCard,
  clearWildCard,
  startCooldown,
  resetSurpriseCaches
} from './teamSurpriseState.js';
import {
  normalizeSurpriseKey,
  subscribeTeamSurprises,
  incrementSurprise,
  decrementSurprise,
  resetSurpriseCounter,
  getTeamSurpriseCounts,
  increment,
  decrement,
  subscribeSurprisesForTeam,
  defaultSurpriseLabel,
  consumeSurprise,
  sendSurpriseToTeam,
  auditUse,
  deleteAllTeamSurpriseDocs,
  isOnCooldown,
  getCooldownTimeRemaining,
  subscribeAllCooldowns,
  subscribeAllTeamInventories
} from '../../services/team-surprise/teamSurpriseService.js';
import ChatServiceV2 from '../../services/ChatServiceV2.js';
import { registerSurpriseTriggerHandler } from './teamSurprise.bridge.js';

let uiModulePromise = null;

function loadUiModule() {
  if (!uiModulePromise) {
    uiModulePromise = import('../../ui/team-surprise/teamSurpriseUI.js');
  }
  return uiModulePromise;
}

export async function clearAllTeamSurprises() {
  resetSurpriseCaches();
  await deleteAllTeamSurpriseDocs();
}

export async function isTeamAttackable(teamName) {
  if (!teamName) return false;
  if (stateIsShieldActive(teamName)) return false;
  if (isUnderWildCard(teamName)) return false;
  return true;
}

export async function attemptSurpriseAttack({
  fromTeam,
  toTeam,
  type,
  onSuccess
}) {
  const normalizedType = normalizeSurpriseKey(type);
  const label = defaultSurpriseLabel(normalizedType || type);

  if (fromTeam && normalizedType) {
    try {
      await consumeSurprise(fromTeam, normalizedType, 1);
    } catch (err) {
      console.warn('⚠️ Failed to consume surprise for', fromTeam, normalizedType, err);
    }
  }

  const attackable = await isTeamAttackable(toTeam);
  if (!attackable) {
    try {
      ChatServiceV2.send({
        fromTeam: 'System',
        toTeam: fromTeam,
        text: `🚫 ${toTeam} was protected by a Shield / Wax. Your ${label} was blocked.`,
        kind: 'system'
      });
      ChatServiceV2.send({
        fromTeam: 'System',
        toTeam: toTeam,
        text: `✨ Your shiny wax protected you from a ${label} from ${fromTeam}.`,
        kind: 'system'
      });
    } catch (err) {
      console.debug('💬 shield-block notify failed:', err?.message || err);
    }
    return { ok: false, reason: 'shielded' };
  }

  if (typeof onSuccess === 'function') {
    await onSuccess();
  }

  try {
    ChatServiceV2.send({
      fromTeam: 'System',
      toTeam: fromTeam,
      text: `✅ ${toTeam} was successfully hit with ${label}.`,
      kind: 'system'
    });
    ChatServiceV2.send({
      fromTeam: 'System',
      toTeam: toTeam,
      text: `💥 You were hit by ${label} from ${fromTeam}!`,
      kind: 'system'
    });
  } catch (err) {
    console.debug('💬 success notify failed:', err?.message || err);
  }

  return { ok: true };
}

export function checkShieldBeforeAttack(teamName, onProceed) {
  return loadUiModule().then((mod) =>
    mod.checkShieldBeforeAttack(teamName, onProceed)
  );
}

export function isShieldActive(teamState) {
  if (typeof teamState === 'string') {
    return stateIsShieldActive(teamState);
  }
  return teamState?.shield?.active === true;
}

export function deactivateShield(teamState) {
  if (typeof teamState === 'string') {
    stateDeactivateShield(teamState);
    return teamState;
  }
  if (teamState?.shield) {
    teamState.shield.active = false;
    teamState.shield.deactivatedAt = Date.now();
  }
  return teamState;
}

registerSurpriseTriggerHandler((detail) => {
  if (!detail || typeof detail !== 'object') return undefined;
  return attemptSurpriseAttack(detail);
});

export {
  SurpriseTypes,
  SHIELD_DURATION_STORAGE_KEY,
  DEFAULT_SHIELD_MINUTES,
  DEFAULT_COOLDOWN_MINUTES
};

export {
  activeShields,
  activeWildCards,
  activeCooldowns,
  readShieldDurationMinutes,
  getShieldDurationMs,
  activateShield,
  getShieldTimeRemaining,
  isUnderWildCard,
  startWildCard,
  clearWildCard,
  startCooldown,
  resetSurpriseCaches
};

export {
  normalizeSurpriseKey,
  subscribeTeamSurprises,
  incrementSurprise,
  decrementSurprise,
  resetSurpriseCounter,
  getTeamSurpriseCounts,
  increment,
  decrement,
  subscribeSurprisesForTeam,
  defaultSurpriseLabel,
  consumeSurprise,
  sendSurpriseToTeam,
  auditUse,
  deleteAllTeamSurpriseDocs,
  isOnCooldown,
  getCooldownTimeRemaining,
  subscribeAllCooldowns,
  subscribeAllTeamInventories
};

export const isTeamOnCooldown = isOnCooldown;

// === AICP FEATURE FOOTER ===
// aicp_category: feature
// ai_origin: features/team-surprise/teamSurpriseController.js
// ai_role: Logic Layer
// codex_phase: tier2_features_injection
// export_bridge: components/*
// exports: clearAllTeamSurprises, isTeamAttackable, attemptSurpriseAttack, SurpriseTypes, SHIELD_DURATION_STORAGE_KEY, DEFAULT_SHIELD_MINUTES, DEFAULT_COOLDOWN_MINUTES, activeShields, activeWildCards, activeCooldowns, readShieldDurationMinutes, getShieldDurationMs, activateShield, isShieldActive, deactivateShield, getShieldTimeRemaining, isUnderWildCard, startWildCard, clearWildCard, startCooldown, resetSurpriseCaches, normalizeSurpriseKey, subscribeTeamSurprises, incrementSurprise, decrementSurprise, resetSurpriseCounter, getTeamSurpriseCounts, increment, decrement, subscribeSurprisesForTeam, defaultSurpriseLabel, consumeSurprise, sendSurpriseToTeam, auditUse, deleteAllTeamSurpriseDocs, isOnCooldown, getCooldownTimeRemaining, subscribeAllCooldowns, subscribeAllTeamInventories, checkShieldBeforeAttack
// linked_files: []
// owner: Route Riot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
