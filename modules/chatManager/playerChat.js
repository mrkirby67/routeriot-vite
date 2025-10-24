// ============================================================================
// FILE: modules/chatManager/playerChat.js
// PURPOSE: Player-facing chat UI setup and live opponent status
// ============================================================================

import { db } from '../config.js';
import { allTeams } from '../../data.js';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { clearRegistry, registerListener } from './registry.js';
import { sendMessage, sendPrivateSystemMessage, listenForMyMessages } from './messageService.js';
import {
  sendSpeedBumpFromPlayer,
  releaseSpeedBumpFromPlayer
} from '../speedBumpPlayer.js';
import { getCooldownRemaining, getActiveBump, subscribeSpeedBumps, subscribeSpeedBumpsForAttacker } from '../speedBumpManager.js';
import {
  subscribeTeamSurprises,
  decrementSurprise,
  SurpriseTypes,
  isShieldActive,
  activateShield,
  getShieldDurationMs,
  subscribeSurprisesForTeam,
  consumeSurprise,
  getShieldTimeRemaining
} from '../teamSurpriseManager.js';
import {
  loadFlatTireConfig,
  assignFlatTireTeam
} from '../flatTireManager.js';
import { getZoneDisplayName } from '../zoneManager.js';
import { showShieldHudTimer, hideShieldHudTimer } from '../playerUI/overlays.js';
import { escapeHtml } from '../utils.js';

const speedBumpSubscriptions = { unsubscribe: null, current: null };
const surpriseSubscriptions = { unsubscribe: null, counts: new Map() };
const SURPRISE_TYPES = [SurpriseTypes.FLAT_TIRE, SurpriseTypes.BUG_SPLAT, SurpriseTypes.WILD_CARD];
const SHIELD_BLOCK_MESSAGE = '🧼 Attack washed away — that fancy new SHIELD Wax held strong!';

function getShieldDurationMinutes() {
  const durationMs = getShieldDurationMs();
  const minutes = Math.round(durationMs / 60000);
  return Math.max(1, minutes || 0);
}

