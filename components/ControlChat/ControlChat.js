// ============================================================================
// FILE: components/ControlChat/ControlChat.js
// PURPOSE: Read-only control panel feed that displays all team messages.
// DEPENDS_ON: ../../services/ChatServiceV2.js
// USED_BY: control.js
// ============================================================================

import { subscribeToAllMessages } from '../../services/ChatServiceV2.js';

let unsubscribeAll = null;
let hostEl = null;

function toMillis(ts) {
  if (!ts) return Date.now();
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  }
  return Date.now();
}

function renderMessages(logEl, messages = []) {
  if (!logEl) return;
  logEl.innerHTML = '';

  const items = Array.isArray(messages) ? [...messages] : [];
  items.sort((a, b) => toMillis(a?.timestamp) - toMillis(b?.timestamp));

  if (!items.length) {
    logEl.innerHTML = '<p>No messages yet.</p>';
    return;
  }

  items.forEach((msg) => {
    const timeLabel = new Date(toMillis(msg?.timestamp)).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    const from = typeof msg?.from === 'string' && msg.from.trim()
      ? msg.from.trim()
      : (typeof msg?.team === 'string' && msg.team.trim() ? msg.team.trim() : 'Unknown');
    const to = typeof msg?.to === 'string' && msg.to.trim()
      ? msg.to.trim()
      : 'ALL';
    const text = typeof msg?.message === 'string' ? msg.message : '';

    const entry = document.createElement('div');
    entry.className = 'chat-message';
    entry.textContent = `[${timeLabel}] ${from} → ${to}: ${text}`;
    logEl.appendChild(entry);
  });

  logEl.scrollTop = logEl.scrollHeight;
}

export function mountControlChat(elementId = 'control-chat-container') {
  unmountControlChat();

  hostEl = document.getElementById(elementId);
  if (!hostEl) {
    console.warn(`⚠️ Control chat container "${elementId}" not found.`);
    return () => {};
  }

  hostEl.innerHTML = `
    <div class="control-section">
      <h2>All Team Chat</h2>
      <div id="control-chat-log" class="log-box">
        <p>Listening for messages...</p>
      </div>
    </div>
  `;

  const logEl = hostEl.querySelector('#control-chat-log');
  unsubscribeAll = subscribeToAllMessages((messages) => renderMessages(logEl, messages));

  return unsubscribeAll;
}

export function unmountControlChat(reason = 'teardown') {
  try {
    unsubscribeAll?.(reason);
  } catch {}
  unsubscribeAll = null;

  if (hostEl) {
    hostEl.innerHTML = '';
  }
  hostEl = null;
}
