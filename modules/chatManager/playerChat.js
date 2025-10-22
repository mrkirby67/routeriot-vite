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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { clearRegistry, registerListener } from './registry.js';
import { sendMessage, listenForMyMessages } from './messageService.js';
import {
  sendSpeedBumpFromPlayer,
  releaseSpeedBumpFromPlayer
} from '../speedBumpPlayer.js';
import { getCooldownRemaining, getActiveBump, subscribeSpeedBumps } from '../speedBumpManager.js';

const speedBumpSubscriptions = { unsubscribe: null, current: null };

export async function setupPlayerChat(currentTeamName) {
  const opponentsTbody = document.getElementById('opponents-tbody');
  const chatLog = document.getElementById('team-chat-log');
  if (!opponentsTbody || !chatLog) return console.warn("⚠️ Chat elements missing on player page.");

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
      <td>${teamName}</td>
      <td class="last-location">--</td>
      <td class="message-cell">
        <input type="text" class="chat-input" data-recipient-input="${teamName}"
               placeholder="Message ${teamName}...">
        <button class="send-btn" data-recipient="${teamName}">Send</button>
        <div class="speedbump-actions">
          <button class="speedbump-send-btn" data-target="${teamName}" data-role="speedbump-send">🚧 Send Speed Bump</button>
          <button class="speedbump-release-btn" data-target="${teamName}" data-role="speedbump-release">🟢 Release Team</button>
        </div>
      </td>
    `;
    opponentsTbody.appendChild(row);
  });

  const teamStatusCol = collection(db, 'teamStatus');
  const teamStatusUnsub = onSnapshot(teamStatusCol, (snapshot) => {
    if (snapshot.empty) {
      opponentsTbody.querySelectorAll('.last-location').forEach(cell => {
        cell.textContent = '--';
      });
      return;
    }

    snapshot.docChanges().forEach(change => {
      const team = change.doc.id;
      const row = opponentsTbody.querySelector(`[data-team="${team}"]`);
      if (!row) return;

      const cell = row.querySelector('.last-location');
      if (!cell) return;

      if (change.type === 'removed') {
        cell.textContent = '--';
      } else if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        const location = data.lastKnownLocation || '--';
        cell.textContent = location;
      }
    });
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
  });

  speedBumpSubscriptions.unsubscribe?.();
  speedBumpSubscriptions.current = currentTeamName;
  speedBumpSubscriptions.unsubscribe = subscribeSpeedBumps(() => updateSpeedBumpButtons(currentTeamName));
  updateSpeedBumpButtons(currentTeamName);

  const messagesCleanup = listenForMyMessages(currentTeamName, chatLog);

  return () => {
    clearRegistry('player');
    clearRegistry('playerMessages');
    messagesCleanup?.();
    speedBumpSubscriptions.unsubscribe?.();
    speedBumpSubscriptions.unsubscribe = null;
    speedBumpSubscriptions.current = null;
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