export async function setupPlayerChat(currentTeamName) {
  const opponentsTbody = document.getElementById('opponents-tbody');
  const chatLog = document.getElementById('team-chat-log');
  if (!opponentsTbody || !chatLog) return console.warn("⚠️ Chat elements missing on player page.");

  const teamSurprisesPanel = document.getElementById('team-surprises-body');
  let unsubscribeMySurprises = null;
  let unsubscribeOutgoingBumps = null;

  clearRegistry('player');
  clearRegistry('playerMessages');

  opponentsTbody.innerHTML = '';

  const activeSnap = await getDoc(doc(db, "game", "activeTeams"));
  const activeTeams = activeSnap.exists() ? activeSnap.data().list || [] : [];
  const playableTeams =
    activeTeams.length > 0
      ? activeTeams.filter(t => t !== currentTeamName)
      : allTeams.filter(t => t.name !== currentTeamName).map(t => t.name);

  playableTeams.forEach(teamName => {
    const row = document.createElement('tr');
    row.dataset.team = teamName;
    row.innerHTML = `
      <td>${escapeHtml(teamName)}</td>
      <td class="last-location">--</td>
      <td class="message-cell">
        <input type="text" class="chat-input" data-recipient-input="${teamName}"
               placeholder="Message ${teamName}...">
        <button class="send-btn" data-recipient="${teamName}">Send</button>
        <div class="surprise-counters">
          ${renderSurpriseCounter(SurpriseTypes.FLAT_TIRE)}
          ${renderSurpriseCounter(SurpriseTypes.BUG_SPLAT)}
          ${renderSurpriseCounter(SurpriseTypes.WILD_CARD)}
        </div>
        <div class="speedbump-actions">
          <button class="speedbump-send-btn" data-target="${teamName}" data-role="speedbump-send">🚧 Send Speed Bump</button>
          <button class="speedbump-release-btn" data-target="${teamName}" data-role="speedbump-release">🟢 Release Team</button>
        </div>
      </td>
    `;
    opponentsTbody.appendChild(row);
  });

  const renderPlayerSurprises = ({ flatTire = 0, bugSplat = 0, superShieldWax = 0 } = {}) => {
    if (!teamSurprisesPanel) return;
    const shieldActive = isShieldActive(currentTeamName);
    const remainingMs = getShieldTimeRemaining(currentTeamName);
    const flatDisplay = escapeHtml(String(flatTire));
    const bugDisplay = escapeHtml(String(bugSplat));
    const shieldDisplay = escapeHtml(String(superShieldWax));

    const actionMarkup = shieldActive
      ? `<div class="shield-status shield-active">🛡️ Active: ${Math.ceil(remainingMs / 1000)}s</div>`
      : (superShieldWax > 0
        ? `<button id="activate-shield-btn" class="shield-activate-btn">🛡️ Activate Super SHIELD Wax</button>`
        : `<div class="shield-status shield-empty">No SHIELD Wax remaining</div>`);

    teamSurprisesPanel.innerHTML = `
      <div class="wildcard-grid">
        <div class="wildcard-card">
          <span class="wildcard-label">Flat Tire</span>
          <strong>${flatDisplay}</strong>
        </div>
        <div class="wildcard-card">
          <span class="wildcard-label">Bug Splat</span>
          <strong>${bugDisplay}</strong>
        </div>
        <div class="wildcard-card">
          <span class="wildcard-label">Super SHIELD Wax</span>
          <strong>${shieldDisplay}</strong>
        </div>
      </div>
      ${actionMarkup}
    `;

    const button = document.getElementById('activate-shield-btn');
    if (button) {
      button.onclick = async () => {
        button.disabled = true;
        const consumed = await consumeSurprise(currentTeamName, SurpriseTypes.WILD_CARD, 1);
        if (!consumed) {
          button.disabled = false;
          return;
        }
        activateShield(currentTeamName);
        const ms = getShieldTimeRemaining(currentTeamName);
        showShieldHudTimer(ms);
      };
    }

    if (shieldActive && remainingMs > 0) {
      showShieldHudTimer(remainingMs);
    } else if (!shieldActive) {
      hideShieldHudTimer();
    }
  };

  if (teamSurprisesPanel) {
    renderPlayerSurprises();
    unsubscribeMySurprises = subscribeSurprisesForTeam(currentTeamName, (snapshot = {}) => {
      renderPlayerSurprises({
        flatTire: snapshot.flatTire ?? snapshot.counts?.flatTire ?? 0,
        bugSplat: snapshot.bugSplat ?? snapshot.counts?.bugSplat ?? 0,
        superShieldWax: snapshot.superShieldWax ?? snapshot.counts?.superShieldWax ?? snapshot.counts?.wildCard ?? 0
      });
    });
  }

  const renderOutgoingBumpTimers = (entries = []) => {
    const activeMap = new Map();
    entries.forEach(entry => {
      if (!entry?.toTeam) return;
      activeMap.set(entry.toTeam, Math.max(0, Number(entry.remainingMs) || 0));
    });

    opponentsTbody.querySelectorAll('tr[data-team]').forEach(row => {
      const targetTeam = row.dataset.team;
      const label = row.querySelector('.outgoing-bump-timer');
      const sendBtn = row.querySelector('.speedbump-send-btn');
      const remainingMs = activeMap.get(targetTeam);

      if (remainingMs !== undefined) {
        if (!label) {
          const tag = document.createElement('span');
          tag.className = 'outgoing-bump-timer';
          tag.textContent = '';
          const actions = row.querySelector('.speedbump-actions') || row.lastElementChild;
          if (actions) actions.appendChild(tag);
        }
        const targetLabel = row.querySelector('.outgoing-bump-timer');
        if (targetLabel) {
          const seconds = Math.ceil(remainingMs / 1000);
          targetLabel.textContent = seconds > 0 ? `⏳ ${seconds}s` : '⏳ Active';
        }
        if (sendBtn) {
          sendBtn.disabled = true;
          sendBtn.title = 'Speed bump active — wait for completion';
        }
      } else {
        label?.remove();
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.title = '';
        }
      }
    });
    updateSpeedBumpButtons(currentTeamName);
  };

  const teamStatusCol = collection(db, 'teamStatus');
  const teamStatusUnsub = onSnapshot(teamStatusCol, async (snapshot) => {
    if (snapshot.empty) {
      opponentsTbody.querySelectorAll('.last-location').forEach(cell => {
        cell.textContent = '--';
      });
      return;
    }

    const changes = snapshot.docChanges();
    await Promise.all(changes.map(async change => {
      const team = change.doc.id;
      const row = opponentsTbody.querySelector(`[data-team="${team}"]`);
      if (!row) return;

      const cell = row.querySelector('.last-location');
      if (!cell) return;

      if (change.type === 'removed') {
        cell.textContent = '--';
      } else if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        const zoneId = typeof data.lastKnownLocation === 'string'
          ? data.lastKnownLocation.trim()
          : '';
        let location = '--';
        if (zoneId) {
          try {
            location = await getZoneDisplayName(zoneId);
          } catch (err) {
            console.warn('⚠️ Zone label fallback for', zoneId, err);
            location = zoneId;
          }
        }
        cell.textContent = location;
      }
    }));
  });
  registerListener('player', teamStatusUnsub);

  opponentsTbody.addEventListener('click', async (event) => {
    const sendBtn = event.target.closest('.send-btn');
    if (sendBtn) {
      const recipient = sendBtn.dataset.recipient;
      const input = document.querySelector(`input[data-recipient-input="${recipient}"]`);
      const messageText = input.value.trim();
      if (!messageText) return;

      input.value = '';

      try {
        if (typeof window.sendTeamMessage === 'function') {
          window.sendTeamMessage(recipient, messageText);
        } else if (window.chatManager && typeof window.chatManager.sendTeamMessage === 'function') {
          window.chatManager.sendTeamMessage(recipient, messageText);
        } else {
          sendMessage(currentTeamName, recipient, messageText);
        }
      } catch (err) {
        console.error('💥 Error sending message:', err);
      }
      return;
    }

    const bumpSend = event.target.closest('.speedbump-send-btn');
    if (bumpSend) {
      const target = bumpSend.dataset.target;
      await sendSpeedBumpFromPlayer(currentTeamName, target);
      updateSpeedBumpButtons(currentTeamName);
      return;
    }

    const bumpRelease = event.target.closest('.speedbump-release-btn');
    if (bumpRelease) {
      const target = bumpRelease.dataset.target;
      await releaseSpeedBumpFromPlayer(target, currentTeamName);
      updateSpeedBumpButtons(currentTeamName);
    }

    const surpriseBtn = event.target.closest('button[data-action="use-surprise"]');
    if (surpriseBtn) {
      const type = surpriseBtn.dataset.type;
      const row = surpriseBtn.closest('tr[data-team]');
      if (!row) return;
      const targetTeam = row.dataset.team;
      await handleUseSurprise(currentTeamName, targetTeam, type);
    }
  });

  speedBumpSubscriptions.unsubscribe?.();
  speedBumpSubscriptions.current = currentTeamName;
  speedBumpSubscriptions.unsubscribe = subscribeSpeedBumps(() => updateSpeedBumpButtons(currentTeamName));
  updateSpeedBumpButtons(currentTeamName);

  surpriseSubscriptions.unsubscribe?.();
  surpriseSubscriptions.counts = new Map();
  surpriseSubscriptions.unsubscribe = subscribeTeamSurprises((entries = []) => {
    const map = new Map();
    entries.forEach(entry => {
      map.set(entry.teamName, entry.counts || {});
    });
    surpriseSubscriptions.counts = map;
    updateSurpriseCounters(currentTeamName);
  });

  renderOutgoingBumpTimers([]);
  unsubscribeOutgoingBumps?.();
  unsubscribeOutgoingBumps = subscribeSpeedBumpsForAttacker(currentTeamName, (list = []) => {
    renderOutgoingBumpTimers(list);
  });

  const shieldQuery = query(collection(db, 'communications'), where('type', '==', 'shieldWax'));
  const shieldUnsub = onSnapshot(shieldQuery, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'removed') return;
      const data = change.doc.data() || {};
      const targetTeam = data.to || data.targetTeam || data.recipient || data.teamName;
      let expiresAt = data.shieldExpiresAt;
      if (expiresAt && typeof expiresAt.toMillis === 'function') {
        expiresAt = expiresAt.toMillis();
      }
      if (targetTeam) {
        activateShield(targetTeam, expiresAt);
      }
    });
  });
  registerListener('player', shieldUnsub);

  const messagesCleanup = listenForMyMessages(currentTeamName, chatLog);

  return () => {
    clearRegistry('player');
    clearRegistry('playerMessages');
    messagesCleanup?.();
    speedBumpSubscriptions.unsubscribe?.();
    speedBumpSubscriptions.unsubscribe = null;
    speedBumpSubscriptions.current = null;
    surpriseSubscriptions.unsubscribe?.();
    surpriseSubscriptions.unsubscribe = null;
    unsubscribeMySurprises?.();
    unsubscribeMySurprises = null;
    unsubscribeOutgoingBumps?.();
    unsubscribeOutgoingBumps = null;
    hideShieldHudTimer();
  };
}

