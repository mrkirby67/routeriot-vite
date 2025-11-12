// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SpeedBumpControl/SpeedBumpControl.js
// PURPOSE: Control panel UI for firing Speed Bump events.
// DEPENDS_ON: ../../services/teamService.js, ../../services/speed-bump/speedBumpService.js
// USED_BY: control.js
// AUTHOR: Route Riot – Speed Bump Refresh
// CREATED: 2025-10-30
// AICP_VERSION: 3.1
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { getAllTeams } from '../../services/teamService.js';
import { allTeams } from '../../data.js';
import {
  triggerSpeedBump,
  subscribeToSpeedBumpStatuses
} from '../../services/speed-bump/speedBumpService.js';
import { notify } from '/core/eventBus.js';

const teardownCallbacks = [];
const statusCells = new Map();

function normalizeTeamId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function registerTeardown(fn) {
  if (typeof fn === 'function') teardownCallbacks.push(fn);
}

function runTeardown(reason = 'manual') {
  while (teardownCallbacks.length) {
    const handler = teardownCallbacks.pop();
    try {
      handler?.(reason);
    } catch (err) {
      console.error('[SpeedBumpControl] teardown handler failed:', err);
    }
  }
  statusCells.clear();
}

function formatStatus({ active, type } = {}) {
  if (!active) return 'Idle';
  const label = type === 'flat-tire' ? 'Flat Tire' : 'Slowdown';
  return `Active – ${label}`;
}

function setStatus(teamId, payload) {
  const normalized = normalizeTeamId(teamId);
  const meta = normalized ? statusCells.get(normalized) : null;
  if (!meta) return;
  const { cell } = meta;
  cell.textContent = formatStatus(payload);
  cell.dataset.state = payload?.active ? 'active' : 'idle';
  if (payload?.type) {
    cell.dataset.type = payload.type;
  } else {
    delete cell.dataset.type;
  }
}

function createActionButton(teamId, teamName, type, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'speedbump-control__btn';
  button.dataset.team = teamId;
  button.dataset.teamName = teamName;
  button.dataset.speedbump = type;
  button.textContent = label;
  return button;
}

function buildRow(team) {
  const nameFromData = typeof team.name === 'string' && team.name.trim() ? team.name.trim() : '';
  const rawId = typeof team.id === 'string' && team.id.trim() ? team.id.trim() : '';
  const preferredId = rawId || nameFromData;
  const normalizedId = normalizeTeamId(preferredId);
  if (!normalizedId) return null;

  const teamName = nameFromData || preferredId || 'Unknown Team';

  const row = document.createElement('tr');
  row.dataset.teamId = normalizedId;

  const nameCell = document.createElement('td');
  nameCell.textContent = teamName;

  const statusCell = document.createElement('td');
  statusCell.dataset.role = 'status';
  statusCell.textContent = 'Idle';

  const actionsCell = document.createElement('td');
  actionsCell.className = 'speedbump-control__actions';
  actionsCell.appendChild(createActionButton(normalizedId, teamName, 'flat-tire', 'Flat Tire'));
  actionsCell.appendChild(createActionButton(normalizedId, teamName, 'slowdown', 'Slowdown'));

  row.append(nameCell, statusCell, actionsCell);
  statusCells.set(normalizedId, { cell: statusCell, name: teamName });
  return row;
}

function bindButtons(root) {
  const buttons = root.querySelectorAll('[data-speedbump]');
  buttons.forEach((button) => {
    const handleClick = async (event) => {
      const current = event.currentTarget;
      const teamId = current.dataset.team;
      const teamName = current.dataset.teamName || teamId;
      const type = current.dataset.speedbump;

      if (!teamId || !type) return;

      const normalizedId = normalizeTeamId(teamId);
      const statusMeta = normalizedId ? statusCells.get(normalizedId) : null;
      if (statusMeta) {
        statusMeta.cell.textContent = 'Sending…';
        statusMeta.cell.dataset.state = 'pending';
      }

      current.disabled = true;
      current.classList.add('is-pending');

      try {
        await triggerSpeedBump(teamId, type, { teamName });
        console.info(`🚧 Speed Bump sent to ${teamName} (${type})`);
        notify({ kind: 'info', text: 'Speed Bump Sent!', timeout: 2500 });
      } catch (err) {
        console.error(`⚠️ Failed to trigger speed bump for ${teamName}:`, err);
        if (statusMeta) {
          statusMeta.cell.textContent = 'Failed';
          statusMeta.cell.dataset.state = 'error';
        }
      }

      setTimeout(() => {
        current.disabled = false;
        current.classList.remove('is-pending');
      }, 5_000);
    };

    button.addEventListener('click', handleClick);
    registerTeardown(() => button.removeEventListener('click', handleClick));
  });
}

function subscribeToStatuses() {
  const unsubscribe = subscribeToSpeedBumpStatuses((map) => {
    if (!(map instanceof Map)) return;
    statusCells.forEach((_, teamId) => {
      const payload = map.get(teamId);
      setStatus(teamId, payload);
    });
  });

  registerTeardown(() => unsubscribe?.());
}

export function SpeedBumpControlComponent() {
  return `
    <section class="speedbump-control">
      <header class="speedbump-control__header">
        <h2>🚧 Speed Bump Control</h2>
        <p>Trigger quick challenges to slow teams down.</p>
      </header>
      <table id="speedbump-table" class="speedbump-control__table">
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody id="speedbump-table-body">
          <tr>
            <td colspan="3">Loading teams…</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function normalizeTeamRecord(record) {
  if (!record) return null;
  const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : '';
  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return id ? { ...record, id, name: name || record.id || id } : null;
}

export async function initializeSpeedBumpControl() {
  runTeardown('reinitialize');

  const tableBody = document.getElementById('speedbump-table-body');
  if (!tableBody) {
    console.warn('⚠️ [SpeedBumpControl] Missing #speedbump-table-body');
    return () => {};
  }

  tableBody.innerHTML = `
    <tr>
      <td colspan="3">Loading teams…</td>
    </tr>
  `;

  let teams = [];
  try {
    teams = await getAllTeams();
  } catch (err) {
    console.error('⚠️ [SpeedBumpControl] Failed to load teams:', err);
  }

  if (!Array.isArray(teams) || !teams.length) {
    console.warn('[SpeedBumpControl] No Firestore teams found. Falling back to data.js roster.');
    let fallbackCounter = 0;
    teams = allTeams
      .map((team) =>
        normalizeTeamRecord({
          id: team?.name || team?.email || `fallback-team-${fallbackCounter++}`,
          name: team?.name,
          slogan: team?.slogan,
        }),
      )
      .filter(Boolean);
  } else {
    teams = teams.map(normalizeTeamRecord).filter(Boolean);
  }

  if (!teams.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="3">No teams available.</td>
      </tr>
    `;
    return (reason = 'manual') => runTeardown(reason);
  }

  statusCells.clear();
  tableBody.innerHTML = '';
  teams
    .map((team) => buildRow(team))
    .filter(Boolean)
    .forEach((row) => tableBody.appendChild(row));

  if (!tableBody.children.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="3">No teams available.</td>
      </tr>
    `;
    return (reason = 'manual') => runTeardown(reason);
  }

  bindButtons(tableBody);
  subscribeToStatuses();

  return (reason = 'manual') => runTeardown(reason);
}

export function teardownSpeedBumpControl(reason = 'manual') {
  runTeardown(reason);
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SpeedBumpControl/SpeedBumpControl.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.1
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: SpeedBumpControlComponent, initializeSpeedBumpControl, teardownSpeedBumpControl
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// === END AICP COMPONENT FOOTER ===
