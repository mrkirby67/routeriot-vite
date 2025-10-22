// ============================================================================
// File: modules/chatManager.js
// Purpose: Handles all chat and communication between teams & control
// Author: Route Riot Control - 2025 (teamName broadcast fix + Live Locations)
// UPDATED: Handles teamStatus deletions + chat clears gracefully
// ============================================================================

import { db } from './config.js';
import { allTeams } from '../data.js';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  collectionGroup,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GAME_MASTER_NAME = 'Game Master';
const listenerRegistry = {
  control: [],
  player: [],
  others: new Map(),
};

function safeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveSenderName(msg) {
  if (!msg || typeof msg !== 'object') return GAME_MASTER_NAME;
  const raw =
    (typeof msg.senderDisplay === 'string' && msg.senderDisplay.trim()) ? msg.senderDisplay.trim() :
    (typeof msg.sender === 'string' && msg.sender.trim()) ? msg.sender.trim() :
    (typeof msg.teamName === 'string' && msg.teamName.trim()) ? msg.teamName.trim() :
    null;
  return raw || GAME_MASTER_NAME;
}

function shouldRenderRaw(msg) {
  const senderName = resolveSenderName(msg);
  return Boolean(msg?.isBroadcast && senderName === GAME_MASTER_NAME);
}

function clearRegistry(key) {
  if (Array.isArray(listenerRegistry[key])) {
    if (!listenerRegistry[key].length) return;
    console.info(`🧹 [chatManager] detaching ${listenerRegistry[key].length} listener(s) for ${key}`);
    listenerRegistry[key].forEach(unsub => {
      try { unsub?.(); } catch {}
    });
    listenerRegistry[key] = [];
  } else if (listenerRegistry.others instanceof Map && listenerRegistry.others.has(key)) {
    const arr = listenerRegistry.others.get(key) || [];
    if (!arr.length) return;
    console.info(`🧹 [chatManager] detaching ${arr.length} listener(s) for group ${key}`);
    arr.forEach(unsub => {
      try { unsub?.(); } catch {}
    });
    listenerRegistry.others.delete(key);
  }
}

export function registerListener(key, unsub) {
  if (!unsub) return;
  if (Array.isArray(listenerRegistry[key])) {
    listenerRegistry[key].push(unsub);
  } else {
    if (!listenerRegistry.others.has(key)) listenerRegistry.others.set(key, []);
    listenerRegistry.others.get(key).push(unsub);
  }
}

// ============================================================================
// 🧭 CONTROL PAGE: Listen to ALL MESSAGES (visible to Game Master)
// ============================================================================
export async function listenToAllMessages() {
  const logBox = document.getElementById('communication-log');
  if (!logBox) return console.warn("⚠️ No #communication-log element found.");

  clearRegistry('control');

  const activeSnap = await getDoc(doc(db, "game", "activeTeams"));
  const activeTeams = activeSnap.exists() ? activeSnap.data().list || [] : [];

  const privateMessagesQuery = query(collectionGroup(db, 'messages'), orderBy('timestamp', 'asc'));
  const publicCommsQuery = query(collection(db, 'communications'), orderBy('timestamp', 'asc'));
  const controlAllQuery = query(collection(db, 'conversations', 'CONTROL_ALL', 'messages'), orderBy('timestamp', 'asc'));

  const allMessages = [];
  const messageIds = new Set();

  const renderLog = () => {
    allMessages.sort((a, b) => a.timestamp - b.timestamp);
    logBox.innerHTML = '';
    allMessages.forEach(msg => {
      const ts = msg.timestamp?.toMillis ? msg.timestamp.toMillis() : msg.timestamp;
      const time = new Date(ts).toLocaleTimeString();
      const entry = document.createElement('p');
      if (msg.isBroadcast || msg.recipient === 'ALL') {
        const senderName = resolveSenderName(msg);
        const senderDisplay =
          senderName !== GAME_MASTER_NAME
            ? `<strong style="color:#FFD700;">${safeHTML(senderName)}</strong>`
            : `<strong style="color:#fdd835;">${GAME_MASTER_NAME.toUpperCase()}</strong>`;
        const messageBody = shouldRenderRaw(msg)
          ? msg.message
          : safeHTML(msg.text || msg.message || '(no message)');
        entry.innerHTML = `
          <span style="color:#888;">[${time}]</span>
          ${senderDisplay}: ${messageBody}
        `;
      } else {
        entry.innerHTML = `
          <span style="color:#888;">[${time}]</span>
          <strong style="color:#FFD700;">${safeHTML(resolveSenderName(msg))}</strong> ➡️
          <strong style="color:#00CED1;">${safeHTML(msg.recipient || 'Unknown')}</strong>: ${safeHTML(msg.text || msg.message || '')}
        `;
      }
      logBox.appendChild(entry);
    });
    logBox.scrollTop = logBox.scrollHeight;
  };

  const processSnapshot = (snapshot) => {
    if (snapshot.empty) {
      logBox.innerHTML = '<p style="color:#888;">(No messages)</p>';
      allMessages.length = 0;
      messageIds.clear();
      return;
    }
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' && !messageIds.has(change.doc.id)) {
        messageIds.add(change.doc.id);
        const data = change.doc.data();
        data.timestamp = data.timestamp?.toMillis ? data.timestamp.toMillis() : data.timestamp;
        allMessages.push(data);
      }
    });
    renderLog();
  };

  registerListener('control', onSnapshot(privateMessagesQuery, processSnapshot));
  registerListener('control', onSnapshot(publicCommsQuery, processSnapshot));
  registerListener('control', onSnapshot(controlAllQuery, processSnapshot));

  return (reason = 'control-cleanup') => clearRegistry('control');
}

