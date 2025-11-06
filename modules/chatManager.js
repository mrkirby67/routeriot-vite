import ChatServiceV2 from '../services/ChatServiceV2.js';
import { BroadcastComponent, initializeBroadcastLogic } from '../components/Broadcast/Broadcast.js';

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

  return (reason) => {
    if (typeof unsubscribe === 'function') {
      unsubscribe(reason);
    }
    if (typeof teardownBroadcast === 'function') {
      teardownBroadcast(reason);
    }
  };
}
