// ============================================================================
// FILE: modules/speedBumpPlayer.js
// PURPOSE: Player-side hooks for Speed Bump overlays and quick triggers.
// ============================================================================

import {
  triggerSpeedBump,
  clearSpeedBump,
  subscribeToSpeedBump
} from '../services/speed-bump/speedBumpService.js';
import { showSpeedBumpOverlay } from '../ui/overlays/speedBumpOverlay.js';

let currentTeamId = null;
let currentTeamDisplay = null;
let unsubscribe = null;
let clearTimer = null;

function resetTimer() {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}

async function scheduleAutoClear(teamId, delayMs = 4_200) {
  resetTimer();
  if (!teamId) return;
  clearTimer = setTimeout(async () => {
    try {
      await clearSpeedBump(teamId);
    } catch (err) {
      console.warn('[speedBumpPlayer] failed to clear speed bump:', err);
    } finally {
      clearTimer = null;
    }
  }, delayMs);
}

function handleSpeedBumpUpdate(bump) {
  if (!bump || !bump.active) {
    resetTimer();
    return;
  }

  const type = typeof bump.type === 'string' && bump.type.trim() ? bump.type.trim() : 'Speed Bump';
  const teamLabel =
    (typeof bump.teamName === 'string' && bump.teamName.trim()) ||
    (typeof bump.team === 'string' && bump.team.trim()) ||
    (typeof bump.id === 'string' && bump.id.trim()) ||
    currentTeamDisplay ||
    'unknown team';
  console.info('🏎️ Speed Bump triggered:', { team: teamLabel, type });
  showSpeedBumpOverlay(type, { team: teamLabel });
  scheduleAutoClear(currentTeamId);
}

export function initializeSpeedBumpPlayer(teamName) {
  const normalizedTeam =
    typeof teamName === 'string' && teamName.trim() ? teamName.trim().toLowerCase() : null;
  const displayTeam = typeof teamName === 'string' && teamName.trim() ? teamName.trim() : null;
  currentTeamId = normalizedTeam;
  currentTeamDisplay = displayTeam;

  unsubscribe?.();
  resetTimer();

  if (!normalizedTeam) {
    console.warn('[speedBumpPlayer] initialize called without a team name');
    return () => {};
  }

  unsubscribe = subscribeToSpeedBump(
    normalizedTeam,
    handleSpeedBumpUpdate,
    (error) => console.warn('[speedBumpPlayer] speed bump subscription error:', error)
  );

  return (reason = 'manual') => {
    unsubscribe?.();
    unsubscribe = null;
    resetTimer();
    if (reason !== 'handover') {
      currentTeamId = null;
      currentTeamDisplay = null;
    }
  };
}

export async function sendSpeedBumpFromPlayer(fromTeam, targetTeam, type = 'slowdown') {
  const attacker =
    typeof fromTeam === 'string' && fromTeam.trim() ? fromTeam.trim().toLowerCase() : null;
  const defender =
    typeof targetTeam === 'string' && targetTeam.trim() ? targetTeam.trim().toLowerCase() : null;

  if (!attacker || !defender || attacker === defender) {
    return;
  }

  await triggerSpeedBump(defender, type, {
    teamName: typeof targetTeam === 'string' ? targetTeam.trim() : defender,
    triggeredBy: typeof fromTeam === 'string' ? fromTeam.trim() : attacker,
    origin: 'player'
  });
}
