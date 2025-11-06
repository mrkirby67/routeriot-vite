// ============================================================================
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// AUTHOR: James Kirby / Route Riot Project
// sanitized metadata line
// AICP_VERSION: 1.0
// ============================================================================

import { db } from '../../modules/config.js';
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
      <div class="${styles.chirpPanel}">
        <h3>CHIRP Task Center</h3>
        <form id="chirp-task-form" class="${styles.chirpTaskForm}">
          <input type="text" id="chirp-task-title" placeholder="Task title (e.g., Submit checkpoint selfie)" required>
          <textarea id="chirp-task-description" placeholder="Task details or instructions for teams…" required></textarea>
          <div class="${styles.chirpTaskFormActions}">
            <input type="number" id="chirp-task-duration" min="1" placeholder="Expires in (minutes, optional)">
            <button type="submit">Issue CHIRP Task</button>
          </div>
        </form>
        <div id="chirp-task-list" class="${styles.chirpTaskList}">
          <p class="${styles.chirpEmptyState}">No active CHIRP tasks yet.</p>
        </div>
      </div>
    </div>
  `;
}

export function initializeBroadcastLogic() {
  const broadcastBtn = document.getElementById('broadcast-btn');
  const broadcastInput = document.getElementById('broadcast-message');
  const logBox = document.getElementById('communication-log');
  const chirpForm = document.getElementById('chirp-task-form');
  const chirpTitleInput = document.getElementById('chirp-task-title');
  const chirpDescriptionInput = document.getElementById('chirp-task-description');
  const chirpDurationInput = document.getElementById('chirp-task-duration');
  const chirpTaskList = document.getElementById('chirp-task-list');

  const taskStore = new Map();
  const responseStore = new Map();
  const seenIds = new Set();
  let isGameActive = false;

  let unsubscribeGameState = null;
  let unsubscribeBroadcasts = null;
  let unsubscribeChirpTasks = null;
  let unsubscribeChirpResponses = null;

  const isControlUser = () => {
    if (typeof document === 'undefined') return true;
    const roleHint =
      document.body?.dataset?.role ||
      document.body?.dataset?.userRole ||
      document.body?.dataset?.roleName ||
      '';
    if (roleHint) {
      return roleHint.toLowerCase().includes('control');
    }
    const title = typeof document.title === 'string' ? document.title.toLowerCase() : '';
    if (title) {
      return title.includes('control');
    }
    return true;
  };

  const formatTimestamp = (ms) => {
    if (!ms) return '--:--';
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderChirpTasks = () => {
    if (!chirpTaskList) return;
    chirpTaskList.innerHTML = '';
    if (!taskStore.size) {
      const empty = document.createElement('p');
      empty.className = styles.chirpEmptyState;
      empty.textContent = 'No active CHIRP tasks yet.';
      chirpTaskList.appendChild(empty);
      return;
    }

    const tasks = Array.from(taskStore.values()).sort((a, b) => {
      const aTs = typeof a.timestampMs === 'number' ? a.timestampMs : 0;
      const bTs = typeof b.timestampMs === 'number' ? b.timestampMs : 0;
      return bTs - aTs;
    });

    tasks.forEach((task) => {
      const wrapper = document.createElement('div');
      wrapper.className = styles.chirpTaskItem;
      wrapper.dataset.taskId = task.id;

      const header = document.createElement('div');
      header.className = styles.chirpTaskHeader;

      const titleEl = document.createElement('div');
      titleEl.className = styles.chirpTaskTitle;
      titleEl.textContent = task.title || `Task ${task.id}`;

      const metaContainer = document.createElement('div');
      metaContainer.style.display = 'flex';
      metaContainer.style.flexDirection = 'column';
      metaContainer.style.alignItems = 'flex-end';

      const metaEl = document.createElement('div');
      metaEl.className = styles.chirpTaskMeta;
      const expiryLabel = task.expiresAtMs
        ? `Expires ${formatTimestamp(task.expiresAtMs)}`
        : 'No expiry';
      const teamLabel = task.assignedTeams && task.assignedTeams.length
        ? `Teams: ${task.assignedTeams.join(', ')}`
        : 'All teams';
      metaEl.textContent = `${expiryLabel} • ${teamLabel}`;
      metaContainer.appendChild(metaEl);

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = 'Close Task';
      closeButton.style.marginTop = '6px';
      closeButton.addEventListener('click', async () => {
        if (!confirm('Close this CHIRP task? Active responses will remain visible.')) return;
        try {
          await ChatServiceV2.closeChirpTask(task.id, {
            resolution: 'Closed via Control panel'
          });
        } catch (err) {
          console.error('❌ Failed to close CHIRP task:', err);
          alert('Unable to close task. See console for details.');
        }
      });
      metaContainer.appendChild(closeButton);

      header.appendChild(titleEl);
      header.appendChild(metaContainer);

      const descriptionEl = document.createElement('p');
      descriptionEl.textContent = task.description || 'No description provided.';
      descriptionEl.style.margin = '8px 0 0';
      descriptionEl.style.whiteSpace = 'pre-wrap';

      const responseList = document.createElement('div');
      responseList.className = styles.chirpResponseList;
      const responses = responseStore.get(task.id);
      if (responses && responses.size) {
        const sorted = Array.from(responses.values()).sort((a, b) => {
          const aTs = typeof a.timestampMs === 'number' ? a.timestampMs : 0;
          const bTs = typeof b.timestampMs === 'number' ? b.timestampMs : 0;
          return aTs - bTs;
        }).slice(-25);
        sorted.forEach((response) => {
          const item = document.createElement('div');
          item.className = styles.chirpResponseItem;
          const tsLabel = formatTimestamp(response.timestampMs);
          const author = response.senderDisplay || response.teamName || 'Unknown';
          item.textContent = `[${tsLabel}] ${author}: ${response.responseText || response.text || ''}`;
          responseList.appendChild(item);
        });
      } else {
        const emptyResp = document.createElement('p');
        emptyResp.className = styles.chirpEmptyState;
        emptyResp.textContent = 'No responses yet.';
        responseList.appendChild(emptyResp);
      }

      wrapper.appendChild(header);
      wrapper.appendChild(descriptionEl);
      wrapper.appendChild(responseList);
      chirpTaskList.appendChild(wrapper);
    });
  };

  const handleTaskUpdate = (tasks = []) => {
    taskStore.clear();
    tasks.forEach((task) => {
      taskStore.set(task.id, task);
      if (!responseStore.has(task.id)) {
        responseStore.set(task.id, new Map());
      }
    });

    Array.from(responseStore.keys()).forEach((key) => {
      if (!taskStore.has(key)) {
        responseStore.delete(key);
      }
    });

    renderChirpTasks();
  };

  const handleResponseBatch = (batch = []) => {
    let mutated = false;
    if (!Array.isArray(batch)) return;
    batch.forEach((response) => {
      if (!response || !response.taskId || !response.id) return;
      if (!responseStore.has(response.taskId)) {
        responseStore.set(response.taskId, new Map());
      }
      const bucket = responseStore.get(response.taskId);
      if (!bucket.has(response.id)) {
        bucket.set(response.id, response);
        mutated = true;
      }
    });
    if (mutated) {
      renderChirpTasks();
    }
  };

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

  const gameStateRef = doc(db, 'game', 'gameState');
  unsubscribeGameState = onSnapshot(gameStateRef, (docSnap) => {
    const gameState = docSnap.data();
    isGameActive = gameState?.status === 'active';
    broadcastBtn.disabled = false;
    broadcastBtn.title = isGameActive
      ? 'Send broadcast to all teams'
      : 'Game inactive — still broadcasts to all teams.';
    broadcastInput.placeholder = isGameActive
      ? 'E.g., Meet at City Hall for lunch...'
      : 'Game inactive — broadcast will still send.';
  });

  broadcastBtn.addEventListener('click', async () => {
    const message = broadcastInput.value.trim();
    if (!message) {
      alert('Please enter a message to broadcast.');
      return;
    }
    if (!isControlUser()) {
      console.warn('Broadcast blocked: only Control may send ALL-team messages.');
      alert('Only Control can send broadcasts to all teams.');
      return;
    }
    if (!isGameActive) {
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Game is not marked as ACTIVE. Send this broadcast anyway?')
        : true;
      if (!confirmed) return;
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

  if (chirpForm) {
    chirpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (chirpForm.dataset.submitting === 'true') return;

      const title = chirpTitleInput?.value?.trim();
      const description = chirpDescriptionInput?.value?.trim();
      const durationValue = chirpDurationInput?.value?.trim();
      const expiresInMinutes = durationValue ? Number(durationValue) : null;

      if (!title || !description) {
        alert('Please provide both a task title and description.');
        return;
      }

      chirpForm.dataset.submitting = 'true';
      try {
        await ChatServiceV2.issueChirpTask({
          title,
          description,
          expiresInMinutes: Number.isFinite(expiresInMinutes) && expiresInMinutes > 0
            ? expiresInMinutes
            : undefined
        });
        if (chirpTitleInput) chirpTitleInput.value = '';
        if (chirpDescriptionInput) chirpDescriptionInput.value = '';
        if (chirpDurationInput) chirpDurationInput.value = '';
      } catch (err) {
        console.error('❌ Failed to issue CHIRP task:', err);
        alert('Unable to create CHIRP task. See console for details.');
      } finally {
        delete chirpForm.dataset.submitting;
      }
    });
  }

  if (chirpTaskList) {
    unsubscribeChirpTasks = ChatServiceV2.listenChirpTasks({
      cb: handleTaskUpdate
    });
    unsubscribeChirpResponses = ChatServiceV2.listenChirpResponses({
      cb: handleResponseBatch
    });
  }

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

  unsubscribeBroadcasts = ChatServiceV2.listenBroadcasts(appendToLog);

  return (reason = 'broadcast-teardown') => {
    delete broadcastBtn.dataset.chatInitialized;
    broadcastInput.removeEventListener('keydown', handleInputKeydown);
    logBox?.removeEventListener('click', handleLogFocus);
    unsubscribeGameState?.(reason);
    if (typeof unsubscribeBroadcasts === 'function') {
      unsubscribeBroadcasts(reason);
    }
    if (typeof unsubscribeChirpTasks === 'function') {
      unsubscribeChirpTasks(reason);
    }
    if (typeof unsubscribeChirpResponses === 'function') {
      unsubscribeChirpResponses(reason);
    }
  };
}