function updateSpeedBumpButtons(currentTeamName) {
  if (!speedBumpSubscriptions.current) return;
  document.querySelectorAll('#opponents-tbody tr[data-team]').forEach(row => {
    const targetTeam = row.dataset.team;
    const sendBtn = row.querySelector('.speedbump-send-btn');
    const releaseBtn = row.querySelector('.speedbump-release-btn');
    if (!sendBtn || !releaseBtn) return;

    const cooldownMs = getCooldownRemaining(currentTeamName, 'bump');
    if (cooldownMs > 0) {
      sendBtn.disabled = true;
      sendBtn.title = `Cooldown ${Math.ceil(cooldownMs / 1000)}s`;
    } else {
      sendBtn.disabled = false;
      sendBtn.title = '';
    }

    const activeState = getActiveBump(targetTeam);
    const isOwner = activeState && activeState.by === currentTeamName;
    const selfReleaseReady = activeState && targetTeam === currentTeamName && (!!activeState.countdownMs ? activeState.countdownMs <= 0 : Boolean(activeState.proofSentAt));
    const canRelease = Boolean(activeState) && (isOwner || selfReleaseReady);
    releaseBtn.disabled = !canRelease;
    if (isOwner) {
      releaseBtn.title = 'Release speed bump';
    } else if (selfReleaseReady) {
      releaseBtn.title = 'Countdown finished — self-release available.';
    } else {
      releaseBtn.title = 'Release becomes available after the proof timer finishes.';
    }
  });
}

