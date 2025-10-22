// ============================================================================
// FILE: components/SpeedBumpControl/speedBumpControlController.js
// PURPOSE: UI orchestration for Speed Bump – Photo Challenge control panel
// ============================================================================

import styles from './SpeedBumpControl.module.css';
import { allTeams } from '../../data.js';
import { getRandomSpeedBumpPrompt, getDefaultPrompts } from '../../modules/speedBumpChallenges.js';
import {
  sendSpeedBump,
  releaseSpeedBump,
  subscribeSpeedBumps,
  getCooldownRemaining,
  getActiveBump
} from '../../modules/speedBumpManager.js';

const DEFAULT_PROMPTS = new Map();

function initPrompts() {
  if (DEFAULT_PROMPTS.size) return;
  const defaults = getDefaultPrompts();
  let idx = 0;
  allTeams.forEach(team => {
    const prompt = defaults[idx % defaults.length];
    DEFAULT_PROMPTS.set(team.name, prompt);
    idx++;
  });
}

function loadPersistedPrompts() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('speedBumpPrompts');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (err) {
    console.warn('⚠️ Failed to load stored Speed Bump prompts:', err);
  }
  return {};
}

function persistPrompts(map) {
  if (typeof window === 'undefined') return;
  try {
    const obj = {};
    map.forEach((value, key) => {
      obj[key] = value;
    });
    window.localStorage.setItem('speedBumpPrompts', JSON.stringify(obj));
  } catch (err) {
    console.warn('⚠️ Failed to persist Speed Bump prompts:', err);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createSpeedBumpControlController() {
  initPrompts();
  return new SpeedBumpControlController();
}

class SpeedBumpControlController {
  constructor() {
    this.dom = {
      tableBody: null,
      overrideToggle: null,
      shuffleAllBtn: null,
      saveBtn: null,
      resetBtn: null
    };
    this.promptByTeam = new Map(DEFAULT_PROMPTS);
    this.loadSavedPrompts();
    this.unsubscribe = null;
    this.handleStatePush = this.handleStatePush.bind(this);
    this.onOverrideChange = this.renderRows.bind(this);
    this.handleSave = this.handleSave.bind(this);
    this.handleReset = this.handleReset.bind(this);
  }

  loadSavedPrompts() {
    const stored = loadPersistedPrompts();
    Object.entries(stored).forEach(([team, prompt]) => {
      if (typeof prompt === 'string' && prompt.trim()) {
        this.promptByTeam.set(team, prompt);
      }
    });
  }

  initialize() {
    const tableBody = document.getElementById('speedbump-table-body');
    const overrideToggle = document.getElementById('speedbump-admin-override');
    const shuffleAllBtn = document.getElementById('speedbump-shuffle-all');
    const saveBtn = document.getElementById('speedbump-save-prompts');
    const resetBtn = document.getElementById('speedbump-reset-prompts');
    if (!tableBody || !overrideToggle || !shuffleAllBtn || !saveBtn || !resetBtn) {
      console.warn('⚠️ Speed Bump control DOM not ready.');
      return () => {};
    }

    this.dom = { tableBody, overrideToggle, shuffleAllBtn, saveBtn, resetBtn };
    overrideToggle.addEventListener('change', this.onOverrideChange);
    saveBtn.addEventListener('click', this.handleSave);
    resetBtn.addEventListener('click', this.handleReset);
    this.renderInitialRows();

    shuffleAllBtn.addEventListener('click', () => {
      allTeams.forEach(team => {
        this.promptByTeam.set(team.name, getRandomSpeedBumpPrompt([this.promptByTeam.get(team.name)]));
      });
      this.renderRows();
    });

    this.unsubscribe = subscribeSpeedBumps(this.handleStatePush);
    this.renderRows();
    return reason => this.destroy(reason);
  }

  destroy(reason = 'manual') {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.dom.overrideToggle) {
      this.dom.overrideToggle.removeEventListener('change', this.onOverrideChange);
    }
    if (this.dom.saveBtn) {
      this.dom.saveBtn.removeEventListener('click', this.handleSave);
    }
    if (this.dom.resetBtn) {
      this.dom.resetBtn.removeEventListener('click', this.handleReset);
    }
    if (this.dom.shuffleAllBtn) {
      this.dom.shuffleAllBtn.replaceWith(this.dom.shuffleAllBtn.cloneNode(true));
    }
    this.dom = { tableBody: null, overrideToggle: null, shuffleAllBtn: null, saveBtn: null, resetBtn: null };
    console.info(`🧹 [speedBumpControl] destroyed (${reason})`);
  }

  handleStatePush() {
    this.renderRows();
  }

  renderInitialRows() {
    const { tableBody } = this.dom;
    tableBody.innerHTML = '';
    allTeams.forEach(team => {
      const tr = document.createElement('tr');
      tr.dataset.team = team.name;
      tr.innerHTML = `
        <td class="${styles.teamCell}">
          <strong>${team.name}</strong>
          <span>${team.slogan || ''}</span>
        </td>
        <td class="${styles.promptCell}">
          <input type="text" class="${styles.promptInput}" data-role="prompt-input" value="${escapeHtml(this.promptByTeam.get(team.name) || '')}" autocomplete="off" spellcheck="false" />
          <div class="${styles.inlineActions}">
            <button type="button" class="${styles.shuffleBtn}" data-role="shuffle">🔁 Shuffle</button>
          </div>
        </td>
        <td class="${styles.inlineActions}">
          <button type="button" class="${styles.actionBtn}" data-role="send">🚧 Send</button>
          <button type="button" class="${styles.actionBtn} ${styles.releaseBtn}" data-role="release">🟢 Release</button>
        </td>
        <td data-role="status">—</td>
      `;
      tableBody.appendChild(tr);
    });

    tableBody.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('button[data-role]');
      if (!actionBtn) return;
      const tr = event.target.closest('tr[data-team]');
      if (!tr) return;
      const teamName = tr.dataset.team;
      const role = actionBtn.dataset.role;
      if (role === 'shuffle') {
        this.promptByTeam.set(teamName, getRandomSpeedBumpPrompt([this.promptByTeam.get(teamName)]));
        this.updateRow(teamName);
      } else if (role === 'send') {
        this.handleSend(teamName);
      } else if (role === 'release') {
        this.handleRelease(teamName);
      }
    });

    tableBody.addEventListener('input', (event) => {
      const target = event.target;
      if (!target || target.dataset.role !== 'prompt-input') return;
      const tr = target.closest('tr[data-team]');
      if (!tr) return;
      const teamName = tr.dataset.team;
      const value = target.value;
      this.promptByTeam.set(teamName, value);
    });
  }

  async handleSend(teamName) {
    const fromTeam = 'Control';
    const challenge = this.promptByTeam.get(teamName) || getRandomSpeedBumpPrompt();
    const override = this.dom.overrideToggle?.checked ?? true;
    const result = await sendSpeedBump(fromTeam, teamName, challenge, { override });
    if (!result.ok && !override) {
      const seconds = result.reason || Math.ceil(getCooldownRemaining(fromTeam, 'bump') / 1000);
      alert(`⏳ Speed Bump on cooldown. Ready in ${seconds}s.`);
    }
    this.updateRow(teamName);
  }

  async handleRelease(teamName) {
    const override = this.dom.overrideToggle?.checked ?? true;
    if (!override && !getActiveBump(teamName)) {
      alert('ℹ️ This team is not currently speed bumped.');
      return;
    }
    await releaseSpeedBump(teamName, 'Control');
    this.updateRow(teamName);
  }

  handleSave() {
    persistPrompts(this.promptByTeam);
    alert('💾 Speed Bump prompts saved to this browser.');
  }

  handleReset() {
    if (!window.confirm('Reset all Speed Bump prompts to their default suggestions?')) return;
    this.promptByTeam = new Map(DEFAULT_PROMPTS);
    persistPrompts(this.promptByTeam);
    this.renderRows();
  }

  renderRows() {
    allTeams.forEach(team => this.updateRow(team.name));
  }

  updateRow(teamName) {
    const row = this.dom.tableBody?.querySelector(`tr[data-team="${teamName}"]`);
    if (!row) return;

    const inputEl = row.querySelector('[data-role="prompt-input"]');
    const statusEl = row.querySelector('[data-role="status"]');
    const sendBtn = row.querySelector('button[data-role="send"]');
    const releaseBtn = row.querySelector('button[data-role="release"]');

    let prompt = this.promptByTeam.get(teamName);
    if (!prompt) {
      prompt = getRandomSpeedBumpPrompt();
      this.promptByTeam.set(teamName, prompt);
    }
    if (inputEl && inputEl.value !== prompt) inputEl.value = prompt;

    const active = getActiveBump(teamName);
    const cooldownMs = getCooldownRemaining('Control', 'bump');
    const onCooldown = cooldownMs > 0 && !(this.dom.overrideToggle?.checked ?? true);

    if (sendBtn) {
      sendBtn.disabled = onCooldown;
      sendBtn.title = onCooldown ? `Cooldown – ready in ${Math.ceil(cooldownMs / 1000)}s` : '';
    }

    if (releaseBtn) {
      const override = this.dom.overrideToggle?.checked ?? true;
      releaseBtn.disabled = !active && !override;
    }

    if (statusEl) {
      if (active) {
        const proofSent = Boolean(active.proofSentAt);
        const countdownMsActive = active.countdownMs ?? null;
        let detail = '📸 Awaiting proof from the sabotaged team.';
        if (proofSent) {
          if (countdownMsActive && countdownMsActive > 0) {
            detail = `📸 Proof timer: ${formatSeconds(Math.ceil(countdownMsActive / 1000))}`;
          } else {
            detail = '📸 Proof timer finished. Release when ready.';
          }
        }
        statusEl.innerHTML = `
          <span class="${styles.statusBadge} ${styles.statusActive}">🚧 Active — from ${active.by}</span><br>
          <span class="${styles.statusDetail}">${detail}</span>
        `;
      } else if (onCooldown) {
        statusEl.innerHTML = `
          <span class="${styles.statusBadge} ${styles.statusCooldown}">
            ⏳ Cooldown ${formatSeconds(Math.ceil(cooldownMs / 1000))}
          </span>
        `;
      } else {
        statusEl.innerHTML = `
          <span class="${styles.statusBadge} ${styles.statusIdle}">Ready</span>
        `;
      }
    }
  }
}

function formatSeconds(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
