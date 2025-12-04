// ============================================================================
// FILE: modules/chatManager/playerChat.state.js
// PURPOSE: Manages subscriptions, Firestore listeners, and teardown
// ============================================================================

import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '/core/config.js';
import { clearRegistry, registerListener } from './registry.js';
import { listenForMyMessages, sendPrivateMessage } from './messageService.js';
import ChatServiceV2 from '../../services/ChatServiceV2.js';
import {
  subscribeAllTeamInventories,
  subscribeSurprisesForTeam,
  isShieldActive
} from '../teamSurpriseManager.js';
import {
  subscribeToTeamSpeedBumps,
  releaseSpeedBumpEarly,
  SPEEDBUMP_STATUS
} from '../../services/speed-bump/speedBumpService.js';
import { updateSpeedBumpOverlay } from '../playerUI/overlays/speedBumpOverlay.js';
import { initializePlayerBugStrike } from '../playerBugStrike.js';

function toMillis(timestamp) {
  if (!timestamp) return Date.now();
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.seconds === 'number') {
    const base = timestamp.seconds * 1000;
    const nanos = Math.floor((timestamp.nanoseconds || 0) / 1e6);
    return base + nanos;
  }
  return Date.now();
}

function resolveGameId() {
  if (typeof window === 'undefined') return 'global';
  const candidates = [
    window.__rrGameId,
    window.__routeRiotGameId,
    window.sessionStorage?.getItem?.('activeGameId'),
    window.localStorage?.getItem?.('activeGameId')
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return 'global';
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const alreadyNormalized =
    typeof raw.sender === 'string' &&
    typeof raw.recipient === 'string' &&
    Object.prototype.hasOwnProperty.call(raw, 'timestampMs');
  if (alreadyNormalized) return raw;

  try {
    const docLike = {
      id: raw.id || `local-${Date.now()}`,
      data: () => raw
    };
    return ChatServiceV2.normalizeDoc(docLike);
  } catch (err) {
    console.warn('[playerChat.state] Failed to normalize message payload:', err);
    return null;
  }
}

function createChatLogAppender(logElement, teamName) {
  if (!logElement) return () => {};
  logElement.innerHTML = '';

  const renderedIds = new Set();
  const normalizedTeam = typeof teamName === 'string' ? teamName.trim().toLowerCase() : '';

  return (payload = {}) => {
    const items = Array.isArray(payload) ? payload : [payload];
    items.forEach((raw) => {
      const message = normalizeMessage(raw);
      if (!message) return;

      const messageId = message.id || message.messageId;
      if (!messageId || renderedIds.has(messageId)) return;
      renderedIds.add(messageId);

      const entry = document.createElement('p');
      const createdAtMs = toMillis(message.timestamp || message.createdAt || message.timestampMs);
      const timestampLabel = new Date(createdAtMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      const senderRaw =
        message.senderDisplay ||
        message.fromTeam ||
        message.sender ||
        'Unknown';
      const recipientRaw =
        message.toTeam ||
        message.recipient ||
        '';

      const sender = senderRaw.trim();
      const recipient = recipientRaw.trim();
      const senderKey = sender.toLowerCase();
      const recipientKey = recipient.toLowerCase();

      const isBroadcast =
        (recipient && recipient.toUpperCase() === 'ALL') || message.kind === 'broadcast';
      const isMine = normalizedTeam && senderKey === normalizedTeam;
      const isForMe = normalizedTeam && recipientKey === normalizedTeam;

      let prefix;
      if (isBroadcast) {
        prefix = `📣 ${sender || 'Broadcast'}`;
      } else if (isMine) {
        prefix = `You → ${recipient || 'Unknown'}`;
      } else if (isForMe) {
        prefix = `${sender || 'Unknown'} → You`;
      } else {
        prefix = `${sender || 'Unknown'} → ${recipient || 'Unknown'}`;
      }

      entry.textContent = `[${timestampLabel}] ${prefix}: ${message.text || ''}`;
      logElement.appendChild(entry);
      logElement.scrollTop = logElement.scrollHeight;
    });
  };
}

function attachTeamChatInputHandlers(teamName) {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-chat-button');
  const recipientInput = document.getElementById('chat-recipient');

  if (!chatInput) return null;

  const normalizedTeam =
    typeof teamName === 'string' && teamName.trim()
      ? teamName.trim()
      : '';

  if (!normalizedTeam) {
    console.warn('[playerChat.state] Missing team name for chat send handler.');
    return null;
  }

  let isSending = false;

  const resolveRecipient = () => {
    const raw = typeof recipientInput?.value === 'string' ? recipientInput.value.trim() : '';
    return raw || 'ALL';
  };

  const restoreButtonState = (originalLabel) => {
    if (!sendButton) return;
    setTimeout(() => {
      sendButton.textContent = originalLabel;
      sendButton.disabled = false;
      delete sendButton.dataset.loading;
      delete sendButton.dataset.error;
      sendButton.blur?.();
    }, sendButton.dataset.error === 'true' ? 1200 : 160);
  };

  const dispatchMessage = async () => {
    if (isSending) return;
    const text = chatInput.value?.trim();
    if (!text) return;

    isSending = true;
    const originalLabel = sendButton?.textContent || 'Send';

    if (sendButton) {
      sendButton.disabled = true;
      sendButton.dataset.loading = 'true';
      sendButton.textContent = 'Sending…';
    }

    try {
      await sendPrivateMessage(normalizedTeam, resolveRecipient(), text);
      chatInput.value = '';
    } catch (err) {
      console.error('❌ Failed to send team chat message:', err);
      if (sendButton) {
        sendButton.dataset.error = 'true';
        sendButton.textContent = 'Failed';
      }
    } finally {
      restoreButtonState(originalLabel);
      isSending = false;
    }
  };

  const handleButtonClick = (event) => {
    event.preventDefault();
    dispatchMessage();
  };

  const handleInputKeydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      dispatchMessage();
    }
  };

  sendButton?.addEventListener('click', handleButtonClick);
  chatInput.addEventListener('keydown', handleInputKeydown);

  return () => {
    sendButton?.removeEventListener('click', handleButtonClick);
    chatInput.removeEventListener('keydown', handleInputKeydown);
  };
}

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

  initSpeedBumpListeners(normalizedTeamName, (entries = [], meta = {}) => {
    const list = Array.isArray(entries) ? entries : [];
    ui.renderOutgoing?.(list, meta);
  });
  teardownCallbacks.push(() => teardownSpeedBumpListeners());

  const logEl = document.getElementById('team-chat-log');
  if (logEl) {
    const appendMessage = createChatLogAppender(logEl, normalizedTeamName);
    const stopMessages = listenForMyMessages(normalizedTeamName, appendMessage);
    if (typeof stopMessages === 'function') {
      teardownCallbacks.push(() => {
        try { stopMessages?.(); } catch (err) {
          console.debug('⚠️ Failed to detach message listener:', err);
        }
      });
    }
  }

  const detachChatInputHandlers = attachTeamChatInputHandlers(normalizedTeamName);
  if (typeof detachChatInputHandlers === 'function') {
    teardownCallbacks.push(() => {
      try { detachChatInputHandlers(); } catch (err) {
        console.debug('⚠️ Failed to detach chat input handlers:', err);
      }
    });
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
  const normalized = typeof teamName === 'string' ? teamName.trim().toLowerCase() : '';
  if (!normalized) return;
  const gameId = resolveGameId();

  if (typeof unsubscribeSpeedBump === 'function') {
    unsubscribeSpeedBump();
    unsubscribeSpeedBump = null;
  }

  const resolveTargetTs = (entry = {}) => {
    const status = String(entry.status || '').toLowerCase();
    const releaseMs = entry.releaseEndsAtMs ?? toMillis(entry.releaseEndsAt);
    const blockMs = entry.blockEndsAtMs ?? toMillis(entry.blockEndsAt);
    if (status === SPEEDBUMP_STATUS.WAITING_RELEASE && Number.isFinite(releaseMs)) {
      return releaseMs;
    }
    if (Number.isFinite(blockMs)) return blockMs;
    if (Number.isFinite(releaseMs)) return releaseMs;
    return null;
  };

  const handleRelease = async ({ assignmentId, victimId }) => {
    if (!assignmentId) return;
    try {
      await releaseSpeedBumpEarly({
        assignmentId,
        attackerId: normalized,
        victimId,
        gameId
      });
    } catch (err) {
      console.warn('⚠️ Failed to release Speed Bump early:', err);
    }
  };

  unsubscribeSpeedBump = subscribeToTeamSpeedBumps(normalized, (assignments = []) => {
    const attackerEntries = (assignments || []).filter(
      (entry) =>
        entry.role === 'attacker' &&
        [SPEEDBUMP_STATUS.ACTIVE, SPEEDBUMP_STATUS.WAITING_RELEASE].includes(entry.status)
    );

    const mappedForList = attackerEntries.map((entry) => {
      const targetTs = resolveTargetTs(entry);
      return {
        id: entry.id,
        victimId: entry.victimId || entry.victim || '',
        remainingMs: Number.isFinite(targetTs) ? Math.max(0, targetTs - Date.now()) : 0,
        status: entry.status,
        prompt: entry.promptText || entry.prompt || entry.challenge || '',
        targetTs
      };
    });

    updateSpeedBumpOverlay(
      attackerEntries.map((entry) => ({
        status: entry.status,
        attacker: entry.attackerId || entry.attacker,
        challenge: entry.promptText || entry.prompt || entry.challenge || '',
        expiresAt: resolveTargetTs(entry)
      }))
    );

    try {
      onUpdate?.(mappedForList, { onRelease: handleRelease });
    } catch (err) {
      console.warn('[SpeedBump][Attacker] render callback failed:', err);
    }
  }, { role: 'attacker', statuses: [SPEEDBUMP_STATUS.ACTIVE, SPEEDBUMP_STATUS.WAITING_RELEASE], gameId });
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