function renderSurpriseCounter(type) {
  const icon = type === SurpriseTypes.FLAT_TIRE ? '🚗' : type === SurpriseTypes.BUG_SPLAT ? '🐞' : '🛡️';
  const label =
    type === SurpriseTypes.FLAT_TIRE ? 'Flat Tire' :
    type === SurpriseTypes.BUG_SPLAT ? 'Bug Splat' : 'Super SHIELD Wax';
  return `
    <div class="surprise-counter" data-type="${type}">
      <span class="surprise-icon">${icon}</span>
      <span class="surprise-label">${label}</span>
      <span class="surprise-count" data-role="surprise-count-${type}">0</span>
      <button type="button" class="surprise-use-btn" data-action="use-surprise" data-type="${type}" disabled>Use</button>
    </div>
  `;
}

function updateSurpriseCounters(currentTeamName) {
  const counts = surpriseSubscriptions.counts.get(currentTeamName) || {};
  document.querySelectorAll('#opponents-tbody tr[data-team]').forEach(row => {
    SURPRISE_TYPES.forEach(type => {
      const span = row.querySelector(`[data-role="surprise-count-${type}"]`);
      const button = row.querySelector(`button[data-action="use-surprise"][data-type="${type}"]`);
      const value = Number(counts[type] || 0);
      if (span) span.textContent = String(value);
      if (button) button.disabled = value <= 0;
    });
  });
}

