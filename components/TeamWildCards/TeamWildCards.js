// ============================================================================
// COMPONENT: TeamWildCardsComponent
// PURPOSE: Display and manage team wild cards independently of the scoreboard
// ============================================================================

import { db } from '../../modules/config.js';
import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function TeamWildCardsComponent() {
  return `
    <section class="dashboard-section">
      <h2>🃏 Team Wild Cards Dashboard</h2>
      <p>Use this control to view or adjust each team's wild cards.</p>
      <div class="wildcard-controls">
        <label>
          Set All Wild Cards to:
          <input type="number" id="master-wildcard-input" min="0" value="1" />
        </label>
        <button id="apply-all-wildcards-btn" type="button">Apply to All Teams</button>
      </div>
      <table id="team-wildcards-table" class="data-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>Wild Cards</th>
            <th>Adjust</th>
          </tr>
        </thead>
        <tbody id="team-wildcards-body">
          <tr>
            <td colspan="3" style="text-align:center;color:#888;">Loading teams...</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

export async function initializeTeamWildCardsDashboard() {
  const tableBody = document.getElementById('team-wildcards-body');
  const applyAllBtn = document.getElementById('apply-all-wildcards-btn');
  const masterInput = document.getElementById('master-wildcard-input');

  if (!tableBody || !applyAllBtn || !masterInput) {
    console.warn('⚠️ Team Wild Cards dashboard missing DOM nodes.');
    return () => {};
  }

  const teamsRef = collection(db, 'teamStatus');
  const teamCountCells = new Map();

  async function renderTable() {
    teamCountCells.clear();

    let snapshot;
    try {
      snapshot = await getDocs(teamsRef);
    } catch (err) {
      console.error('❌ Failed to load team wild cards:', err);
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center;color:#c62828;">
            Failed to load team data.
          </td>
        </tr>`;
      return;
    }

    if (snapshot.empty) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center;color:#888;">
            No teams found.
          </td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const sortedDocs = snapshot.docs.slice().sort((a, b) => a.id.localeCompare(b.id));

    sortedDocs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const teamId = docSnap.id;
      const teamLabel = typeof data.teamName === 'string' && data.teamName.trim()
        ? data.teamName.trim()
        : teamId;
      const rawWildcard = Number(data.wildCards);
      const wildCards = Number.isFinite(rawWildcard) && rawWildcard >= 0
        ? rawWildcard
        : 0;

      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.textContent = teamLabel;

      const countCell = document.createElement('td');
      countCell.textContent = String(wildCards);
      teamCountCells.set(teamId, { cell: countCell, label: teamLabel });

      const actionsCell = document.createElement('td');
      const incBtn = document.createElement('button');
      incBtn.type = 'button';
      incBtn.dataset.teamId = teamId;
      incBtn.dataset.delta = '1';
      incBtn.textContent = '+1';

      const decBtn = document.createElement('button');
      decBtn.type = 'button';
      decBtn.dataset.teamId = teamId;
      decBtn.dataset.delta = '-1';
      decBtn.textContent = '-1';

      actionsCell.appendChild(incBtn);
      actionsCell.appendChild(decBtn);

      row.appendChild(nameCell);
      row.appendChild(countCell);
      row.appendChild(actionsCell);

      fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
  }

  function clampWildCards(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  }

  tableBody.onclick = async (event) => {
    const button = event.target.closest('button[data-team-id]');
    if (!button) return;

    const teamId = button.dataset.teamId;
    const delta = Number(button.dataset.delta || 0);
    const entry = teamCountCells.get(teamId);
    if (!entry) return;

    const previous = Number(entry.cell.textContent || 0);
    const next = clampWildCards(previous + delta);
    entry.cell.textContent = String(next);

    try {
      await updateDoc(doc(db, 'teamStatus', teamId), { wildCards: next });
    } catch (err) {
      console.error(`❌ Failed to update wild cards for ${teamId}:`, err);
      entry.cell.textContent = String(previous);
      alert(`Failed to update wild cards for ${entry.label}. Please try again.`);
    }
  };

  applyAllBtn.onclick = async () => {
    const targetValue = clampWildCards(masterInput.value);
    masterInput.value = String(targetValue);

    const updates = [];
    teamCountCells.forEach((entry, teamId) => {
      entry.cell.textContent = String(targetValue);
      updates.push(updateDoc(doc(db, 'teamStatus', teamId), { wildCards: targetValue }));
    });

    try {
      await Promise.all(updates);
      alert(`✅ All teams set to ${targetValue} wild card${targetValue === 1 ? '' : 's'}.`);
    } catch (err) {
      console.error('❌ Failed to apply wild cards to all teams:', err);
      alert('Failed to apply wild cards to all teams. Re-syncing table.');
      await renderTable();
    }
  };

  await renderTable();

  return () => {
    tableBody.onclick = null;
    applyAllBtn.onclick = null;
    teamCountCells.clear();
  };
}
