// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/Scoreboard/Scoreboard.js
// PURPOSE: SCOREBOARD COMPONENT (Unified Control + Player)
// DEPENDS_ON: ../../modules/config.js, ../../modules/scoreboardManager.js, ../../modules/zoneManager.js, ../../modules/utils.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { db } from '../../modules/config.js';
import { addPointsToTeam } from '../../modules/scoreboardManager.js';
import { getZoneDisplayName } from '../../modules/zoneManager.js';
import { escapeHtml } from '../../modules/utils.js';
import {
  onSnapshot,
  collection,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
    </div>
  `;
}

/* ---------------------------------------------------------------------------
 *  LIVE SCOREBOARD LOGIC
 * ------------------------------------------------------------------------ */
export function initializeScoreboardListener({ editable = true } = {}) {
  const scoreboardBody = document.getElementById('scoreboard-tbody');
  const titleEl = document.getElementById('scoreboard-title');
  if (!scoreboardBody) return;

  const scoresCollection = collection(db, 'scores');
  const teamStatusCollection = collection(db, 'teamStatus');

  // local caches
  let scoresData = {};
  let statusData = {};
  let activeTeams = [];
  let renderPending = null;

  // --------------------------------------------------------------
  // 🔁 Render the scoreboard table
  // --------------------------------------------------------------
  async function renderTable() {
    const activeSnap = await getDoc(doc(db, 'game', 'activeTeams'));
    activeTeams = activeSnap.exists() ? activeSnap.data().list || [] : [];

    if (!activeTeams || activeTeams.length === 0) {
      scoreboardBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;color:#aaa;">
          Waiting for game to start — no active teams yet.
        </td></tr>`;
      return;
    }

    scoreboardBody.innerHTML = '';

    for (const teamName of activeTeams) {
      const scoreInfo = scoresData[teamName] || {};
      const statusInfo = statusData[teamName] || {};
      const score = scoreInfo.score ?? 0;
      const zones = scoreInfo.zonesControlled ?? '—';
      const lastZoneId = typeof statusInfo.lastKnownLocation === 'string'
        ? statusInfo.lastKnownLocation.trim()
        : '';
      let zoneLabel = '—';
      if (lastZoneId) {
        try {
          zoneLabel = await getZoneDisplayName(lastZoneId);
        } catch (err) {
          console.warn('⚠️ Falling back to raw zone id for', lastZoneId, err);
          zoneLabel = lastZoneId;
        }
      }
      const ts = statusInfo.timestamp;
      const time = ts
        ? formatTimestamp(ts)
        : '—';

      const safeTeamName = escapeHtml(teamName);
      const safeZoneLabel = escapeHtml(zoneLabel);
      const safeZonesControlled = escapeHtml(String(zones));
      const safeScoreDisplay = escapeHtml(String(score));
      const safeTime = escapeHtml(time);
      const row = document.createElement('tr');

      if (editable) {
        row.innerHTML = `
          <td>${safeTeamName}</td>
          <td>
            <input type="number"
                   id="score-${teamName.replace(/\s/g, '')}"
                   value="${safeScoreDisplay}"
                   class="${styles.scoreInput}">
          </td>
          <td>${safeZonesControlled}</td>
          <td>${safeZoneLabel}</td>
          <td>
            <button class="${styles.adjustBtn}" data-team="${teamName}" data-change="+1">+1</button>
            <button class="${styles.adjustBtn}" data-team="${teamName}" data-change="-1">-1</button>
          </td>`;
      } else {
        row.innerHTML = `
          <td>${safeTeamName}</td>
          <td>${safeScoreDisplay}</td>
          <td>${safeZonesControlled}</td>
          <td>${safeZoneLabel}</td>
          <td>${safeTime}</td>`;
      }

      scoreboardBody.appendChild(row);
    }

    if (editable) attachHandlers();
  }

  // --------------------------------------------------------------
  // 🕓 Format timestamp safely (supports Firestore + numeric)
  // --------------------------------------------------------------
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

  // --------------------------------------------------------------
  // 🧩 Attach editing controls
  // --------------------------------------------------------------
  function attachHandlers() {
    document.querySelectorAll(`.${styles.adjustBtn}`).forEach(btn => {
      btn.onclick = async (e) => {
        const team = e.target.dataset.team;
        const delta = parseInt(e.target.dataset.change);
        await addPointsToTeam(team, delta);
      };
    });

    document.querySelectorAll(`.${styles.scoreInput}`).forEach(input => {
      input.onchange = async (e) => {
        const team = e.target.id.replace('score-', '');
        const newScore = parseInt(e.target.value || 0);
        await setDoc(doc(db, 'scores', team), { score: newScore }, { merge: true });
      };
    });
  }

  // --------------------------------------------------------------
  // 🧠 Debounced render trigger (prevents double calls)
  // --------------------------------------------------------------
  function triggerRender() {
    if (renderPending) return;
    renderPending = setTimeout(() => {
      renderPending = null;
      renderTable();
    }, 150);
  }

  // --------------------------------------------------------------
  // 🔥 Firestore live listeners (scores + teamStatus)
  // --------------------------------------------------------------
  onSnapshot(scoresCollection, (snapshot) => {
    const fresh = {};
    snapshot.forEach(docSnap => (fresh[docSnap.id] = docSnap.data()));
    scoresData = fresh;
    triggerRender();
  });

  onSnapshot(teamStatusCollection, (snapshot) => {
    const fresh = {};
    snapshot.forEach(docSnap => (fresh[docSnap.id] = docSnap.data()));
    statusData = fresh;
    triggerRender();
  });

  // --------------------------------------------------------------
  // 🧹 Event-driven clears and reloads
  // --------------------------------------------------------------
  window.addEventListener('scoreboardCleared', () => {
    console.log('🧹 scoreboardCleared → wipe local caches + DOM');
    scoresData = {};
    statusData = {};
    titleEl.textContent = 'Scoreboard Cleared — Waiting...';
    scoreboardBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;color:#888;">
        Scoreboard cleared by Control.
      </td></tr>`;
  });

  window.addEventListener('forceScoreboardRefresh', async () => {
    console.log('🔄 forceScoreboardRefresh → re-fetch Firestore');
    titleEl.textContent = 'Scoreboard (Syncing...)';
    scoreboardBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;color:#aaa;">
        Refreshing data from Firestore...
      </td></tr>`;
    scoresData = {};
    statusData = {};
    await renderTable();
    titleEl.textContent = editable
      ? 'Scoreboard (Live & Editable)'
      : 'Team Standings (Live)';
  });
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
