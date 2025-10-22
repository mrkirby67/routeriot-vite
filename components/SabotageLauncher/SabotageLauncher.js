// ============================================================================
// FILE: components/SabotageLauncher/SabotageLauncher.js
// PURPOSE: Team list for launching Bug Strikes and Speed Bumps with cooldowns
// ============================================================================

import { allTeams } from '../../data.js';
import { grantBugStrike } from '../../modules/bugStrikeManager.js';
import {
  sendSpeedBump,
  startCooldown,
  subscribeSpeedBumps,
  getCooldownRemaining,
  getActiveBump
} from '../../modules/speedBumpManager.js';
import { getRandomSpeedBumpPrompt } from '../../modules/speedBumpChallenges.js';
import styles from './SabotageLauncher.module.css';

let unsubscribe = null;
let overrideToggle = null;
let tableBody = null;

export function SabotageLauncherComponent() {
  return `
    <div class="${styles.launcherSection}">
      <div class="${styles.headerRow}">
        <h3>🎯 Sabotage Launcher</h3>
        <label class="${styles.overrideToggle}">
          <input type="checkbox" id="sabotage-override" checked>
          <span>Admin override</span>
        </label>
      </div>
      <table class="${styles.launcherTable}">
        <thead>
          <tr>
            <th>Team</th>
            <th>Bug Strike</th>
            <th>Speed Bump</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="sabotage-table-body">
          <tr><td colspan="4" class="${styles.loading}">Loading sabotage targets…</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export function initializeSabotageLauncher() {
  tableBody = document.getElementById('sabotage-table-body');
  overrideToggle = document.getElementById('sabotage-override');
  if (!tableBody || !overrideToggle) {
    console.warn('⚠️ Sabotage launcher not mounted.');
    return () => {};
  }

  renderInitialRows();
  unsubscribe = subscribeSpeedBumps(() => renderRows());
  renderRows();

  return reason => teardownSabotageLauncher(reason);
}

export function teardownSabotageLauncher(reason = 'manual') {
  unsubscribe?.();
  unsubscribe = null;
  tableBody = null;
  overrideToggle = null;
  console.info(`🧹 [sabotageLauncher] destroyed (${reason})`);
}

function renderInitialRows() {
  tableBody.innerHTML = '';
  allTeams.forEach(team => {
    const tr = document.createElement('tr');
    tr.dataset.team = team.name;
    tr.innerHTML = `
      <td class="${styles.teamCell}">
        <strong>${team.name}</strong>
        <span>${team.slogan || ''}</span>
      </td>
      <td>
        <button type="button" class="${styles.actionBtn}" data-role="bug">🐞 Bug Strike</button>
        <div class="${styles.cooldownLabel}" data-role="bug-status">Ready</div>
      </td>
      <td>
        <button type="button" class="${styles.actionBtn} ${styles.bumpBtn}" data-role="bump">🚧 Speed Bump</button>
        <div class="${styles.cooldownLabel}" data-role="bump-status">Ready</div>
      </td>
      <td data-role="status">—</td>
    `;
    tableBody.appendChild(tr);
  });

  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-role]');
    if (!button) return;
    const tr = button.closest('tr[data-team]');
    if (!tr) return;
    const teamName = tr.dataset.team;
    const role = button.dataset.role;
    const override = overrideToggle?.checked ?? true;

    if (role === 'bug') {
      await launchBugStrike(teamName, override);
    } else if (role === 'bump') {
      await launchSpeedBump(teamName, override);
    }
  });
}

async function launchBugStrike(targetTeam, override) {
  const remaining = getCooldownRemaining(targetTeam, 'bug');
  if (!override && remaining > 0) {
    alert(`🐞 Bug Strike cooldown active (${Math.ceil(remaining / 1000)}s).`);
    return;
  }
  await grantBugStrike(targetTeam, 'sabotage');
  startCooldown(targetTeam, 'bug');
  renderRows();
}

async function launchSpeedBump(targetTeam, override) {
  const controlTeam = 'Control';
  const cooldownMs = getCooldownRemaining(controlTeam, 'bump');
  if (!override && cooldownMs > 0) {
    alert(`🚧 Speed Bump cooldown active (${Math.ceil(cooldownMs / 1000)}s).`);
    return;
  }

  const prompt = getRandomSpeedBumpPrompt();
  const result = await sendSpeedBump(controlTeam, targetTeam, prompt, { override });
  if (!result.ok && !override) {
    alert(`🚧 Speed Bump cooldown active (${result.reason}s remaining).`);
    return;
  }
  renderRows();
}

function renderRows() {
  if (!tableBody) return;
  allTeams.forEach(team => {
    const row = tableBody.querySelector(`tr[data-team="${team.name}"]`);
    if (!row) return;

    updateBugStrikeUI(row, team.name);
    updateSpeedBumpUI(row, team.name);
  });
}

function updateBugStrikeUI(row, teamName) {
  const statusEl = row.querySelector('[data-role="bug-status"]');
  const button = row.querySelector('button[data-role="bug"]');
  if (!statusEl || !button) return;

  const override = overrideToggle?.checked ?? true;
  const remainingMs = getCooldownRemaining(teamName, 'bug');

  if (!override && remainingMs > 0) {
    button.disabled = true;
    statusEl.textContent = `Cooldown: ${formatSeconds(Math.ceil(remainingMs / 1000))}`;
  } else {
    button.disabled = false;
    statusEl.textContent = 'Ready';
  }
}

function updateSpeedBumpUI(row, teamName) {
  const statusEl = row.querySelector('[data-role="bump-status"]');
  const button = row.querySelector('button[data-role="bump"]');
  const summaryCell = row.querySelector('[data-role="status"]');
  if (!statusEl || !button || !summaryCell) return;

  const override = overrideToggle?.checked ?? true;
  const remainingMs = getCooldownRemaining('Control', 'bump');

  if (!override && remainingMs > 0) {
    button.disabled = true;
    statusEl.textContent = `Cooldown: ${formatSeconds(Math.ceil(remainingMs / 1000))}`;
  } else {
    button.disabled = false;
    statusEl.textContent = 'Ready';
  }

  const bumpState = getActiveBump(teamName);
  summaryCell.textContent = bumpState ? `🚧 Active from ${bumpState.by}` : 'Clear';
}

function formatSeconds(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
