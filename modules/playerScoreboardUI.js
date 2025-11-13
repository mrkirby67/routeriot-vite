// ============================================================================
// FILE: /modules/playerScoreboardUI.js
// PURPOSE: Render the player scoreboard table via eventBus updates
// ============================================================================

import { subscribe } from '/core/eventBus.js';
import { getScoreboardState } from './scoreboardManager.js';

function renderPlaceholder(tableBody) {
  tableBody.innerHTML = `
    <tr>
      <td colspan="2" style="text-align:center;color:#aaa;">
        Waiting for live scores...
      </td>
    </tr>
  `;
}

function renderRows(tableBody, teamScores = []) {
  if (!Array.isArray(teamScores) || teamScores.length === 0) {
    renderPlaceholder(tableBody);
    return;
  }

  tableBody.innerHTML = '';
  teamScores
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .forEach((entry, index) => {
      const row = document.createElement('tr');
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
      row.innerHTML = `
        <td>${medal} ${entry.teamName || 'Team'}</td>
        <td>${Number(entry.score ?? 0)}</td>
      `;
      tableBody.appendChild(row);
    });
}

export function initializePlayerScoreboardUI() {
  const tableBody = document.getElementById('player-scoreboard-tbody');
  if (!tableBody) {
    console.warn('⚠️ Player scoreboard tbody not found.');
    return () => {};
  }

  renderRows(tableBody, getScoreboardState());

  const unsubscribe = subscribe('scoreboard:update', (state) => {
    renderRows(tableBody, state);
  });

  return () => {
    unsubscribe?.();
  };
}
