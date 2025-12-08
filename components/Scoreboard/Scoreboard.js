// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/Scoreboard/Scoreboard.js
// PURPOSE: SCOREBOARD COMPONENT (Unified Control + Player)
// DEPENDS_ON: ../../modules/scoreboardManager.js, ../../modules/utils.js, /core/eventBus.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import {
  addPointsToTeam,
  getScoreboardState,
  refreshScoreboard,
  setTeamScore
} from '../../modules/scoreboardManager.js';
import { escapeHtml } from '../../modules/utils.js';
import { subscribe } from '/core/eventBus.js';
import styles from './Scoreboard.module.css';

/* ---------------------------------------------------------------------------
 *  SCOREBOARD COMPONENT (Unified Control + Player)
 * ------------------------------------------------------------------------ */
export function ScoreboardComponent({ editable = true } = {}) {
  return `
    <div class="${styles.controlSection}">
      <h2 id="scoreboard-title">
        ${editable ? 'Scoreboard (Live & Editable)' : 'Team Standings (Live)'}
      </h2>
      <table class="${styles.dataTable}" id="scoreboard-table">
        <thead>
          <tr>
            <th>Team Name</th>
            <th>Score</th>
            <th>Zones Controlled</th>
            <th>Last Known Location</th>
            <th>${editable ? 'Adjust' : 'Last Update'}</th>
          </tr>
        </thead>
        <tbody id="scoreboard-tbody">
          <tr><td colspan="5" style="text-align:center;color:#888;">Loading...</td></tr>
        </tbody>
      </table>
      <div class="${styles.panelSection}" id="zone-scoring-config">
        <h3>Zone Capture Scoring</h3>
        <label class="${styles.panelLabel}">First Capture Points</label>
        <input type="number" id="score-first-capture" min="0" step="1" class="${styles.panelInput}">
        <label class="${styles.panelLabel}">Second Capture Points</label>
        <input type="number" id="score-second-capture" min="0" step="1" class="${styles.panelInput}">
        <label class="${styles.panelLabel}">Successive Captures (3rd+)</label>
        <input type="number" id="score-successive-capture" min="0" step="1" class="${styles.panelInput}">
        <button id="save-zone-scoring" class="${styles.panelButton}">Save Scoring</button>
      </div>
    </div>
  `;
}

function formatTimestamp(ts) {
  try {
    if (!ts) return '';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleTimeString();
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleTimeString();
    if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
    if (typeof ts === 'string') return new Date(ts).toLocaleTimeString();
  } catch (err) {
    console.warn('⚠️ Bad timestamp:', err);
  }
  return '';
}

function renderScoreboard(teamScores = [], { editable, scoreboardBody, titleEl }) {
  if (!scoreboardBody) return;

  if (!Array.isArray(teamScores) || teamScores.length === 0) {
    scoreboardBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;color:#aaa;">
        Waiting for game to start — no active teams yet.
      </td></tr>`;
    if (titleEl) {
      titleEl.textContent = editable
        ? 'Scoreboard (Waiting for teams)'
        : 'Team Standings (Waiting)';
    }
    return;
  }

  if (titleEl) {
    titleEl.textContent = editable
      ? 'Scoreboard (Live & Editable)'
      : 'Team Standings (Live)';
  }

  scoreboardBody.innerHTML = '';

  teamScores.forEach((entry, index) => {
    const safeTeamName = escapeHtml(entry.teamName || `Team ${index + 1}`);
    const zonesDisplay = Array.isArray(entry.zonesControlled)
      ? entry.zonesControlled.join(', ')
      : (entry.zonesControlled ?? '—');
    const safeZonesControlled = escapeHtml(String(zonesDisplay || '—'));
    const safeScoreDisplay = escapeHtml(String(entry.score ?? 0));
    const safeLocation = escapeHtml(entry.lastKnownLocation || '—');
    const safeTimestamp = escapeHtml(formatTimestamp(entry.timestamp) || '—');

    const row = document.createElement('tr');
    if (editable) {
      row.innerHTML = `
        <td>${safeTeamName}</td>
        <td>
          <input type="number"
                 value="${safeScoreDisplay}"
                 class="${styles.scoreInput}"
                 data-score-input="${entry.teamName}">
        </td>
        <td>${safeZonesControlled}</td>
        <td>${safeLocation}</td>
        <td>
          <button class="${styles.adjustBtn}" data-score-adjust data-team="${entry.teamName}" data-change="+1">+1</button>
          <button class="${styles.adjustBtn}" data-score-adjust data-team="${entry.teamName}" data-change="-1">-1</button>
        </td>`;
    } else {
      row.innerHTML = `
        <td>${safeTeamName}</td>
        <td>${safeScoreDisplay}</td>
        <td>${safeZonesControlled}</td>
        <td>${safeLocation}</td>
        <td>${safeTimestamp}</td>`;
    }

    scoreboardBody.appendChild(row);
  });

  if (editable) {
    attachHandlers(scoreboardBody);
  }
}

function attachHandlers(root) {
  root.querySelectorAll('[data-score-adjust]').forEach((btn) => {
    btn.onclick = async (e) => {
      const team = e.currentTarget.dataset.team;
      const delta = parseInt(e.currentTarget.dataset.change, 10);
      if (!team || Number.isNaN(delta)) return;
      await addPointsToTeam(team, delta);
    };
  });

  root.querySelectorAll('[data-score-input]').forEach((input) => {
    input.onchange = async (e) => {
      const team = e.currentTarget.dataset.scoreInput;
      const newScore = Number(e.currentTarget.value ?? 0);
      if (!team || Number.isNaN(newScore)) return;
      await setTeamScore(team, newScore);
    };
  });
}

/* ---------------------------------------------------------------------------
 *  LIVE SCOREBOARD LOGIC
 * ------------------------------------------------------------------------ */
export function initializeScoreboardListener({ editable = true } = {}) {
  const scoreboardBody = document.getElementById('scoreboard-tbody');
  const titleEl = document.getElementById('scoreboard-title');
  if (!scoreboardBody) {
    console.warn('⚠️ Missing scoreboard tbody.');
    return () => {};
  }

  const render = (state) => renderScoreboard(state, { editable, scoreboardBody, titleEl });

  render(getScoreboardState());
  refreshScoreboard();

  const unsubscribe = subscribe('scoreboard:update', render);
  return () => unsubscribe?.();
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/Scoreboard/Scoreboard.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: ScoreboardComponent, initializeScoreboardListener
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
