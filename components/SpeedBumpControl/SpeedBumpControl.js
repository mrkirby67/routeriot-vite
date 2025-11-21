// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SpeedBumpControl/SpeedBumpControl.js
// PURPOSE: Legacy-style Speed Bump control UI (attacker → victim) with prompt bank + lifecycle controls
// DEPENDS_ON: ../../data.js, ../../services/speed-bump/speedBumpService.js
// USED_BY: control.js
// AUTHOR: Route Riot – Speed Bump Restoration
// CREATED: 2025-11-06
// AICP_VERSION: 3.1
// ============================================================================
// === END AICP COMPONENT HEADER ===

import styles from './SpeedBumpControl.module.css';
import { allTeams } from '../../data.js';
import {
  assignSpeedBump,
  reshuffleSpeedBumpPrompt,
  markSpeedBumpActive,
  completeSpeedBump,
  cancelSpeedBump,
  subscribeToGameSpeedBumps,
  SPEEDBUMP_STATUS
} from '../../services/speed-bump/speedBumpService.js';

const DEFAULT_GAME_ID = 'global';

function normalizeTeamId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function resolveGameId() {
  if (typeof window === 'undefined') return DEFAULT_GAME_ID;
  const candidates = [
    window.__rrGameId,
    window.__routeRiotGameId,
    window.sessionStorage?.getItem?.('activeGameId'),
    window.localStorage?.getItem?.('activeGameId')
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return DEFAULT_GAME_ID;
}

function formatStatus(status) {
  switch (status) {
    case SPEEDBUMP_STATUS.PENDING: return 'Pending';
    case SPEEDBUMP_STATUS.ACTIVE: return 'Active';
    case SPEEDBUMP_STATUS.COMPLETED: return 'Completed';
    case SPEEDBUMP_STATUS.CANCELLED: return 'Cancelled';
    default: return '—';
  }
}

function toTeamList() {
  return allTeams
    .map(team => ({
      id: normalizeTeamId(team.name || ''),
      name: team.name || ''
    }))
    .filter(t => t.id && t.name);
}

export function SpeedBumpControlComponent() {
  return `
    <div class="${styles.controlSection}">
      <div class="${styles.headerRow}">
        <h2>Speed Bumps</h2>
        <button id="toggle-speedbump-btn" class="${styles.secondaryBtn}">Expand ▼</button>
      </div>
      <div id="speedbump-panel" style="display:none;">
        <div class="${styles.promptLegend}">
          <div>
            <p class="${styles.subhead}">Assign prompts from the shared bank. Attacker frees victim when done.</p>
          </div>
          <div class="${styles.legendControls}">
            <span class="${styles.legendNote}">Attacker ≠ Victim · Pending → Active → Complete/Cancel</span>
          </div>
        </div>
        <table class="${styles.dataTable}">
          <thead>
            <tr>
              <th>Team Name</th>
              <th>Assigned Prompt</th>
              <th>Attacker</th>
              <th>Status</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody id="speedbump-table-body">
            <tr><td colspan="5" class="${styles.legendNote}">Loading teams…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

class SpeedBumpController {
  constructor() {
    this.gameId = resolveGameId();
    this.teams = toTeamList();
    this.assignments = new Map(); // victimId -> assignment
    this.promptCache = new Map();
    this.unsubscribe = null;
    this.teardownFns = [];
    this.tableBody = null;
  }

  teardown(reason = 'manual') {
    this.unsubscribe?.(reason);
    this.teardownFns.forEach(fn => {
      try { fn?.(reason); } catch {}
    });
    this.teardownFns = [];
  }

  mount() {
    const toggleBtn = document.getElementById('toggle-speedbump-btn');
    const panel = document.getElementById('speedbump-panel');
    const tableBody = document.getElementById('speedbump-table-body');

    if (!toggleBtn || !panel || !tableBody) {
      console.warn('[SpeedBumpControl] DOM not ready.');
      return () => {};
    }

    const handleToggle = () => {
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? 'Collapse ▲' : 'Expand ▼';
    };
    toggleBtn.addEventListener('click', handleToggle);
    this.teardownFns.push(() => toggleBtn.removeEventListener('click', handleToggle));

    this.tableBody = tableBody;
    this.renderTable();
    this.wireTableEvents();

    this.unsubscribe = subscribeToGameSpeedBumps(this.gameId, (assignments = []) => {
      this.assignments.clear();
      assignments.forEach((entry) => {
        const victim = normalizeTeamId(entry.victimId || '');
        if (!victim) return;
        this.assignments.set(victim, entry);
        if (entry.prompt) {
          this.promptCache.set(victim, entry.prompt);
        }
      });
      this.renderTable();
    });

    return (reason) => this.teardown(reason);
  }

  getAttackerOptions(victimId, selected) {
    return this.teams
      .filter(t => t.id !== victimId)
      .map(t => {
        const sel = selected && selected === t.id ? 'selected' : '';
        return `<option value="${t.id}" ${sel}>${t.name}</option>`;
      })
      .join('');
  }

  currentStatus(victimId) {
    return this.assignments.get(victimId)?.status || 'idle';
  }

  renderTable() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    if (!this.teams.length) {
      this.tableBody.innerHTML = `<tr><td colspan="5" class="${styles.legendNote}">No teams available.</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();
    this.teams.forEach(team => {
      const victimId = team.id;
      const assignment = this.assignments.get(victimId);
      const prompt = this.promptCache.get(victimId) || assignment?.prompt || '';
      const attackerId = assignment?.attackerId ? normalizeTeamId(assignment.attackerId) : '';
      const status = assignment?.status || 'idle';

      const row = document.createElement('tr');
      row.dataset.team = victimId;
      row.innerHTML = `
        <td class="${styles.teamCell}">
          <strong>${team.name}</strong>
          <span>${victimId}</span>
        </td>
        <td class="${styles.promptCell}">
          <input data-role="prompt" type="text" class="${styles.promptInput}" value="${prompt.replace(/"/g, '&quot;')}" placeholder="Select or shuffle a prompt">
        </td>
        <td>
          <select data-role="attacker">
            <option value="">Select attacker</option>
            ${this.getAttackerOptions(victimId, attackerId)}
          </select>
        </td>
        <td data-role="status">${formatStatus(status)}</td>
        <td class="${styles.inlineActions}">
          <button data-action="assign" class="${styles.primaryBtn}">Assign</button>
          <button data-action="shuffle" class="${styles.secondaryBtn}">Shuffle</button>
          <button data-action="activate" class="${styles.secondaryBtn}">Activate</button>
          <button data-action="complete" class="${styles.secondaryBtn}">Complete</button>
          <button data-action="cancel" class="${styles.secondaryBtn}">Cancel</button>
        </td>
      `;
      frag.appendChild(row);
    });

    this.tableBody.appendChild(frag);
    this.updateButtonStates();
  }

  wireTableEvents() {
    if (!this.tableBody) return;
    const handleClick = async (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      const row = btn.closest('tr[data-team]');
      if (!row) return;
      const victimId = row.dataset.team;
      const attackerSelect = row.querySelector('[data-role="attacker"]');
      const promptInput = row.querySelector('[data-role="prompt"]');
      const attackerId = normalizeTeamId(attackerSelect?.value || '');
      const prompt = promptInput?.value?.trim() || '';

      switch (btn.dataset.action) {
        case 'assign':
          await this.handleAssign({ attackerId, victimId, prompt });
          break;
        case 'shuffle':
          await this.handleShuffle({ attackerId, victimId });
          break;
        case 'activate':
          await this.handleActivate({ victimId });
          break;
        case 'complete':
          await this.handleComplete({ victimId });
          break;
        case 'cancel':
          await this.handleCancel({ victimId });
          break;
        default:
          break;
      }
    };

    const handleInput = (event) => {
      const input = event.target.closest('[data-role="prompt"]');
      const attackerSel = event.target.closest('[data-role="attacker"]');
      const row = event.target.closest('tr[data-team]');
      if (!row) return;
      if (input) {
        this.promptCache.set(row.dataset.team, input.value);
      }
      this.updateButtonStates();
    };

    this.tableBody.addEventListener('click', handleClick);
    this.tableBody.addEventListener('input', handleInput);
    this.tableBody.addEventListener('change', handleInput);
    this.teardownFns.push(() => {
      this.tableBody.removeEventListener('click', handleClick);
      this.tableBody.removeEventListener('input', handleInput);
      this.tableBody.removeEventListener('change', handleInput);
    });
  }

  updateButtonStates() {
    if (!this.tableBody) return;
    this.tableBody.querySelectorAll('tr[data-team]').forEach(row => {
      const victimId = row.dataset.team;
      const status = this.currentStatus(victimId);
      const prompt = this.promptCache.get(victimId) || '';
      const attacker = normalizeTeamId(row.querySelector('[data-role="attacker"]')?.value || '');
      const assignBtn = row.querySelector('[data-action="assign"]');
      const shuffleBtn = row.querySelector('[data-action="shuffle"]');
      const activateBtn = row.querySelector('[data-action="activate"]');
      const completeBtn = row.querySelector('[data-action="complete"]');
      const cancelBtn = row.querySelector('[data-action="cancel"]');

      const isPending = status === SPEEDBUMP_STATUS.PENDING;
      const isActive = status === SPEEDBUMP_STATUS.ACTIVE;

      if (assignBtn) assignBtn.disabled = !attacker || !prompt || isPending || isActive;
      if (shuffleBtn) shuffleBtn.disabled = !isPending;
      if (activateBtn) activateBtn.disabled = !isPending;
      if (completeBtn) completeBtn.disabled = !(isPending || isActive);
      if (cancelBtn) cancelBtn.disabled = !(isPending || isActive);
    });
  }

  async handleAssign({ attackerId, victimId, prompt }) {
    if (!attackerId || !victimId || !prompt) {
      alert('Attacker, victim, and prompt are required.');
      return;
    }
    if (attackerId === victimId) {
      alert('Attacker cannot target themselves.');
      return;
    }
    try {
      await assignSpeedBump({
        gameId: this.gameId,
        attackerId,
        victimId,
        prompt
      });
    } catch (err) {
      console.error('[SpeedBumpControl] assign failed:', err);
      alert(err?.message || 'Failed to assign Speed Bump');
    }
  }

  async handleShuffle({ attackerId }) {
    if (!attackerId) {
      alert('Select an attacker before shuffling.');
      return;
    }
    try {
      await reshuffleSpeedBumpPrompt({
        gameId: this.gameId,
        attackerId
      });
    } catch (err) {
      console.error('[SpeedBumpControl] shuffle failed:', err);
      alert(err?.message || 'Failed to shuffle prompt');
    }
  }

  async handleActivate({ victimId }) {
    const assignment = this.assignments.get(victimId);
    if (!assignment) return;
    try {
      await markSpeedBumpActive({
        gameId: this.gameId,
        attackerId: assignment.attackerId
      });
    } catch (err) {
      console.error('[SpeedBumpControl] activate failed:', err);
      alert(err?.message || 'Failed to activate Speed Bump');
    }
  }

  async handleComplete({ victimId }) {
    const assignment = this.assignments.get(victimId);
    if (!assignment) return;
    try {
      await completeSpeedBump({
        gameId: this.gameId,
        attackerId: assignment.attackerId
      });
    } catch (err) {
      console.error('[SpeedBumpControl] complete failed:', err);
      alert(err?.message || 'Failed to complete Speed Bump');
    }
  }

  async handleCancel({ victimId }) {
    const assignment = this.assignments.get(victimId);
    if (!assignment) return;
    try {
      await cancelSpeedBump({
        gameId: this.gameId,
        attackerId: assignment.attackerId
      });
    } catch (err) {
      console.error('[SpeedBumpControl] cancel failed:', err);
      alert(err?.message || 'Failed to cancel Speed Bump');
    }
  }
}

export function initializeSpeedBumpControl() {
  const controller = new SpeedBumpController();
  const cleanup = controller.mount();
  return cleanup;
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SpeedBumpControl/SpeedBumpControl.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.1
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: SpeedBumpControlComponent, initializeSpeedBumpControl
// linked_files: []
// owner: Route Riot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