async function handleUseSurprise(fromTeam, targetTeam, type) {
  if (!type || !SURPRISE_TYPES.includes(type)) return;
  if (fromTeam === targetTeam) {
    alert('Cannot use a surprise on your own team.');
    return;
  }
  const counts = surpriseSubscriptions.counts.get(fromTeam) || {};
  if ((counts[type] || 0) <= 0) {
    alert('No surprises remaining. Control can issue more.');
    return;
  }

  const isOffensive = type !== SurpriseTypes.WILD_CARD;
  if (isOffensive && isShieldActive(targetTeam)) {
    console.log(`🧼 Attack from ${fromTeam} blocked — ${targetTeam} is shielded.`);
    await sendPrivateSystemMessage(fromTeam, SHIELD_BLOCK_MESSAGE);
    return;
  }

  try {
    if (type === SurpriseTypes.FLAT_TIRE) {
      await triggerFlatTireSurprise(fromTeam, targetTeam);
    } else if (type === SurpriseTypes.BUG_SPLAT) {
      await triggerBugSplatSurprise(fromTeam, targetTeam);
    } else if (type === SurpriseTypes.WILD_CARD) {
      await triggerShieldWaxSurprise(fromTeam, targetTeam);
    }
    await decrementSurprise(fromTeam, type);
  } catch (err) {
    console.error('❌ Failed to use surprise:', err);
    alert(`Surprise failed: ${err.message || err}`);
  }
}

async function triggerFlatTireSurprise(fromTeam, targetTeam) {
  const config = await loadFlatTireConfig();
  const zones = Object.entries(config.zones || {}).filter(([, zone]) => zone?.gps);
  if (!zones.length) {
    throw new Error('No tow zones are configured yet. Ping Control.');
  }
  const [zoneKey, zone] = zones[Math.floor(Math.random() * zones.length)];
  await assignFlatTireTeam(targetTeam, {
    zoneKey,
    zoneName: zone.name,
    gps: zone.gps,
    assignedAt: Date.now(),
    autoReleaseMinutes: 20,
    status: 'player-surprise'
  });
  await broadcastSurprise(`${fromTeam} deployed a Flat Tire surprise on ${targetTeam}!`, {
    type: 'flatTire',
    from: fromTeam,
    to: targetTeam
  });
}

async function triggerBugSplatSurprise(fromTeam, targetTeam) {
  await broadcastSurprise(`🪰 ${fromTeam} splatted ${targetTeam} with a Bug Splat!`, {
    type: 'bugStrike',
    from: fromTeam,
    to: targetTeam,
    isBroadcast: true
  });
}

async function triggerShieldWaxSurprise(fromTeam, targetTeam) {
  const expiresAt = activateShield(targetTeam);
  const durationMinutes = getShieldDurationMinutes();
  await broadcastSurprise(`🛡️ ${fromTeam} coated ${targetTeam} in Super SHIELD Wax! Attacks bounce off for ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}.`, {
    type: 'shieldWax',
    from: fromTeam,
    to: targetTeam,
    isBroadcast: true,
    shieldExpiresAt: expiresAt,
    shieldDurationMinutes: durationMinutes
  });
}

async function broadcastSurprise(message, extras = {}) {
  await addDoc(collection(db, 'communications'), {
    teamName: extras.from || 'Game Master',
    sender: extras.from || 'Game Master',
    senderDisplay: extras.from || 'Game Master',
    message,
    timestamp: serverTimestamp(),
    ...extras
  });
}
