// File: components/Scoreboard/Scoreboard.js
import { db } from '../../modules/config.js';
import { addPointsToTeam, updateControlledZones } from '../../modules/scoreboardManager.js';
import {
  onSnapshot,
  collection,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './Scoreboard.module.css';

/* ---------------------------------------------------------------------------
 *  SCOREBOARD COMPONENT (Unified for Control & Player)
 * ------------------------------------------------------------------------ */
export function ScoreboardComponent({ editable = true } = {}) {
  return `
    <div class="${styles.controlSection}">
      <h2>${editable ? 'Scoreboard (Live & Editable)' : 'Team Standings (Live)'}</h2>
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
  if (!scoreboardBody) return;

  const scoresCollection = collection(db, 'scores');
  const teamStatusCollection = collection(db, 'teamStatus');
  const scoresData = {};
  const statusData = {};

  async function renderTable() {
    const activeSnap = await getDoc(doc(db, 'game', 'activeTeams'));
    const activeTeams = activeSnap.exists() ? activeSnap.data().list || [] : [];

    if (activeTeams.length === 0) {
      scoreboardBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;color:#aaa;">
          Waiting for game to start — no active teams yet.
        </td></tr>`;
      return;
    }

    scoreboardBody.innerHTML = '';

    activeTeams.forEach(teamName => {
      const scoreInfo = scoresData[teamName] || {};
      const statusInfo = statusData[teamName] || {};
      const score = scoreInfo.score || 0;
      const zones = scoreInfo.zonesControlled || '—';
      const loc = statusInfo.lastKnownLocation || '—';
      const time = statusInfo.timestamp
        ? new Date(statusInfo.timestamp.seconds * 1000).toLocaleTimeString()
        : '—';

      const row = document.createElement('tr');

      if (editable) {
        // Editable version (Control page)
        row.innerHTML = `
          <td>${teamName}</td>
          <td>
            <input type="number"
                   id="score-${teamName.replace(/\s/g, '')}"
                   value="${score}"
                   class="${styles.scoreInput}">
          </td>
          <td>${zones}</td>
          <td>${loc}</td>
          <td>
            <button class="${styles.adjustBtn}" data-team="${teamName}" data-change="+1">+1</button>
            <button class="${styles.adjustBtn}" data-team="${teamName}" data-change="-1">-1</button>
          </td>
        `;
      } else {
        // Read-only version (Player page)
        row.innerHTML = `
          <td>${teamName}</td>
          <td>${score}</td>
          <td>${zones}</td>
          <td>${loc}</td>
          <td>${time}</td>
        `;
      }

      scoreboardBody.appendChild(row);
    });

    if (editable) attachHandlers();
  }

  function attachHandlers() {
    document.querySelectorAll(`.${styles.adjustBtn}`).forEach(button => {
      button.onclick = async (e) => {
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

  // --- Live Listeners ---
  onSnapshot(scoresCollection, (snapshot) => {
    snapshot.forEach(docSnap => {
      scoresData[docSnap.id] = docSnap.data();
    });
    renderTable();
  });

  onSnapshot(teamStatusCollection, (snapshot) => {
    snapshot.forEach(docSnap => {
      statusData[docSnap.id] = docSnap.data();
    });
    renderTable();
  });
}