// ============================================================================
// 🗣️ PLAYER PAGE: Chat UI + Opponent Status + Message Handling
// ============================================================================
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
      </td>
    `;
    opponentsTbody.appendChild(row);
  });

  // 🛰️ Live Last Known Location Listener (handles clears)
  const teamStatusCol = collection(db, 'teamStatus');
  const teamStatusUnsub = onSnapshot(teamStatusCol, (snapshot) => {
    // Reset everyone to "--" if collection is cleared
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
        // 🔹 Team doc deleted → reset to --
        cell.textContent = '--';
      } else if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        const location = data.lastKnownLocation || '--';
        cell.textContent = location;
      }
    });
  });
  registerListener('player', teamStatusUnsub);

  // Hook up send buttons
  opponentsTbody.querySelectorAll('.send-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const recipient = e.target.dataset.recipient;
      const input = document.querySelector(`input[data-recipient-input="${recipient}"]`);
      const messageText = input.value.trim();
      if (messageText) {
        sendMessage(currentTeamName, recipient, messageText);
        input.value = '';
      }
    });
  });

  const messagesCleanup = listenForMyMessages(currentTeamName, chatLog);

  return () => {
    clearRegistry('player');
    clearRegistry('playerMessages');
    messagesCleanup?.();
  };
}

// ============================================================================
// 🚀 Send Message Between Teams
// ============================================================================
async function sendMessage(sender, recipient, text) {
  const sortedNames = [sender, recipient].sort();
  const convoId = `${sortedNames[0].replace(/\s/g, '')}_${sortedNames[1].replace(/\s/g, '')}`;
  const messagesRef = collection(db, 'conversations', convoId, 'messages');

  try {
    await addDoc(messagesRef, {
      sender,
      recipient,
      text,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("❌ Error sending message:", err);
  }
}

// ============================================================================
// 📡 Listen for My Messages (Player Side) + Broadcasts
// ============================================================================
function listenForMyMessages(myTeamName, logBox) {
  clearRegistry('playerMessages');
  const messagesRef = collectionGroup(db, 'messages');
  const sentQuery = query(messagesRef, where('sender', '==', myTeamName));
  const receivedQuery = query(messagesRef, where('recipient', '==', myTeamName));
  const broadcastQuery = query(collection(db, 'communications'), orderBy('timestamp', 'asc'));
  const controlAllQuery = query(collection(db, 'conversations', 'CONTROL_ALL', 'messages'), orderBy('timestamp', 'asc'));

  const allMessages = [];
  const messageIds = new Set();

  const renderLog = () => {
    allMessages.sort((a, b) => a.timestamp - b.timestamp);
    logBox.innerHTML = '';

    if (allMessages.length === 0) {
      logBox.innerHTML = '<p style="color:#888;">(No messages yet)</p>';
      return;
    }

    allMessages.forEach(msg => {
      const ts = msg.timestamp?.toMillis ? msg.timestamp.toMillis() : msg.timestamp;
      const time = new Date(ts).toLocaleTimeString();
      const entry = document.createElement('p');

      if (msg.isBroadcast || msg.recipient === 'ALL') {
        const senderName = resolveSenderName(msg);
        const senderDisplay =
          senderName !== GAME_MASTER_NAME
            ? `<strong style="color:#FFD700;">${safeHTML(senderName)}</strong>`
            : `<strong style="color:#fdd835;">${GAME_MASTER_NAME.toUpperCase()}</strong>`;
        entry.style.backgroundColor = '#3a3a24';
        entry.style.padding = '8px';
        entry.style.borderRadius = '5px';
        entry.style.margin = '5px 0';
        const messageBody = shouldRenderRaw(msg)
          ? msg.message
          : safeHTML(msg.text || msg.message || '(no message)');
        entry.innerHTML = `
          <span style="color: #aaa;">[${time}]</span>
          ${senderDisplay}: <span style="font-weight:bold;">${messageBody}</span>
        `;
      } else {
        const senderName = resolveSenderName(msg);
        const isMine = senderName === myTeamName;
        const color = isMine ? '#FFD700' : '#00CED1';
        const otherParty = isMine ? (msg.recipient || 'Unknown') : senderName || 'Unknown';
        const prefix = isMine
          ? `<strong style="color:${color};">You ➡️ ${safeHTML(msg.recipient || 'Unknown')}:</strong>`
          : `<strong style="color:${color};">${safeHTML(otherParty)} ➡️ You:</strong>`;
        entry.innerHTML = `${prefix} ${safeHTML(msg.text || msg.message || '')} <span style="color:#888;">(${time})</span>`;
      }
      logBox.appendChild(entry);
    });
    logBox.scrollTop = logBox.scrollHeight;
  };

  const processSnapshot = (snapshot) => {
    if (snapshot.empty) {
      allMessages.length = 0;
      messageIds.clear();
      renderLog();
      return;
    }
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' && !messageIds.has(change.doc.id)) {
        const data = change.doc.data();
        data.timestamp = data.timestamp?.toMillis ? data.timestamp.toMillis() : data.timestamp;
        messageIds.add(change.doc.id);
        allMessages.push(data);
      } else if (change.type === 'removed') {
        // 🔹 Message deleted → rebuild
        const idx = allMessages.findIndex(m => m.id === change.doc.id);
        if (idx !== -1) allMessages.splice(idx, 1);
      }
    });
    renderLog();
  };

  registerListener('playerMessages', onSnapshot(sentQuery, processSnapshot));
  registerListener('playerMessages', onSnapshot(receivedQuery, processSnapshot));
  registerListener('playerMessages', onSnapshot(broadcastQuery, processSnapshot));
  registerListener('playerMessages', onSnapshot(controlAllQuery, processSnapshot));

  return () => clearRegistry('playerMessages');
}
