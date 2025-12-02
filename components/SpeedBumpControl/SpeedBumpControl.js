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
import {
  getDefaultPrompts,
  getSpeedBumpPromptBank,
  setSpeedBumpPromptBank
} from '../../modules/speedBumpChallenges.js';
import {
  loadBank,
  saveBankLocal,
  saveBankToFirestore
} from './controller/promptBank.js';

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
          <div class="${styles.legendCopy}">
            <p class="${styles.subhead}">Pick a Speed Bump and attacker for each team.</p>
            <span class="${styles.legendNote}">Attacker ≠ Victim · Pending → Active → Complete/Cancel</span>
          </div>
          <div class="${styles.legendControls}">
            <button id="speedbump-shuffle-all-btn" class="${styles.secondaryBtn}">Shuffle</button>
            <button id="speedbump-edit-bank-btn" class="${styles.secondaryBtn}">Edit Speed Bumps</button>
          </div>
        </div>
        <table class="${styles.dataTable}">
          <thead>
            <tr>
              <th>Team Name</th>
              <th>Speed Bump</th>
              <th>Attacker</th>
              <th>Status</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody id="speedbump-table-body">
            <tr><td colspan="5" class="${styles.legendNote}">Loading teams…</td></tr>
          </tbody>
        </table>
        <div id="speedbump-bank-modal" class="${styles.modalBackdrop}" style="display:none;">
          <div class="${styles.modalCard}">
            <div class="${styles.modalHeader}">
              <h3>Speed Bump Bank</h3>
              <button type="button" id="speedbump-bank-close" class="${styles.secondaryBtn}">Close</button>
            </div>
            <p class="${styles.modalHint}">One Speed Bump per line. Updates apply to the shared bank used for shuffling.</p>
            <textarea id="speedbump-bank-editor" class="${styles.bankTextarea}" rows="8" placeholder="Enter one Speed Bump per line"></textarea>
            <div class="${styles.modalFooter}">
              <button type="button" id="speedbump-bank-reset" class="${styles.secondaryBtn}">Reset to defaults</button>
              <button type="button" id="speedbump-bank-save" class="${styles.primaryBtn}">Save</button>
            </div>
          </div>
        </div>
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
    this.promptBank = getSpeedBumpPromptBank();
    this.unsubscribe = null;
    this.teardownFns = [];
    this.tableBody = null;
    this.bankModal = null;
    this.bankTextarea = null;
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
    const shuffleAllBtn = document.getElementById('speedbump-shuffle-all-btn');
    const editBankBtn = document.getElementById('speedbump-edit-bank-btn');
    const bankModal = document.getElementById('speedbump-bank-modal');
    const bankTextarea = document.getElementById('speedbump-bank-editor');
    const bankCloseBtn = document.getElementById('speedbump-bank-close');
    const bankSaveBtn = document.getElementById('speedbump-bank-save');
    const bankResetBtn = document.getElementById('speedbump-bank-reset');

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

    if (shuffleAllBtn) {
      const handleShuffleAll = () => this.handleGlobalShuffle();
      shuffleAllBtn.addEventListener('click', handleShuffleAll);
      this.teardownFns.push(() => shuffleAllBtn.removeEventListener('click', handleShuffleAll));
    }

    if (editBankBtn && bankModal && bankTextarea) {
      this.bankModal = bankModal;
      this.bankTextarea = bankTextarea;
      const handleOpenEditor = () => this.openBankModal();
      const handleCloseEditor = () => this.closeBankModal();
      editBankBtn.addEventListener('click', handleOpenEditor);
      bankCloseBtn?.addEventListener('click', handleCloseEditor);
      this.teardownFns.push(() => {
        editBankBtn.removeEventListener('click', handleOpenEditor);
        bankCloseBtn?.removeEventListener('click', handleCloseEditor);
      });

      if (bankSaveBtn) {
        const handleSave = () => this.saveBankEdits();
        bankSaveBtn.addEventListener('click', handleSave);
        this.teardownFns.push(() => bankSaveBtn.removeEventListener('click', handleSave));
      }

      if (bankResetBtn) {
        const handleReset = () => this.resetBankToDefault();
        bankResetBtn.addEventListener('click', handleReset);
        this.teardownFns.push(() => bankResetBtn.removeEventListener('click', handleReset));
      }
    }

    this.tableBody = tableBody;
    this.renderTable();
    this.wireTableEvents();
    this.hydratePromptBank();

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

  escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getSpeedBumpOptions(selectedPrompt) {
    const bank = Array.isArray(this.promptBank) ? [...this.promptBank] : [];
    const selected = selectedPrompt || '';
    if (selected && !bank.includes(selected)) {
      bank.unshift(selected);
    }
    return bank.map(prompt => {
      const sel = prompt === selected ? 'selected' : '';
      const safePrompt = this.escapeHtml(prompt);
      return `<option value="${safePrompt}" ${sel}>${safePrompt}</option>`;
    }).join('');
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
      const promptOptions = this.getSpeedBumpOptions(prompt);
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
          <select data-role="speedbump" class="${styles.promptSelect}">
            <option value="">Select Speed Bump</option>
            ${promptOptions}
          </select>
        </td>
        <td>
          <select data-role="attacker">
            <option value="">Select attacker</option>
            ${this.getAttackerOptions(victimId, attackerId)}
          </select>
        </td>
        <td data-role="status">${formatStatus(status)}</td>
        <td class="${styles.inlineActions}">
          <button data-action="activate" class="${styles.primaryBtn}">Activate</button>
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
      const promptSelect = row.querySelector('[data-role="speedbump"]');
      const attackerId = normalizeTeamId(attackerSelect?.value || '');
      const prompt = promptSelect?.value?.trim() || '';

      switch (btn.dataset.action) {
        case 'activate':
          await this.handleActivate({ victimId, attackerId, prompt });
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
      const row = event.target.closest('tr[data-team]');
      if (!row) return;
      if (event.target.closest('[data-role="speedbump"]')) {
        this.promptCache.set(row.dataset.team, event.target.value);
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
      const assignment = this.assignments.get(victimId);
      const status = this.currentStatus(victimId);
      const prompt = this.promptCache.get(victimId) || assignment?.prompt || '';
      const attacker = normalizeTeamId(
        row.querySelector('[data-role="attacker"]')?.value ||
        assignment?.attackerId ||
        ''
      );
      const activateBtn = row.querySelector('[data-action="activate"]');
      const completeBtn = row.querySelector('[data-action="complete"]');
      const cancelBtn = row.querySelector('[data-action="cancel"]');

      const isPending = status === SPEEDBUMP_STATUS.PENDING;
      const isActive = status === SPEEDBUMP_STATUS.ACTIVE;

      if (activateBtn) activateBtn.disabled = isActive || !attacker || !prompt;
      if (completeBtn) completeBtn.disabled = !(isPending || isActive);
      if (cancelBtn) cancelBtn.disabled = !(isPending || isActive);
    });
  }

  async handleShuffle(attackerId, { suppressAlert = false } = {}) {
    if (!attackerId) {
      if (!suppressAlert) alert('Select an attacker before shuffling.');
      return false;
    }
    try {
      await reshuffleSpeedBumpPrompt({
        gameId: this.gameId,
        attackerId
      });
      return true;
    } catch (err) {
      console.error('[SpeedBumpControl] shuffle failed:', err);
      if (!suppressAlert) alert(err?.message || 'Failed to shuffle prompt');
      return false;
    }
  }

  async handleGlobalShuffle() {
    const pending = Array.from(this.assignments.values()).filter(
      entry => entry?.status === SPEEDBUMP_STATUS.PENDING
    );
    if (!pending.length) {
      alert('No pending Speed Bumps to shuffle.');
      return;
    }

    for (const assignment of pending) {
      const attackerId = normalizeTeamId(assignment.attackerId || '');
      if (!attackerId) continue;
      await this.handleShuffle(attackerId, { suppressAlert: true });
    }
  }

  async handleActivate({ victimId, attackerId, prompt }) {
    if (!victimId) return;
    const assignment = this.assignments.get(victimId);
    const chosenPrompt = prompt || assignment?.prompt || '';
    const attacker = normalizeTeamId(attackerId || assignment?.attackerId || '');

    if (!attacker || !chosenPrompt) {
      alert('Select an attacker and Speed Bump before activating.');
      return;
    }

    const status = assignment?.status || 'idle';
    const isTerminal = status === SPEEDBUMP_STATUS.CANCELLED || status === SPEEDBUMP_STATUS.COMPLETED;
    const promptChanged = assignment?.prompt && assignment.prompt !== chosenPrompt;

    try {
      if (!assignment || isTerminal || promptChanged) {
        if (assignment && promptChanged && status === SPEEDBUMP_STATUS.PENDING) {
          await cancelSpeedBump({ gameId: this.gameId, attackerId: attacker }).catch(() => {});
        }
        await assignSpeedBump({
          gameId: this.gameId,
          attackerId: attacker,
          victimId,
          prompt: chosenPrompt
        });
      }
      await markSpeedBumpActive({
        gameId: this.gameId,
        attackerId: attacker
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

  async hydratePromptBank() {
    try {
      const bank = await loadBank();
      this.promptBank = bank;
      this.renderTable();
    } catch (err) {
      console.warn('[SpeedBumpControl] Failed to load Speed Bump bank from storage.', err);
      this.promptBank = getSpeedBumpPromptBank();
      this.renderTable();
    }
  }

  openBankModal() {
    if (!this.bankModal || !this.bankTextarea) return;
    const bank = Array.isArray(this.promptBank) && this.promptBank.length
      ? this.promptBank
      : getSpeedBumpPromptBank();
    this.bankTextarea.value = bank.join('\n');
    this.bankModal.style.display = 'block';
  }

  closeBankModal() {
    if (!this.bankModal) return;
    this.bankModal.style.display = 'none';
  }

  async saveBankEdits() {
    if (!this.bankTextarea) return;
    const lines = this.bankTextarea.value
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    try {
      const updated = setSpeedBumpPromptBank(lines);
      this.promptBank = updated;
      saveBankLocal(updated);
      await saveBankToFirestore(updated);
      this.renderTable();
      this.closeBankModal();
    } catch (err) {
      console.error('[SpeedBumpControl] Failed to save Speed Bump bank.', err);
      alert(err?.message || 'Failed to save Speed Bump bank');
    }
  }

  async resetBankToDefault() {
    try {
      const defaults = getDefaultPrompts();
      const updated = setSpeedBumpPromptBank(defaults);
      this.promptBank = updated;
      saveBankLocal(updated);
      await saveBankToFirestore(updated);
      if (this.bankTextarea) {
        this.bankTextarea.value = updated.join('\n');
      }
      this.renderTable();
    } catch (err) {
      console.error('[SpeedBumpControl] Failed to reset Speed Bump bank.', err);
      alert(err?.message || 'Failed to reset Speed Bump bank');
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
