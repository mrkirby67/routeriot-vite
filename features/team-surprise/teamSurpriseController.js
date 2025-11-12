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
} from '/services/team-surprise/teamSurpriseTypes.js';
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
  resetSurpriseCaches,
  recordTeamAttackTimestamp,
  getLastTeamAttackTimestamp,
  setGlobalCooldownMs,
  getGlobalCooldown,
  setTeamActiveEffects,
  clearTeamActiveEffects
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
  subscribeAllTeamInventories,
  subscribeToGlobalCooldown,
  subscribeSpeedBumpAssignments,
  requestSpeedBumpRelease
} from '../../services/team-surprise/teamSurpriseService.js';
import ChatServiceV2 from '../../services/ChatServiceV2.js';
import { emit } from '/core/eventBus.js';
import { loadTeamSurpriseUI } from '@/core/lazyLoader.js';
import { registerSurpriseTriggerHandler } from './teamSurprise.bridge.js';

let uiModulePromise = null;
let unsubscribeGlobalCooldown = null;
const speedBumpEffectSubscriptions = new Map();
const activeSpeedBumpAttackers = new Map(); // attacker -> { victim }

function loadUiModule() {
  if (!uiModulePromise) {
    uiModulePromise = loadTeamSurpriseUI();
  }
  return uiModulePromise;
}

function initializeGlobalCooldownSubscription() {
  if (unsubscribeGlobalCooldown) return;
  try {
    unsubscribeGlobalCooldown = subscribeToGlobalCooldown((value) => {
      setGlobalCooldownMs(value);
    });
  } catch (err) {
    console.warn('⚠️ Failed to subscribe to global cooldown settings:', err);
  }
}

initializeGlobalCooldownSubscription();

function normalizeTeamName(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed;
}

function mapToOverlayType(rawType, normalizedType) {
  const candidate = normalizedType || (typeof rawType === 'string' ? rawType : '');
  switch (candidate) {
    case SurpriseTypes.FLAT_TIRE:
    case 'flat-tire':
      return 'flat-tire';
    case SurpriseTypes.SPEED_BUMP:
    case 'speed-bump':
      return 'speed-bump';
    case SurpriseTypes.BUG_SPLAT:
    case 'bug-strike':
    case 'bugStrike':
      return 'bug-strike';
    default:
      return 'cooldown';
  }
}

export async function clearAllTeamSurprises() {
  resetSurpriseCaches();
  await deleteAllTeamSurpriseDocs();
}

