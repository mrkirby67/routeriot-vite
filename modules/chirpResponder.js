// ============================================================================
// FILE: modules/chirpResponder.js
// PURPOSE: Player-side CHIRP task responder panel
// ============================================================================

import {
  listenChirpTasks,
  listenChirpResponses,
  sendChirpResponse
} from '../services/ChatServiceV2.js';

const MAX_RESPONSES_PER_TASK = 5;

function createPanel(container) {
  const existing = document.getElementById('chirp-task-panel');
  existing?.remove();

  const panel = document.createElement('section');
  panel.id = 'chirp-task-panel';
  panel.className = 'control-section';

  const heading = document.createElement('h2');
  heading.textContent = 'CHIRP Control Tasks';
  panel.appendChild(heading);

  const description = document.createElement('p');
  description.style.marginTop = '0';
  description.style.marginBottom = '12px';
  description.style.color = '#9baec8';
  description.style.fontSize = '0.95rem';
  description.textContent = 'Respond to active tasks issued by Control. Responses are visible to Control immediately.';
  panel.appendChild(description);

  const taskList = document.createElement('div');
  taskList.id = 'player-chirp-task-list';
  taskList.style.display = 'flex';
  taskList.style.flexDirection = 'column';
  taskList.style.gap = '14px';
  panel.appendChild(taskList);

  const insertBefore = document.getElementById('team-surprises-section');
  if (insertBefore) {
    container.insertBefore(panel, insertBefore);
  } else {
    container.appendChild(panel);
  }

  return { panel, taskList };
}

