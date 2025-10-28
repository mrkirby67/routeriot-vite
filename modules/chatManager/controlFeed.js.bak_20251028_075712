// ============================================================================
// FILE: modules/chatManager/controlFeed.js
// PURPOSE: Control dashboard listener for all communications
// ============================================================================

import { db } from '../config.js';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { clearRegistry, registerListener } from './registry.js';
import { GAME_MASTER_NAME, resolveSenderName, safeHTML, shouldRenderRaw } from './utils.js';

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
