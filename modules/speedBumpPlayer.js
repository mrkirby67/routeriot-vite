// ============================================================================
// FILE: modules/speedBumpPlayer.js
// PURPOSE: Player-side hooks for Speed Bump interactions and overlays
// ============================================================================

import { getRandomSpeedBumpPrompt } from './speedBumpChallenges.js';
import {
  sendSpeedBump,
  releaseSpeedBump,
  subscribeSpeedBumps,
  getCooldownRemaining,
  getActiveBump
} from './speedBumpManager.js';
import {
  showSpeedBumpOverlay,
  hideSpeedBumpOverlay
} from './playerUI/overlays.js';

let currentTeamName = null;
let unsubscribe = null;

export function initializeSpeedBumpPlayer(teamName) {
  currentTeamName = teamName;
  unsubscribe?.();
  unsubscribe = subscribeSpeedBumps(handleStateUpdate);
  handleStateUpdate();
  return (reason = 'manual') => {
    unsubscribe?.();
    unsubscribe = null;
    hideSpeedBumpOverlay();
    if (reason !== 'handover') currentTeamName = null;
  };
}

function handleStateUpdate() {
  if (!currentTeamName) return;
  const active = getActiveBump(currentTeamName);
  if (active) {
    showSpeedBumpOverlay({
      by: active.by,
      challenge: active.challenge,
      onRelease: () => releaseSpeedBump(currentTeamName, `${currentTeamName} release`) 
    });
  } else {
    hideSpeedBumpOverlay();
  }
}

export async function sendSpeedBumpFromPlayer(fromTeam, targetTeam) {
  if (!fromTeam || !targetTeam || fromTeam === targetTeam) return;
  const cooldownMs = getCooldownRemaining(fromTeam, 'bump');
  if (cooldownMs > 0) {
    alert(`🚧 Speed Bump cooldown active (${Math.ceil(cooldownMs / 1000)} seconds remaining).`);
    return;
  }

  const defaultPrompt = getRandomSpeedBumpPrompt();
  const challenge = window.prompt('Enter a Speed Bump photo challenge:', defaultPrompt);
  if (!challenge) return;

  const result = await sendSpeedBump(fromTeam, targetTeam, challenge, { override: false });
  if (!result.ok) {
    const seconds = result.reason || Math.ceil(getCooldownRemaining(fromTeam, 'bump') / 1000);
    alert(`🚧 Speed Bump cooldown active (${seconds} seconds remaining).`);
  } else {
    alert(`🚧 Speed Bump sent to ${targetTeam}!`);
  }
}

export async function releaseSpeedBumpFromPlayer(targetTeam, releasingTeam) {
  const active = getActiveBump(targetTeam);
  if (!active || active.by !== releasingTeam) {
    alert('ℹ️ This team is not Speed Bumped by you.');
    return;
  }
  await releaseSpeedBump(targetTeam, releasingTeam);
}

export function getPlayerSpeedBumpState(teamName) {
  return getActiveBump(teamName);
}