export function initializeChirpResponder(teamName) {
  const cleanTeam = typeof teamName === 'string' ? teamName.trim() : '';
  const container = document.querySelector('.container');
  if (!cleanTeam || !container) {
    console.warn('⚠️ CHIRP responder skipped — missing team/container.');
    return () => {};
  }
  const teamKey = cleanTeam.toLowerCase();

  const { panel, taskList } = createPanel(container);

  const tasks = new Map();
  const responses = new Map();

  let unsubscribeTasks = null;
  let unsubscribeResponses = null;

  const renderEmpty = (message) => {
    taskList.innerHTML = '';
    const empty = document.createElement('p');
    empty.style.margin = '0';
    empty.style.color = '#9baec8';
    empty.style.fontSize = '0.95rem';
    empty.textContent = message;
    taskList.appendChild(empty);
  };

  const formatTimestamp = (ms) => {
    if (!ms) return '--:--';
    const dt = new Date(ms);
    if (Number.isNaN(dt.getTime())) return '--:--';
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderTasks = () => {
    if (!tasks.size) {
      renderEmpty('No active CHIRP tasks at this time.');
      return;
    }

    const sorted = Array.from(tasks.values()).sort((a, b) => {
      const aTs = typeof a.timestampMs === 'number' ? a.timestampMs : 0;
      const bTs = typeof b.timestampMs === 'number' ? b.timestampMs : 0;
      return bTs - aTs;
    }).filter((task) => {
      if (!Array.isArray(task.assignedTeams) || task.assignedTeams.length === 0) {
        return true;
      }
      return task.assignedTeams.some((team) => typeof team === 'string' && team.trim().toLowerCase() === teamKey);
    });

    if (!sorted.length) {
      renderEmpty('No active CHIRP tasks assigned to your team.');
      return;
    }

    taskList.innerHTML = '';
    sorted.forEach((task) => {
      const card = document.createElement('div');
      card.style.border = '1px solid #30363d';
      card.style.borderRadius = '8px';
      card.style.padding = '12px';
      card.style.background = 'rgba(10, 11, 15, 0.6)';
      card.dataset.taskId = task.id;

      const title = document.createElement('h3');
      title.style.margin = '0 0 6px 0';
      title.style.color = '#58a6ff';
      title.style.fontSize = '1.05rem';
      title.textContent = task.title || `Task ${task.id}`;
      card.appendChild(title);

      const meta = document.createElement('p');
      meta.style.margin = '0 0 8px 0';
      meta.style.color = '#9baec8';
      meta.style.fontSize = '0.85rem';
      const expiresLabel = task.expiresAtMs
        ? `Expires ${formatTimestamp(task.expiresAtMs)}`
        : 'No expiry';
      meta.textContent = `${expiresLabel} • ${task.assignedTeams?.length ? `Teams: ${task.assignedTeams.join(', ')}` : 'All teams'}`;
      card.appendChild(meta);

      const description = document.createElement('p');
      description.style.margin = '0 0 12px 0';
      description.style.whiteSpace = 'pre-wrap';
      description.textContent = task.description || 'No description provided.';
      card.appendChild(description);

      const responseContainer = document.createElement('div');
      responseContainer.style.display = 'flex';
      responseContainer.style.flexDirection = 'column';
      responseContainer.style.gap = '8px';
      responseContainer.style.marginBottom = '10px';

      const textarea = document.createElement('textarea');
      textarea.rows = 3;
      textarea.placeholder = 'Enter your response to Control…';
      textarea.style.background = '#161b22';
      textarea.style.color = '#e6edf3';
      textarea.style.border = '1px solid #30363d';
      textarea.style.borderRadius = '6px';
      textarea.style.padding = '8px';
      textarea.style.fontFamily = 'inherit';
      textarea.style.resize = 'vertical';

      const actionRow = document.createElement('div');
      actionRow.style.display = 'flex';
      actionRow.style.gap = '10px';
      actionRow.style.alignItems = 'center';

      const sendBtn = document.createElement('button');
      sendBtn.type = 'button';
      sendBtn.textContent = 'Send CHIRP Response';
      sendBtn.style.padding = '8px 16px';

      const statusLabel = document.createElement('span');
      statusLabel.style.fontSize = '0.85rem';
      statusLabel.style.color = '#9baec8';

      actionRow.appendChild(sendBtn);
      actionRow.appendChild(statusLabel);

      responseContainer.appendChild(textarea);
      responseContainer.appendChild(actionRow);
      card.appendChild(responseContainer);

      const historyWrapper = document.createElement('div');
      historyWrapper.style.display = 'flex';
      historyWrapper.style.flexDirection = 'column';
      historyWrapper.style.gap = '4px';

      const historyTitle = document.createElement('strong');
      historyTitle.textContent = 'Your recent responses';
      historyTitle.style.fontSize = '0.9rem';
      historyTitle.style.color = '#d2b3ff';
      historyWrapper.appendChild(historyTitle);

      const historyContent = document.createElement('div');
      historyContent.style.display = 'flex';
      historyContent.style.flexDirection = 'column';
      historyContent.style.gap = '4px';

      const existing = responses.get(task.id);
      if (existing && existing.length) {
        existing.forEach((resp) => {
          const item = document.createElement('div');
          item.style.fontSize = '0.85rem';
          item.style.color = '#9be9a8';
          item.textContent = `[${formatTimestamp(resp.timestampMs)}] ${resp.responseText || resp.text || ''}`;
          historyContent.appendChild(item);
        });
      } else {
        const empty = document.createElement('span');
        empty.style.color = '#9baec8';
        empty.style.fontSize = '0.85rem';
        empty.textContent = 'No responses yet.';
        historyContent.appendChild(empty);
      }

      historyWrapper.appendChild(historyContent);
      card.appendChild(historyWrapper);

      sendBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) {
          alert('Please enter a response before sending.');
          return;
        }

        sendBtn.disabled = true;
        statusLabel.textContent = 'Sending…';
        try {
          await sendChirpResponse({
            taskId: task.id,
            responseText: text,
            teamName: cleanTeam,
            senderDisplay: cleanTeam
          });
          textarea.value = '';
          statusLabel.textContent = 'Response sent!';
          setTimeout(() => {
            statusLabel.textContent = '';
          }, 2000);
        } catch (err) {
          console.error('❌ Failed to send CHIRP response:', err);
          alert('Unable to send response. See console for details.');
          statusLabel.textContent = 'Failed to send.';
        } finally {
          sendBtn.disabled = false;
        }
      });

      taskList.appendChild(card);
    });
  };

  unsubscribeTasks = listenChirpTasks({
    cb: (taskArray) => {
      tasks.clear();
      taskArray.forEach((task) => tasks.set(task.id, task));
      renderTasks();
    }
  });

  unsubscribeResponses = listenChirpResponses({
    cb: (batch) => {
      if (!Array.isArray(batch) || !batch.length) return;
      let mutated = false;
      batch.forEach((response) => {
        if (!response || !response.id || response.teamName?.trim().toLowerCase() !== teamKey) {
          return;
        }
        if (!responses.has(response.taskId)) {
          responses.set(response.taskId, []);
        }
        const list = responses.get(response.taskId);
        if (!list.find((item) => item.id === response.id)) {
          list.push(response);
          list.sort((a, b) => {
            const aTs = typeof a.timestampMs === 'number' ? a.timestampMs : 0;
            const bTs = typeof b.timestampMs === 'number' ? b.timestampMs : 0;
            return bTs - aTs;
          });
          if (list.length > MAX_RESPONSES_PER_TASK) {
            list.length = MAX_RESPONSES_PER_TASK;
          }
          mutated = true;
        }
      });
      if (mutated) {
        renderTasks();
      }
    }
  });

  renderTasks();

  return (reason = 'chirp-teardown') => {
    unsubscribeTasks?.(reason);
    unsubscribeResponses?.(reason);
    tasks.clear();
    responses.clear();
    panel.remove();
  };
}
