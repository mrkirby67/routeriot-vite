// ============================================================================
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// AUTHOR: James Kirby / Route Riot Project
// sanitized metadata line
// AICP_VERSION: 1.0
// ============================================================================

import { db } from '/core/config.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import ChatServiceV2 from '../../services/ChatServiceV2.js';
import styles from './Broadcast.module.css';

export function BroadcastComponent() {
  return `
    <div class="${styles.controlSection}">
      <h2>Broadcast & Communication</h2>
      <div class="${styles.broadcastBox}">
        <label for="broadcast-message">Broadcast Message to All Racers:</label>
        <input type="text" id="broadcast-message" placeholder="E.g., Meet at City Hall for lunch...">
        <button id="broadcast-btn">Send Broadcast</button>
      </div>
      <div id="communication-log" class="${styles.logBox}">
        <p>All team communications will appear here...</p>
      </div>
    </div>
  `;
}

export function initializeBroadcastLogic() {
  const broadcastBtn = document.getElementById('broadcast-btn');
  const broadcastInput = document.getElementById('broadcast-message');
  const logBox = document.getElementById('communication-log');

  if (!broadcastBtn || !broadcastInput) return () => {};
  if (broadcastBtn.dataset.chatInitialized === 'true') {
    return () => {};
  }
  broadcastBtn.dataset.chatInitialized = 'true';

  const focusComposer = () => {
    if (broadcastInput) {
      broadcastInput.focus();
      broadcastInput.select?.();
    }
  };
  const handleLogFocus = () => focusComposer();
  const handleInputKeydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      broadcastBtn.click();
    }
  };
  broadcastInput.addEventListener('keydown', handleInputKeydown);
  logBox?.addEventListener('click', handleLogFocus);
  setTimeout(focusComposer, 0);

  broadcastBtn.addEventListener('click', async () => {
    const message = broadcastInput.value.trim();
    if (!message) {
      alert('Please enter a message to broadcast.');
      return;
    }

    broadcastBtn.disabled = true;
    try {
      await ChatServiceV2.send({
        fromTeam: 'Control',
        toTeam: 'ALL',
        text: message,
        kind: 'broadcast'
      });
      alert('Broadcast sent!');
      broadcastInput.value = '';
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert('Failed to send broadcast. Check console for details.');
    } finally {
      broadcastBtn.disabled = false;
    }
  });

  const seenIds = new Set();
  const appendToLog = (batch) => {
    const items = Array.isArray(batch) ? batch : [batch];
    items.forEach((msg) => {
      if (!logBox || !msg || !msg.id || seenIds.has(msg.id)) return;
      seenIds.add(msg.id);

      const entry = document.createElement('p');
      const timestampMs = typeof msg.timestampMs === 'number'
        ? msg.timestampMs
        : Date.now();
      const timeLabel = new Date(timestampMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      const prefix = timeLabel ? `[${timeLabel}] ` : '';
      const senderLabel = msg.senderDisplay || msg.sender || msg.fromTeam || 'Control';
      entry.textContent = `${prefix}${senderLabel}: ${msg.text || ''}`;
      logBox.appendChild(entry);
      logBox.scrollTop = logBox.scrollHeight;
    });
  };

  const unsubscribeBroadcasts = ChatServiceV2.listenBroadcasts(appendToLog);

  return (reason = 'broadcast-teardown') => {
    delete broadcastBtn.dataset.chatInitialized;
    broadcastInput.removeEventListener('keydown', handleInputKeydown);
    logBox?.removeEventListener('click', handleLogFocus);
    if (typeof unsubscribeBroadcasts === 'function') {
      unsubscribeBroadcasts(reason);
    }
  };
}