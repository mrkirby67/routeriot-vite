// ============================================================================
// DOM HANDLERS – sets up table, event wiring, and render updates
// ============================================================================
import styles from '../SpeedBumpControl.module.css';
import { escapeHtml } from '../../../modules/utils.js';
import { getActiveBump, getCooldownRemaining } from '../../../modules/speedBump/index.js';

export function setupDomRefs(controller) {
  const ids = ['speedbump-table-body','speedbump-admin-override','speedbump-shuffle-all','speedbump-save-prompts','speedbump-save-bank','speedbump-bank-add','speedbump-bank-list','speedbump-bank-status'];
  const keys = ['tableBody','overrideToggle','shuffleAllBtn','savePromptsBtn','bankSaveBtn','bankAddBtn','bankList','bankStatus'];
  keys.forEach((k, i) => (controller.dom[keys[i]] = document.getElementById(ids[i]) || null));
}

export function wireButtons(controller) {
  const { overrideToggle, shuffleAllBtn, savePromptsBtn, bankSaveBtn, bankAddBtn, bankList } = controller.dom;
  overrideToggle?.addEventListener('change', controller.onOverrideChange);
  shuffleAllBtn?.addEventListener('click', controller.handleShuffleAll);
  savePromptsBtn?.addEventListener('click', controller.handleSavePrompts);
  bankSaveBtn?.addEventListener('click', controller.saveChallengeBank);
  bankAddBtn?.addEventListener('click', controller.appendNewChallengeRow);
  bankList?.addEventListener('input', controller.handleChallengeListInput);
  bankList?.addEventListener('click', controller.handleChallengeListClick);
}

export function renderTeamRows(controller) {
  const { activeTeams, dom } = controller;
  const body = dom.tableBody;
  if (!body) return;
  body.innerHTML = '';

  if (!activeTeams.length) {
    body.innerHTML = `<tr><td colspan="4" class="${styles.loading}">Waiting for teams…</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  activeTeams.forEach(teamName => {
    const prompt = controller.ensurePromptForTeam(teamName);
    const row = document.createElement('tr');
    row.dataset.team = teamName;
    row.innerHTML = `
      <td class="${styles.teamCell}"><strong>${escapeHtml(teamName)}</strong></td>
      <td><input type="text" class="${styles.promptInput}" data-role="prompt-input" value="${escapeHtml(prompt)}" /></td>
      <td>
        <button data-role="shuffle" class="${styles.actionBtn}">🔁</button>
        <button data-role="send" class="${styles.actionBtn}">🚧</button>
        <button data-role="release" class="${styles.actionBtn} ${styles.releaseBtn}">✅</button>
      </td>
      <td data-role="status">—</td>`;
    fragment.appendChild(row);
  });
  body.appendChild(fragment);
}

export function updateRow(controller, teamName) {
  const row = controller.dom.tableBody?.querySelector(`tr[data-team="${CSS.escape(teamName)}"]`);
  if (!row) return;
  const statusEl = row.querySelector('[data-role="status"]');
  const sendBtn = row.querySelector('button[data-role="send"]');
  const releaseBtn = row.querySelector('button[data-role="release"]');
  const prompt = controller.promptByTeam.get(teamName) || '';
  const active = getActiveBump(teamName);
  const cooldown = getCooldownRemaining('Control', 'bump');
  const override = controller.dom.overrideToggle?.checked ?? true;
  const disabled = cooldown > 0 && !override;

  sendBtn.disabled = disabled || !prompt.trim();
  releaseBtn.disabled = !active && !override;

  if (!statusEl) return;
  if (active) {
    const proof = active.proofSentAt ? '📸 Proof received' : 'Awaiting proof…';
    statusEl.innerHTML = `<span class="${styles.statusBadge} ${styles.statusActive}">🚧 Active by ${escapeHtml(active.by)}</span><br><span>${proof}</span>`;
  } else if (disabled) {
    statusEl.innerHTML = `<span class="${styles.statusBadge} ${styles.statusCooldown}">⏳ ${Math.ceil(cooldown / 1000)}s</span>`;
  } else {
    statusEl.innerHTML = `<span class="${styles.statusBadge} ${styles.statusIdle}">Ready</span>`;
  }
}