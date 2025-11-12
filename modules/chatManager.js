import ChatServiceV2 from '../services/ChatServiceV2.js';
import { BroadcastComponent, initializeBroadcastLogic } from '../components/Broadcast/Broadcast.js';
import { db } from '/core/config.js';
import {
  collectionGroup,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export { setupPlayerChat } from './chatManager/playerChat.js';
export { registerListener } from './chatManager/registry.js';

function ensureControlLog() {
  let log = document.getElementById('control-chat-log');
  if (log) return log;

  const container = document.getElementById('broadcast-container');
  if (container) {
    const existing = container.querySelector('#control-chat-log') || container.querySelector('#communication-log');
    if (existing) return existing;
    container.insertAdjacentHTML('beforeend', BroadcastComponent());
    return container.querySelector('#control-chat-log') || container.querySelector('#communication-log');
  }

  document.body.insertAdjacentHTML('beforeend', BroadcastComponent());
  return document.getElementById('control-chat-log') || document.getElementById('communication-log');
}

function toMillis(value) {
  if (!value) return Date.now();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  return Date.now();
}

function normalizeLegacyMessage(docSnap) {
  if (!docSnap) return null;
  const data = docSnap.data?.() ?? docSnap.data ?? {};
  const trim = (val, fallback = '') => {
    if (typeof val !== 'string') return fallback;
    const next = val.trim();
    return next || fallback;
  };
  const text = trim(data.text ?? data.message ?? '', '');
  const sender = trim(
    data.senderDisplay ??
      data.sender ??
      data.fromTeam ??
      data.from ??
      data.author ??
      'UNKNOWN',
    'UNKNOWN'
  );
  const recipient = trim(
    data.toTeam ??
      data.recipient ??
      data.target ??
      data.channel ??
      data.team ??
      'ALL',
    'ALL'
  );

  return {
    id: `legacy:${docSnap.id}:${docSnap.ref.path}`,
    text,
    message: text,
    sender,
    senderDisplay: sender,
    fromTeam: sender,
    teamName: sender,
    recipient,
    toTeam: recipient,
    kind: trim(
      data.kind || (recipient.toUpperCase() === 'ALL' ? 'broadcast' : 'chat'),
      'chat'
    ),
    timestampMs: toMillis(data.timestamp ?? data.createdAt ?? data.updatedAt)
  };
}

function attachLegacyMessageStream(cb) {
  if (typeof cb !== 'function') return () => {};
  try {
    const q = query(collectionGroup(db, 'messages'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const payload = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const normalized = normalizeLegacyMessage(change.doc);
        if (normalized) {
          payload.push(normalized);
        }
      });
      if (payload.length) {
        cb(payload);
      }
    }, (error) => {
      console.error('⚠️ [chatManager] Legacy message listener failed:', error);
    });
  } catch (err) {
    console.error('⚠️ [chatManager] Unable to attach legacy message stream:', err);
    return () => {};
  }
}

export function listenToAllMessages() {
  const log = ensureControlLog();
  const teardownBroadcast = initializeBroadcastLogic();

  const seenIds = new Set();
  const appendBatch = (batch) => {
    const items = Array.isArray(batch) ? batch : [batch];
    items.forEach((msg) => {
      if (!log || !msg || !msg.id || seenIds.has(msg.id)) return;
      seenIds.add(msg.id);

      const isDirectChat =
        msg.kind === 'chat' &&
        typeof msg.fromTeam === 'string' &&
        typeof msg.toTeam === 'string' &&
        msg.toTeam.toUpperCase() !== 'ALL';

      if (isDirectChat && console?.log) {
        console.log(
          '[chatManager] Direct chat observed:',
          `${msg.fromTeam} → ${msg.toTeam}`,
          msg.text
        );
      }

      const tagName = log.tagName?.toLowerCase();
      const entry = document.createElement(
        tagName === 'ul' || tagName === 'ol' ? 'li' : 'p'
      );
      const timestampMs = typeof msg.timestampMs === 'number'
        ? msg.timestampMs
        : Date.now();
      const timeLabel = new Date(timestampMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      const prefix = timeLabel ? `[${timeLabel}] ` : '';
      const senderLabel = msg.senderDisplay || msg.sender || msg.fromTeam || 'Unknown';
      entry.textContent = `${prefix}${senderLabel}: ${msg.text || ''}`;

      if (typeof log.prepend === 'function') {
        log.prepend(entry);
      } else {
        log.insertBefore(entry, log.firstChild || null);
      }
    });
  };

  const unsubscribe = ChatServiceV2.listenAll(appendBatch);
  const legacyUnsubscribe = attachLegacyMessageStream(appendBatch);

  return (reason) => {
    if (typeof unsubscribe === 'function') {
      unsubscribe(reason);
    }
    if (typeof legacyUnsubscribe === 'function') {
      legacyUnsubscribe(reason);
    }
    if (typeof teardownBroadcast === 'function') {
      teardownBroadcast(reason);
    }
  };
}
