// ============================================================================
// FILE: modules/speedBumpPlayer.js
// PURPOSE: Player-side hooks for Speed Bump overlays and quick triggers.
// ============================================================================

import {
  triggerSpeedBump,
} from '../services/speed-bump/speedBumpService.js';
import { ensureSpeedBumpOverlayListeners } from '../ui/overlays/speedBumpOverlay.js';

let currentTeamId = null;
let currentTeamDisplay = null;

export function initializeSpeedBumpPlayer(teamName) {
  const normalizedTeam =
    typeof teamName === 'string' && teamName.trim() ? teamName.trim().toLowerCase() : null;
  const displayTeam = typeof teamName === 'string' && teamName.trim() ? teamName.trim() : null;
  currentTeamId = normalizedTeam;
  currentTeamDisplay = displayTeam;

  if (!normalizedTeam) {
    console.warn('[speedBumpPlayer] initialize called without a team name');
    return () => {};
  }

  const teardownOverlay = ensureSpeedBumpOverlayListeners({ teamName });

  return (reason = 'manual') => {
    teardownOverlay(reason);
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
