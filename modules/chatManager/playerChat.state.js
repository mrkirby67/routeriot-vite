// ============================================================================
// FILE: modules/chatManager/playerChat.state.js
// PURPOSE: Manages subscriptions, Firestore listeners, and teardown
// ============================================================================

import { allTeams } from '../../data.js';
import { clearRegistry, registerListener } from './registry.js';
import { listenForMyMessages } from './messageService.js';
import {
  subscribeTeamSurprises,
  subscribeSurprisesForTeam,
  isShieldActive
} from '../teamSurpriseManager.js';
import { subscribeSpeedBumpsForAttacker } from '../speedBump/index.js';
import { updateSpeedBumpOverlay } from '../playerUI/overlays/speedBumpOverlay.js';

const defaultCounts = Object.freeze({
  flatTire: 0,
  bugSplat: 0,
  superShieldWax: 0
});

let latestPlayerCounts = { ...defaultCounts };
let unsubscribeSpeedBump = null;

export function getLatestPlayerSurpriseCounts() {
  return { ...latestPlayerCounts };
}

export function setupPlayerChat(teamName, options = {}) {
  const ui = options?.ui || {};
  const normalizedTeamName =
    typeof teamName === 'string' && teamName.trim()
      ? teamName.trim()
      : 'Unknown Team';

  console.log(`💬 [playerChat.state] wiring listeners for ${normalizedTeamName}`);

  // Clear existing listeners before wiring new ones
  clearRegistry('player');

  const teardownCallbacks = [];
  let latestByTeam = {};
  const knownTeamNames = Array.from(
    new Set(allTeams.map((t) => t.name).filter(Boolean))
  );

  const applyTeamInventory = (byTeamSnapshot = {}) => {
    const merged = { ...byTeamSnapshot };
    knownTeamNames.forEach((name) => {
      if (!merged[name]) merged[name] = {};
    });

    console.log('🎯 Surprises snapshot', {
      byTeam: merged,
      currentTeamName: normalizedTeamName
    });

    ui.renderInventory?.(merged, {
      currentTeamName: normalizedTeamName,
      available: latestPlayerCounts,
      teamNames: knownTeamNames
    });
  };

  // --- Subscribe to all team surprises ---
  const unsubscribeTeams = subscribeTeamSurprises((entries, byTeam) => {
    latestByTeam = byTeam || {};
    applyTeamInventory(latestByTeam);
  });
  registerListener('player', unsubscribeTeams);
  teardownCallbacks.push(() => {
    try { unsubscribeTeams?.(); } catch (err) {
      console.debug('⚠️ Failed to detach team surprises listener:', err);
    }
  });

  // --- Subscribe to the current team's inventory ---
  const unsubscribeMine = subscribeSurprisesForTeam(normalizedTeamName, (payload = {}) => {
    latestPlayerCounts = {
      flatTire: Number(payload.flatTire) || 0,
      bugSplat: Number(payload.bugSplat) || 0,
      superShieldWax: Number(payload.superShieldWax) || 0
    };

    ui.renderPlayerInventory?.(latestPlayerCounts);
    applyTeamInventory(latestByTeam);

    if (isShieldActive(normalizedTeamName)) {
      ui.refreshShieldStatus?.();
    }
  });
  registerListener('player', unsubscribeMine);
  teardownCallbacks.push(() => {
    try { unsubscribeMine?.(); } catch (err) {
      console.debug('⚠️ Failed to detach personal surprises listener:', err);
    }
  });

  // --- Subscribe to outgoing speed bumps for this team ---
  initSpeedBumpListeners(normalizedTeamName, (entries = []) => {
    ui.renderOutgoing?.(Array.isArray(entries) ? entries : []);
  });
  teardownCallbacks.push(() => teardownSpeedBumpListeners());

  // --- Player message feed ---
  const logEl = document.getElementById('team-chat-log');
  if (logEl) {
    const stopMessages = listenForMyMessages(normalizedTeamName, logEl);
    if (typeof stopMessages === 'function') {
      teardownCallbacks.push(() => {
        try { stopMessages?.(); } catch (err) {
          console.debug('⚠️ Failed to detach message listener:', err);
        }
      });
    }
  }

  const teardown = (reason = 'manual') => {
    console.log(`🧹 [playerChat.state] tearing down (${reason})`);
    teardownCallbacks.splice(0).forEach((fn) => {
      try { fn?.(reason); } catch {}
    });
    clearRegistry('player');
  };

  return {
    teamName: normalizedTeamName,
    teardown
  };
}
export function initSpeedBumpListeners(teamName, onUpdate) {
  const normalized = typeof teamName === 'string' ? teamName.trim() : '';
  if (!normalized) return;

  if (typeof unsubscribeSpeedBump === 'function') {
    unsubscribeSpeedBump();
    unsubscribeSpeedBump = null;
  }

  unsubscribeSpeedBump = subscribeSpeedBumpsForAttacker(normalized, (assignments = []) => {
    console.log(`🎯 [SpeedBump][Attacker] snapshot for ${normalized}:`, assignments);
    updateSpeedBumpOverlay(assignments);
    try {
      onUpdate?.(assignments);
    } catch (err) {
      console.warn('[SpeedBump][Attacker] render callback failed:', err);
    }
  });
}

export function teardownSpeedBumpListeners() {
  if (typeof unsubscribeSpeedBump === 'function') {
    try {
      unsubscribeSpeedBump();
      console.log('[SpeedBump][Attacker] Listener detached');
    } catch (err) {
      console.debug('[SpeedBump][Attacker] detach error:', err);
    }
  }
  unsubscribeSpeedBump = null;
}
