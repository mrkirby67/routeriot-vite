// ============================================================================
// FILE: components/SpeedBumpControl/controller/domHandlers.js
// PURPOSE: Component module components/SpeedBumpControl/controller/domHandlers.js
// DEPENDS_ON: modules/utils.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================

import styles from '../SpeedBumpControl.module.css';
import { escapeHtml } from '../../../modules/utils.js';
import {
  getActiveBump,
  getCooldownRemaining,
  releaseSpeedBump
} from '../../../modules/speedBump/index.js';

export function setupDomRefs(ctrl) {
  const map = {
    tableBody: 'speedbump-table-body',
    overrideToggle: 'speedbump-admin-override',
    shuffleAllBtn: 'speedbump-shuffle-all',
    savePromptsBtn: 'speedbump-save-prompts',
    bankSaveBtn: 'speedbump-save-bank',
    bankAddBtn: 'speedbump-bank-add',
    bankList: 'speedbump-bank-list',
    bankStatus: 'speedbump-bank-status'
  };
  Object.entries(map).forEach(([k, id]) => {
    ctrl.dom[k] = document.getElementById(id) || null;
  });
}

export function wireButtons(ctrl) {
  const { overrideToggle, shuffleAllBtn, savePromptsBtn, bankSaveBtn, bankAddBtn, bankList } = ctrl.dom;

  overrideToggle?.addEventListener('change', () => ctrl.renderRows());
  shuffleAllBtn?.addEventListener('click', () => ctrl.handleShuffleAll());
  savePromptsBtn?.addEventListener('click', () => ctrl.handleSavePrompts());
  bankSaveBtn?.addEventListener('click', () => ctrl.saveChallengeBank());
  bankAddBtn?.addEventListener('click', () => ctrl.appendNewChallengeRow());
  bankList?.addEventListener('input', (e) => ctrl.handleChallengeListInput(e));
  bankList?.addEventListener('click', (e) => ctrl.handleChallengeListClick(e));

  ctrl.dom.tableBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-role]');
    if (!btn) return;

    const row = btn.closest('tr[data-team]');
    if (!row) return;
    const team = row.dataset.team;

    switch (btn.dataset.role) {
      case 'shuffle': ctrl.shuffleTeamPrompt(team); break;
      case 'send': ctrl.handleSend(team); break;
      case 'release': ctrl.handleRelease(team); break;
    }
  });

  ctrl.dom.tableBody?.addEventListener('input', (e) => {
    const input = e.target.closest('input[data-role="prompt-input"]');
    if (!input) return;
    const row = input.closest('tr[data-team]');
    ctrl.promptByTeam.set(row.dataset.team, input.value);
  });
}

export function renderTeamRows(ctrl) {
  const body = ctrl.dom.tableBody;
  if (!body) return;

  body.innerHTML = '';

  if (!ctrl.activeTeams.length) {
    body.innerHTML = `<tr><td colspan="4" class="${styles.loading}">Waiting for teams…</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  ctrl.activeTeams.forEach(team => {
    const prompt = ctrl.ensurePromptForTeam(team);
    const row = document.createElement('tr');
    row.dataset.team = team;

    row.innerHTML = `
      <td class="${styles.teamCell}"><strong>${escapeHtml(team)}</strong></td>
      
      <td>
        <input type="text"
              class="${styles.promptInput}"
              data-role="prompt-input"
              spellcheck="false"
              value="${escapeHtml(prompt)}" />
      </td>

      <td>
        <button data-role="shuffle" class="${styles.actionBtn}">🔁<br><small>Shuffle</small></button>
        <button data-role="send" class="${styles.actionBtn}">🚧<br><small>Send</small></button>
        <button data-role="release" class="${styles.actionBtn} ${styles.releaseBtn}">✅<br><small>Release</small></button>
      </td>

      <td data-role="status">—</td>
    `;

    fragment.appendChild(row);
  });

  body.appendChild(fragment);
  ctrl.renderRows();
}

export function updateRow(ctrl, team) {
  const row = ctrl.dom.tableBody?.querySelector(`tr[data-team="${CSS.escape(team)}"]`);
  if (!row) return;

  const statusEl = row.querySelector('[data-role="status"]');
  const sendBtn = row.querySelector('button[data-role="send"]');
  const releaseBtn = row.querySelector('button[data-role="release"]');

  const prompt = ctrl.promptByTeam.get(team) || '';
  const bump = getActiveBump(team);
  const cooldownMs = getCooldownRemaining('Control', 'bump');
  const override = ctrl.dom.overrideToggle?.checked ?? true;
  const locked = cooldownMs > 0 && !override;

  sendBtn.disabled = locked || !prompt.trim();
  releaseBtn.disabled = !bump && !override;

  if (!statusEl) return;

  if (bump) {
    const text = bump.proofSentAt ? '📸 Proof received' : 'Awaiting proof…';
    statusEl.innerHTML = `
      <span class="${styles.statusBadge} ${styles.statusActive}">
        🚧 Active by ${escapeHtml(bump.by)}
      </span><br><span>${text}</span>`;
  } else if (locked) {
    statusEl.innerHTML = `
      <span class="${styles.statusBadge} ${styles.statusCooldown}">
        ⏳ ${Math.ceil(cooldownMs / 1000)}s
      </span>`;
  } else {
    statusEl.innerHTML = `
      <span class="${styles.statusBadge} ${styles.statusIdle}">
        Ready
      </span>`;
  }
}

// === AI-CONTEXT-MAP ===
// aicp_category: component
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// ai_role: UI Layer
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: setupDomRefs, wireButtons, renderTeamRows, updateRow
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END ===
