// ============================================================================
// FILE: modules/chatManager/playerChat.state.js
// PURPOSE: Manages subscriptions, Firestore listeners, and teardown
// ============================================================================

import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../config.js';
import { clearRegistry, registerListener } from './registry.js';
import { listenForMyMessages } from './messageService.js';
import {
  subscribeAllTeamInventories,
  subscribeSurprisesForTeam,
  isShieldActive
} from '../teamSurpriseManager.js';
import { subscribeSpeedBumpsForAttacker } from '../speedBump/index.js';
import { updateSpeedBumpOverlay } from '../playerUI/overlays/speedBumpOverlay.js';
import { initializePlayerBugStrike } from '../playerBugStrike.js';

const defaultCounts = Object.freeze({
  flatTire: 0,
  bugSplat: 0,
  superShieldWax: 0,
  speedBump: 0
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

  clearRegistry('player');

  const teardownCallbacks = [];
  let activeTeamNames = [];
  let latestInventories = {};

  const rerender = () => {
    if (!ui.renderInventory) return;
    const combinedNames = new Set([
      ...Object.keys(latestInventories || {}),
      ...activeTeamNames,
      normalizedTeamName
    ]);
    const mergedInventories = {};
    combinedNames.forEach((name) => {
      if (!name) return;
      mergedInventories[name] = latestInventories?.[name] || {};
    });

    ui.renderInventory(mergedInventories, {
      currentTeamName: normalizedTeamName,
      available: latestPlayerCounts,
      teamNames: Array.from(combinedNames)
    });
  };

  const activeTeamsRef = doc(db, 'game', 'activeTeams');
  const unsubscribeActiveTeams = onSnapshot(activeTeamsRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      activeTeamNames = Array.isArray(data.list) ? data.list : [];
    } else {
      activeTeamNames = [];
    }
    rerender();
  });
  registerListener('player', unsubscribeActiveTeams);
  teardownCallbacks.push(() => {
    try { unsubscribeActiveTeams?.(); } catch (err) {
      console.debug('⚠️ Failed to detach active teams listener:', err);
    }
  });

  const unsubscribeInventories = subscribeAllTeamInventories((inventories = {}) => {
    latestInventories = inventories || {};
    rerender();
  });
  registerListener('player', unsubscribeInventories);
  teardownCallbacks.push(() => {
    try { unsubscribeInventories?.(); } catch (err) {
      console.debug('⚠️ Failed to detach team inventories listener:', err);
    }
  });

  const unsubscribeMine = subscribeSurprisesForTeam(normalizedTeamName, (payload = {}) => {
    latestPlayerCounts = {
      flatTire: Number(payload.flatTire) || 0,
      bugSplat: Number(payload.bugSplat) || 0,
      superShieldWax: Number(payload.superShieldWax) || 0,
      speedBump: Number(payload.speedBump) || 0
    };
    ui.renderPlayerInventory?.(latestPlayerCounts);
    rerender(); // Rerender to update disabled states
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

  const stopBugStrike = initializePlayerBugStrike(normalizedTeamName);
  teardownCallbacks.push(() => {
    try { stopBugStrike?.('player-state'); } catch (err) {
      console.debug('⚠️ Failed to detach bug strike listener:', err);
    }
  });

  initSpeedBumpListeners(normalizedTeamName, (entries = []) => {
    ui.renderOutgoing?.(Array.isArray(entries) ? entries : []);
  });
  teardownCallbacks.push(() => teardownSpeedBumpListeners());

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
