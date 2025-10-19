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

// ============================================================================
// 🧭 CONTROL PAGE: Listen to ALL MESSAGES (visible to Game Master)
// ============================================================================
export async function listenToAllMessages() {
  const logBox = document.getElementById('communication-log');
  if (!logBox) return console.warn("⚠️ No #communication-log element found.");

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
        const senderDisplay =
          msg.sender && msg.sender !== 'Game Master'
            ? `<strong style="color:#FFD700;">${msg.sender}</strong>`
            : `<strong style="color:#fdd835;">GAME MASTER</strong>`;
        entry.innerHTML = `
          <span style="color:#888;">[${time}]</span>
          ${senderDisplay}: ${msg.text || msg.message || '(no message)'}
        `;
      } else {
        entry.innerHTML = `
          <span style="color:#888;">[${time}]</span>
          <strong style="color:#FFD700;">${msg.sender || 'Unknown'}</strong> ➡️
          <strong style="color:#00CED1;">${msg.recipient || 'Unknown'}</strong>: ${msg.text || msg.message || ''}
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

  onSnapshot(privateMessagesQuery, processSnapshot);
  onSnapshot(publicCommsQuery, processSnapshot);
  onSnapshot(controlAllQuery, processSnapshot);
}

// ============================================================================
// 🗣️ PLAYER PAGE: Chat UI + Opponent Status + Message Handling
// ============================================================================
export async function setupPlayerChat(currentTeamName) {
  const opponentsTbody = document.getElementById('opponents-tbody');
  const chatLog = document.getElementById('team-chat-log');
  if (!opponentsTbody || !chatLog) return console.warn("⚠️ Chat elements missing on player page.");

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
  onSnapshot(teamStatusCol, (snapshot) => {
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

  listenForMyMessages(currentTeamName, chatLog);
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
        const senderDisplay =
          msg.sender && msg.sender !== 'Game Master'
            ? `<strong style="color:#FFD700;">${msg.sender}</strong>`
            : `<strong style="color:#fdd835;">GAME MASTER</strong>`;
        entry.style.backgroundColor = '#3a3a24';
        entry.style.padding = '8px';
        entry.style.borderRadius = '5px';
        entry.style.margin = '5px 0';
        entry.innerHTML = `
          <span style="color: #aaa;">[${time}]</span>
          ${senderDisplay}: <span style="font-weight:bold;">${msg.text || msg.message || '(no message)'}</span>
        `;
      } else {
        const isMine = msg.sender === myTeamName;
        const color = isMine ? '#FFD700' : '#00CED1';
        const prefix = isMine
          ? `<strong style="color:${color};">You ➡️ ${msg.recipient || 'Unknown'}:</strong>`
          : `<strong style="color:${color};">${msg.sender || 'Unknown'} ➡️ You:</strong>`;
        entry.innerHTML = `${prefix} ${msg.text || msg.message || ''} <span style="color:#888;">(${time})</span>`;
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

  onSnapshot(sentQuery, processSnapshot);
  onSnapshot(receivedQuery, processSnapshot);
  onSnapshot(broadcastQuery, processSnapshot);
  onSnapshot(controlAllQuery, processSnapshot);
}