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
import { db } from '/core/config.js';
import { doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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
const CONTROL_ATTACKER_ID = 'Control';

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
    case SPEEDBUMP_STATUS.WAITING_RELEASE: return 'Release';
    case SPEEDBUMP_STATUS.COMPLETED: return 'Completed';
    case SPEEDBUMP_STATUS.CANCELLED: return 'Cancelled';
    case SPEEDBUMP_STATUS.EXPIRED: return 'Expired';
    default: return '—';
  }
}

function toMillis(value) {
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  return null;
}

function pickRandomPrompt(promptBank = [], exclusions = []) {
  const bank = Array.isArray(promptBank) ? promptBank.filter(Boolean) : [];
  if (!bank.length) return '';
  const exclusionSet = new Set(exclusions || []);
  const candidates = bank.filter(p => !exclusionSet.has(p));
  const pool = candidates.length ? candidates : bank;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] || '';
}

function toTeamList(activeNames = []) {
  const nameLookup = new Map(
    allTeams
      .map(team => [normalizeTeamId(team.name || ''), team.name || ''])
      .filter(([id, name]) => id && name)
  );

  if (!Array.isArray(activeNames)) return [];

  return activeNames
    .map(rawName => {
      const id = normalizeTeamId(rawName);
      if (!id) return null;
      const display = nameLookup.get(id) || rawName || '';
      if (!display) return null;
      return { id, name: display };
    })
    .filter(Boolean);
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
            <p class="${styles.subhead}">Set up the next Speed Bump for each team.</p>
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
              <th>Last Launch (Team Sent)</th>
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
    this.teams = [];
    this.assignments = new Map(); // victimId -> assignment
    this.promptCache = new Map();
    this.lastLaunchByTeam = new Map(); // victimId -> attacker display
    this.lastAppliedPrompt = new Map(); // victimId -> prompt last applied
    this.promptBank = getSpeedBumpPromptBank();
    this.unsubscribe = null;
    this.teardownFns = [];
    this.tableBody = null;
    this.bankModal = null;
    this.bankTextarea = null;
    this.activeTeamsUnsub = null;
  }

  teardown(reason = 'manual') {
    this.unsubscribe?.(reason);
    this.activeTeamsUnsub?.();
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
    this.listenToActiveTeams();

    this.unsubscribe = subscribeToGameSpeedBumps(this.gameId, (assignments = []) => {
      this.assignments.clear();
      assignments.forEach((entry) => {
        const victim = normalizeTeamId(entry.victimId || '');
        if (!victim) return;
        this.assignments.set(victim, entry);
        if (entry.attackerId) {
          this.lastLaunchByTeam.set(victim, entry.attackerId);
        }
        this.handleAppliedAssignment(victim, entry);
      });
      this.renderTable();
    });

    return (reason) => this.teardown(reason);
  }

  getAttackerOptions(victimId, selected) {
    return '';
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

  remainingLabel(assignment) {
    if (!assignment) return '';
    const status = assignment.status || '';
    const targetTs = status === SPEEDBUMP_STATUS.WAITING_RELEASE
      ? assignment.releaseEndsAt
      : assignment.blockEndsAt;
    const ts = toMillis(targetTs);
    if (!Number.isFinite(ts)) return '';
    const diff = Math.max(0, ts - Date.now());
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  formatLastLaunch(assignment) {
    if (!assignment) return '—';
    const when = toMillis(assignment.createdAt || assignment.activatedAt);
    const timeLabel = Number.isFinite(when) ? new Date(when).toLocaleTimeString() : '';
    return [assignment.attackerId || '—', timeLabel].filter(Boolean).join(' · ');
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
      const lastLaunch = this.formatLastLaunch(assignment);
      const status = assignment?.status || 'idle';

      const row = document.createElement('tr');
      row.dataset.team = victimId;
      row.innerHTML = `
        <td class="${styles.teamCell}">
          <strong>${team.name}</strong>
        </td>
        <td class="${styles.promptCell}">
          <select data-role="speedbump" class="${styles.promptSelect}">
            <option value="">Select Speed Bump</option>
            ${promptOptions}
          </select>
        </td>
        <td data-role="last-launch">${this.escapeHtml(lastLaunch)}</td>
        <td data-role="status">${formatStatus(status)} ${this.remainingLabel(assignment)}</td>
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
      const promptSelect = row.querySelector('[data-role="speedbump"]');
      const prompt = promptSelect?.value?.trim() || '';

      switch (btn.dataset.action) {
        case 'activate':
          await this.handleActivate({ victimId, prompt });
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
      const activateBtn = row.querySelector('[data-action="activate"]');
      const completeBtn = row.querySelector('[data-action="complete"]');
      const cancelBtn = row.querySelector('[data-action="cancel"]');

      const isPending = status === SPEEDBUMP_STATUS.PENDING;
      const isActive = status === SPEEDBUMP_STATUS.ACTIVE;
      const isWaiting = status === SPEEDBUMP_STATUS.WAITING_RELEASE;

      if (activateBtn) activateBtn.disabled = isActive || isWaiting || !prompt;
      if (completeBtn) completeBtn.disabled = !(isPending || isActive || isWaiting);
      if (cancelBtn) cancelBtn.disabled = !(isPending || isActive || isWaiting);
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
      if (err?.message?.includes('No Speed Bump found for this attacker')) {
        console.warn('[SpeedBumpControl] Skipping shuffle; no Speed Bump for attacker:', attackerId);
        return false;
      }
      console.error('[SpeedBumpControl] shuffle failed:', err);
      if (!suppressAlert) alert(err?.message || 'Failed to shuffle prompt');
      return false;
    }
  }

  async handleGlobalShuffle() {
    const bank = Array.isArray(this.promptBank) ? this.promptBank : [];
    if (!bank.length) {
      alert('No Speed Bump prompts available to shuffle.');
      return;
    }

    this.teams.forEach(team => {
      const victimId = team.id;
      const currentPrompt = this.promptCache.get(victimId) || '';
      const next = pickRandomPrompt(bank, currentPrompt ? [currentPrompt] : []);
      if (next) {
        this.promptCache.set(victimId, next);
        this.applyPromptSelectionToDom(victimId, next);
      }
    });

    this.updateButtonStates();
  }

  async handleActivate({ victimId, prompt }) {
    if (!victimId) return;
    const assignment = this.assignments.get(victimId);
    const chosenPrompt = prompt || assignment?.prompt || '';
    const existingAttacker = assignment?.attackerId ? normalizeTeamId(assignment.attackerId) : null;
    const controlAttacker = CONTROL_ATTACKER_ID;
    const attackerToUse = existingAttacker || controlAttacker;

    if (!chosenPrompt) {
      alert('Select a Speed Bump before activating.');
      return;
    }

    const status = assignment?.status || 'idle';
    const isTerminal = status === SPEEDBUMP_STATUS.CANCELLED || status === SPEEDBUMP_STATUS.COMPLETED;
    const promptChanged = assignment?.prompt && assignment.prompt !== chosenPrompt;

    try {
      if (!assignment || isTerminal || promptChanged) {
        if (assignment && promptChanged && status === SPEEDBUMP_STATUS.PENDING && existingAttacker) {
          await cancelSpeedBump({ gameId: this.gameId, attackerId: existingAttacker }).catch(() => {});
        }
        await assignSpeedBump({
          gameId: this.gameId,
          attackerId: controlAttacker,
          victimId,
          prompt: chosenPrompt,
          status: 'active',
          attackerContact: [{ name: 'Game Control', email: 'control@routeriot.game', phone: '555-0100' }]
        });
      }
      await markSpeedBumpActive({
        gameId: this.gameId,
        attackerId: attackerToUse,
        victimId
      });
      this.lastLaunchByTeam.set(victimId, attackerToUse);
      this.applyPromptSelectionToDom(victimId, this.promptCache.get(victimId) || '');
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
        attackerId: assignment.attackerId,
        victimId: assignment.victimId,
        assignmentId: assignment.id
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
        attackerId: assignment.attackerId,
        victimId: assignment.victimId,
        assignmentId: assignment.id
      });
    } catch (err) {
      console.error('[SpeedBumpControl] cancel failed:', err);
      alert(err?.message || 'Failed to cancel Speed Bump');
    }
  }

  async listenToActiveTeams() {
    const applyList = (list = []) => {
      const deduped = [];
      const seen = new Set();
      list.forEach(name => {
        const id = normalizeTeamId(name || '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        deduped.push(name);
      });

      this.teams = toTeamList(deduped);

      const allowed = new Set(this.teams.map(t => t.id));
      Array.from(this.promptCache.keys()).forEach(key => {
        if (!allowed.has(key)) this.promptCache.delete(key);
      });
      Array.from(this.lastLaunchByTeam.keys()).forEach(key => {
        if (!allowed.has(key)) this.lastLaunchByTeam.delete(key);
      });
      Array.from(this.lastAppliedPrompt.keys()).forEach(key => {
        if (!allowed.has(key)) this.lastAppliedPrompt.delete(key);
      });

      this.renderTable();
    };

    try {
      const snap = await getDoc(doc(db, 'game', 'activeTeams'));
      const list = snap.exists() && Array.isArray(snap.data()?.list) ? snap.data().list : [];
      applyList(list);
    } catch (err) {
      console.warn('[SpeedBumpControl] Failed to load active teams once.', err);
    }

    try {
      this.activeTeamsUnsub = onSnapshot(
        doc(db, 'game', 'activeTeams'),
        (docSnap) => {
          const list = docSnap.exists() && Array.isArray(docSnap.data()?.list) ? docSnap.data().list : [];
          applyList(list);
        },
        (err) => console.error('[SpeedBumpControl] activeTeams listener failed:', err)
      );
    } catch (err) {
      console.error('[SpeedBumpControl] Unable to subscribe to active teams.', err);
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

  handleAppliedAssignment(victimId, entry) {
    if (!victimId || !entry) return;
    const appliedPrompt = entry.prompt || '';
    if (!appliedPrompt) return;
    const last = this.lastAppliedPrompt.get(victimId);
    if (last === appliedPrompt) return;
    this.lastAppliedPrompt.set(victimId, appliedPrompt);
    this.shufflePromptForTeam(victimId, appliedPrompt);
  }

  shufflePromptForTeam(victimId, excludePrompt = '') {
    const next = pickRandomPrompt(this.promptBank, [excludePrompt]);
    if (!next) return;
    this.promptCache.set(victimId, next);
    this.applyPromptSelectionToDom(victimId, next);
  }

  applyPromptSelectionToDom(victimId, promptValue) {
    const row = this.tableBody?.querySelector(`tr[data-team="${victimId}"]`);
    if (row) {
      const select = row.querySelector('[data-role="speedbump"]');
      if (select) {
        select.value = promptValue;
      }
      const lastLaunchCell = row.querySelector('[data-role="last-launch"]');
      if (lastLaunchCell) {
        const val = this.lastLaunchByTeam.get(victimId);
        if (val) lastLaunchCell.textContent = val;
      }
      this.updateButtonStates();
    } else {
      this.renderTable();
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