export async function isTeamAttackable(teamName, options = {}) {
  const detailsRequested = options?.details === true;
  const normalized = typeof teamName === 'string' ? teamName.trim() : '';

  if (!normalized) {
    const result = { allowed: false, type: 'invalid' };
    return detailsRequested ? result : false;
  }

  if (stateIsShieldActive(normalized)) {
    const result = { allowed: false, type: 'shield' };
    return detailsRequested ? result : false;
  }

  if (isUnderWildCard(normalized)) {
    const result = { allowed: false, type: 'wildcard' };
    return detailsRequested ? result : false;
  }

  const lastAttackTimestamp = getLastTeamAttackTimestamp(normalized);
  const cooldownMs = getGlobalCooldown();

  if (lastAttackTimestamp > 0 && cooldownMs > 0) {
    const elapsed = Date.now() - lastAttackTimestamp;
    if (elapsed < cooldownMs) {
      const remainingMs = Math.max(0, cooldownMs - elapsed);
      const result = {
        allowed: false,
        type: 'cooldown',
        remainingMs,
        lastAttackTimestamp
      };
      return detailsRequested ? result : false;
    }
  }

  return detailsRequested ? { allowed: true } : true;
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

  const attackStatus = await isTeamAttackable(toTeam, { details: true });
  if (!attackStatus.allowed) {
    if (attackStatus.type === 'shield' || attackStatus.type === 'wildcard') {
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
    }
    if (attackStatus.type === 'cooldown' && typeof document !== 'undefined') {
      try {
        emit('ui:overlay:show', {
          id: 'team-surprise',
          data: {
            type: mapToOverlayType(type, normalizedType),
            remainingMs: attackStatus.remainingMs ?? getGlobalCooldown()
          }
        });
      } catch (err) {
        console.debug('⚠️ Failed to render cooldown overlay:', err?.message || err);
      }
    }
    return { ok: false, blocked: true, reason: attackStatus };
  }

  if (typeof onSuccess === 'function') {
    await onSuccess();
  }
  recordTeamAttackTimestamp(toTeam);

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

function releaseAttackerLockForVictim(victimTeam) {
  const normalizedVictim = normalizeTeamName(victimTeam);
  if (!normalizedVictim) return;
  for (const [attacker, meta] of activeSpeedBumpAttackers.entries()) {
    if (meta?.victim === normalizedVictim) {
      activeSpeedBumpAttackers.delete(attacker);
      if (activeWildCards[attacker]?.type === 'speedBump') {
        clearWildCard(attacker);
      }
      break;
    }
  }
}

function applyAttackerLock(effect) {
  if (!effect) return;
  const attacker = normalizeTeamName(effect.attackerTeam || effect.attacker);
  if (!attacker) return;
  const victim = normalizeTeamName(effect.victimTeam || '');
  const deadline = Number(effect.releaseAvailableAt ?? effect.expiresAt ?? (effect.startedAt + effect.releaseDurationMs));
  const remaining = Number.isFinite(deadline) ? Math.max(30_000, deadline - Date.now()) : 5 * 60 * 1000;
  startWildCard(attacker, 'speedBump', remaining);
  activeSpeedBumpAttackers.set(attacker, { victim });
}

function attachSpeedBumpWatcher(teamName) {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) return () => {};
  const existing = speedBumpEffectSubscriptions.get(normalized);
  if (existing) {
    existing.count += 1;
    return (reason = 'speedbump') => {
      existing.count -= 1;
      if (existing.count <= 0) {
        try {
          existing.unsubscribe?.(reason);
        } catch (err) {
          console.debug('⚠️ Failed to cleanup speed bump watcher:', err);
        }
        speedBumpEffectSubscriptions.delete(normalized);
        clearTeamActiveEffects(normalized);
        releaseAttackerLockForVictim(normalized);
      }
    };
  }

  const unsubscribe = subscribeSpeedBumpAssignments(normalized, (effect) => {
    if (!effect) {
      clearTeamActiveEffects(normalized);
      releaseAttackerLockForVictim(normalized);
      return;
    }
    const enriched = { ...effect, victimTeam: normalized };
    setTeamActiveEffects(normalized, [enriched]);
    applyAttackerLock(enriched);
  });

  speedBumpEffectSubscriptions.set(normalized, { count: 1, unsubscribe });

  return (reason = 'speedbump') => {
    const entry = speedBumpEffectSubscriptions.get(normalized);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) {
      try {
        entry.unsubscribe?.(reason);
      } catch (err) {
        console.debug('⚠️ Failed to cleanup speed bump watcher:', err);
      }
      speedBumpEffectSubscriptions.delete(normalized);
      clearTeamActiveEffects(normalized);
      releaseAttackerLockForVictim(normalized);
    }
  };
}

export function ensureSpeedBumpEffectSubscription(teamName) {
  return attachSpeedBumpWatcher(teamName);
}

export async function markSpeedBumpChallengeComplete(teamName, options = {}) {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) {
    throw new Error('Unable to identify your team.');
  }
  const duration = Number(options.durationMs);
  return requestSpeedBumpRelease(normalized, Number.isFinite(duration) ? duration : 5 * 60 * 1000);
}

export async function sendSpeedBumpChirp({ fromTeam, toTeam, text } = {}) {
  const sender = normalizeTeamName(fromTeam);
  const recipient = normalizeTeamName(toTeam);
  const body = typeof text === 'string' ? text.trim() : '';

  if (!sender) {
    throw new Error('Missing sending team.');
  }
  if (!recipient) {
    throw new Error('Choose a team to chirp.');
  }
  if (!body) {
    throw new Error('Message cannot be empty.');
  }

  await ChatServiceV2.send({
    fromTeam: sender,
    toTeam: recipient,
    text: body,
    kind: 'private',
    meta: {
      effect: 'speedBump',
      targetTeam: recipient,
      origin: 'speedBumpOverlay'
    },
    extra: {
      type: 'speedBump',
      from: sender,
      to: recipient
    }
  });

  return { ok: true };
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
