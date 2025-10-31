// ============================================================================
// FILE: modules/chatManager/messageService.js
// PURPOSE: Message sending + player-side message feeds (bridged to new service)
// ============================================================================

import { db } from '../config.js';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { clearRegistry, registerListener } from './registry.js';
import { GAME_MASTER_NAME, resolveSenderName, safeHTML, shouldRenderRaw } from './utils.js';

// ✅ NEW DATA-LAYER IMPORT (bridge to refactored service)
import * as messageService from '../../services/messageService.js';

// ----------------------------------------------------------------------------
// 🔄 Bridge Functions (temporary, until full migration)
// ----------------------------------------------------------------------------
export async function sendMessage(fromTeam, toTeam, text) {
  try {
    await messageService.sendMessage(fromTeam, toTeam, text);
  } catch (err) {
    console.error('Chat bridge error:', err);
  }
}

export function listenForMyMessages(teamName, callback) {
  try {
    const result = typeof messageService.listenForMyMessages === 'function'
      ? messageService.listenForMyMessages(teamName, callback)
      : null;
    if (typeof result === 'function') {
      return result;
    }
  } catch (err) {
    console.error('Chat listener bridge error:', err);
  }
  return legacyListenForMyMessages(teamName, callback);
}

// ----------------------------------------------------------------------------
// 💬 Private + System Messaging
// ----------------------------------------------------------------------------
export async function sendPrivateSystemMessage(recipient, text) {
  if (!recipient || !text) return;
  return sendMessage(GAME_MASTER_NAME, recipient, text);
}

export async function sendPrivateMessage(senderOrTarget, recipientMaybe, rawText) {
  let fromTeam, toTeam, text;

  if (typeof rawText === 'undefined') {
    fromTeam = GAME_MASTER_NAME;
    toTeam = typeof senderOrTarget === 'string' ? senderOrTarget.trim() : '';
    text = typeof recipientMaybe === 'string' ? recipientMaybe.trim() : '';
  } else {
    fromTeam = typeof senderOrTarget === 'string' ? senderOrTarget.trim() : '';
    toTeam = typeof recipientMaybe === 'string' ? recipientMaybe.trim() : '';
    text = typeof rawText === 'string' ? rawText.trim() : '';
  }

  if (!fromTeam || !toTeam || !text) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const snippet = text.length > 280 ? `${text.slice(0, 277)}…` : text;
  console.log(`💬 [Private] → ${toTeam}: ${snippet}`);

  try {
    await sendMessage(fromTeam, toTeam, snippet);
    return { ok: true };
  } catch (err) {
    console.error('❌ Error sending private message:', err);
    return { ok: false, reason: err?.message || 'send_failed' };
  }
}

// ----------------------------------------------------------------------------
// 📣 Broadcasts / Chirps
// ----------------------------------------------------------------------------
export async function broadcastChirp(fromTeam, message) {
  const teamName = typeof fromTeam === 'string' ? fromTeam.trim() : '';
  const text = typeof message === 'string' ? message.trim() : '';
  if (!teamName || !text) return;

  try {
    await addDoc(collection(db, 'communications'), {
      type: 'chirp',
      from: teamName,
      message: text,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error('❌ Failed to broadcast chirp:', err);
  }
}

// ----------------------------------------------------------------------------
// 🧠 Legacy Player Feed (kept for now – still used by Control dashboard)
// ----------------------------------------------------------------------------
export function legacyListenForMyMessages(myTeamName, logBox) {
  clearRegistry('playerMessages');

  const allMessages = [];
  const messageIds = new Set();
  let conversationListeners = [];

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

  const processMessageSnapshot = (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' && !messageIds.has(change.doc.id)) {
        const data = change.doc.data();
        data.timestamp = data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp || Date.now());
        messageIds.add(change.doc.id);
        allMessages.push(data);
      } else if (change.type === 'removed') {
        const idx = allMessages.findIndex(m => m.id === change.doc.id);
        if (idx !== -1) allMessages.splice(idx, 1);
      }
    });
    renderLog();
  };

  const conversationsQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', myTeamName));

  const unsubscribeConversations = onSnapshot(conversationsQuery, (snapshot) => {
    conversationListeners.forEach(unsub => unsub());
    conversationListeners = [];

    snapshot.forEach(convoDoc => {
      const messagesQuery = query(collection(convoDoc.ref, 'messages'), orderBy('timestamp', 'asc'));
      const unsubscribeMessages = onSnapshot(messagesQuery, processMessageSnapshot);
      conversationListeners.push(unsubscribeMessages);
      registerListener('playerMessages', unsubscribeMessages);
    });
  });

  registerListener('playerMessages', unsubscribeConversations);

  const broadcastQuery = query(collection(db, 'communications'), orderBy('timestamp', 'asc'));
  const controlAllQuery = query(collection(db, 'conversations', 'CONTROL_ALL', 'messages'), orderBy('timestamp', 'asc'));
  registerListener('playerMessages', onSnapshot(broadcastQuery, processMessageSnapshot));
  registerListener('playerMessages', onSnapshot(controlAllQuery, processMessageSnapshot));

  return () => clearRegistry('playerMessages');
}

// ----------------------------------------------------------------------------
// 🕊️ Chirp Cooldown + UI Helper
// ----------------------------------------------------------------------------
export async function sendChirp(teamName, from, text, btnEl) {
  const { canChirp, markChirp, chirpRemainingMs } = await import('../chirpCooldown.js');
  if (!canChirp(teamName)) {
    const secs = Math.ceil(chirpRemainingMs(teamName) / 1000);
    throw new Error(`Chirp on cooldown. Try again in ${secs}s.`);
  }

  const result = await sendPrivateMessage(from, teamName, text);
  if (result?.ok === false) {
    throw new Error(result?.reason || 'send_failed');
  }

  markChirp(teamName);

  if (btnEl && btnEl instanceof HTMLElement) {
    if (btnEl.dataset.chirpTimer) {
      clearInterval(Number(btnEl.dataset.chirpTimer));
    }
    const originalText = btnEl.dataset.originalText || btnEl.textContent || 'Chirp';
    btnEl.dataset.originalText = originalText;
    btnEl.disabled = true;

    const update = () => {
      const remaining = chirpRemainingMs(teamName);
      if (remaining <= 0) {
        btnEl.textContent = originalText;
        btnEl.disabled = false;
        if (btnEl.dataset.chirpTimer) {
          clearInterval(Number(btnEl.dataset.chirpTimer));
          delete btnEl.dataset.chirpTimer;
        }
        return;
      }
      btnEl.textContent = `Chirp (${Math.ceil(remaining / 1000)}s)`;
    };

    update();
    const timerId = window.setInterval(update, 1000);
    btnEl.dataset.chirpTimer = String(timerId);
  }
}

// ----------------------------------------------------------------------------
// 🌐 Expose to window.chatManager (for legacy hooks)
// ----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.chatManager = window.chatManager || {};
  if (typeof window.chatManager.sendPrivateSystemMessage !== 'function') {
    window.chatManager.sendPrivateSystemMessage = (teamName, message) =>
      sendPrivateSystemMessage(teamName, message);
  }
}
