// ============================================================================
// FILE: components/SpeedBumpControl/speedBumpControlController.js
// PURPOSE: UI orchestration for Speed Bump – Photo Challenge control panel
// ============================================================================

import styles from './SpeedBumpControl.module.css';
import { allTeams } from '../../data.js';
import {
  getRandomSpeedBumpPrompt,
  getDefaultPrompts,
  setSpeedBumpPromptBank,
  getSpeedBumpPromptBank
} from '../../modules/speedBumpChallenges.js';
import {
  sendSpeedBump,
  releaseSpeedBump,
  subscribeSpeedBumps,
  getCooldownRemaining,
  getActiveBump
} from '../../modules/speedBump/index.js';
import { db } from '../../modules/config.js';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { escapeHtml } from '../../modules/utils.js';

const PROMPTS_STORAGE_KEY = 'speedBumpPrompts';
const BANK_STORAGE_KEY = 'speedBumpBank';
const PLACEHOLDER_TEXT = 'Enter a photo challenge…';

function loadPersistedPrompts() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROMPTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('⚠️ Failed to load stored Speed Bump prompts:', err);
    return {};
  }
}

function persistPrompts(map, teamNames = []) {
  if (typeof window === 'undefined') return;
  try {
    const allowList = teamNames.length ? new Set(teamNames) : null;
    const obj = {};
    map.forEach((value, key) => {
      if (allowList && !allowList.has(key)) return;
      obj[key] = value;
    });
    window.localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    console.warn('⚠️ Failed to persist Speed Bump prompts:', err);
  }
}

function loadPersistedBankLocal() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BANK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('⚠️ Failed to load stored Speed Bump bank:', err);
    return [];
  }
}

function persistBankLocal(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('⚠️ Failed to persist Speed Bump bank locally:', err);
  }
}

function focusEditable(element) {
  element?.focus();
  if (!element) return;
  const selection = window.getSelection?.();
  if (!selection) return;
  selection.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.addRange(range);
}

function escapeSelector(value) {
  if (typeof CSS?.escape === 'function') return CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

export function createSpeedBumpControlController() {
  return new SpeedBumpControlController();
}

class SpeedBumpControlController {
  constructor() {
    this.dom = {
      tableBody: null,
      overrideToggle: null,
      shuffleAllBtn: null,
      savePromptsBtn: null,
      bankSaveBtn: null,
      bankAddBtn: null,
      bankList: null,
      bankStatus: null
    };

    this.promptByTeam = new Map();
    this.challengeBank = getDefaultPrompts();
    setSpeedBumpPromptBank(this.challengeBank);

    this.activeTeams = [];
    this.unsubscribe = null;
    this.registryCleanup = null;
    this.pendingFocusIndex = null;
    this.statusTimer = null;

    this.handleStatePush = this.handleStatePush.bind(this);
    this.onOverrideChange = this.renderRows.bind(this);
    this.handleSavePrompts = this.handleSavePrompts.bind(this);
    this.handleShuffleAll = this.handleShuffleAll.bind(this);
    this.saveChallengeBank = this.saveChallengeBank.bind(this);
    this.appendNewChallengeRow = this.appendNewChallengeRow.bind(this);
    this.handleChallengeListInput = this.handleChallengeListInput.bind(this);
    this.handleChallengeListClick = this.handleChallengeListClick.bind(this);
  }

  async initialize() {
    const tableBody = document.getElementById('speedbump-table-body');
    const overrideToggle = document.getElementById('speedbump-admin-override');
    const shuffleAllBtn = document.getElementById('speedbump-shuffle-all');
    const savePromptsBtn = document.getElementById('speedbump-save-prompts');
    const bankSaveBtn = document.getElementById('speedbump-save-bank');
    const bankAddBtn = document.getElementById('speedbump-bank-add');
    const bankList = document.getElementById('speedbump-bank-list');
    const bankStatus = document.getElementById('speedbump-bank-status');

    if (!tableBody || !overrideToggle || !shuffleAllBtn || !savePromptsBtn || !bankSaveBtn || !bankAddBtn || !bankList || !bankStatus) {
      console.warn('⚠️ Speed Bump control DOM not ready.');
      return () => {};
    }

    this.dom = {
      tableBody,
      overrideToggle,
      shuffleAllBtn,
      savePromptsBtn,
      bankSaveBtn,
      bankAddBtn,
      bankList,
      bankStatus
    };

    overrideToggle.addEventListener('change', this.onOverrideChange);
    shuffleAllBtn.addEventListener('click', this.handleShuffleAll);
    savePromptsBtn.addEventListener('click', this.handleSavePrompts);
    bankSaveBtn.addEventListener('click', this.saveChallengeBank);
    bankAddBtn.addEventListener('click', this.appendNewChallengeRow);
    bankList.addEventListener('input', this.handleChallengeListInput);
    bankList.addEventListener('click', this.handleChallengeListClick);

    this.attachTableHandlers();

    await this.loadChallengeBank();
    this.loadSavedPrompts();
    this.renderEditableChallengeBank();

    this.registryCleanup = this.syncTeamsWithRegistry();
    this.unsubscribe = subscribeSpeedBumps(this.handleStatePush);
    this.renderRows();

    return reason => this.destroy(reason);
  }

  destroy(reason = 'manual') {
    this.unsubscribe?.();
    this.unsubscribe = null;

    this.registryCleanup?.();
    this.registryCleanup = null;

    const {
      overrideToggle,
      shuffleAllBtn,
      savePromptsBtn,
      bankSaveBtn,
      bankAddBtn,
      bankList
    } = this.dom;

    overrideToggle?.removeEventListener('change', this.onOverrideChange);
    shuffleAllBtn?.removeEventListener('click', this.handleShuffleAll);
    savePromptsBtn?.removeEventListener('click', this.handleSavePrompts);
    bankSaveBtn?.removeEventListener('click', this.saveChallengeBank);
    bankAddBtn?.removeEventListener('click', this.appendNewChallengeRow);
    bankList?.removeEventListener('input', this.handleChallengeListInput);
    bankList?.removeEventListener('click', this.handleChallengeListClick);

    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = null;

    this.dom = {
      tableBody: null,
      overrideToggle: null,
      shuffleAllBtn: null,
      savePromptsBtn: null,
      bankSaveBtn: null,
      bankAddBtn: null,
      bankList: null,
      bankStatus: null
    };

    console.info(`🧹 [speedBumpControl] destroyed (${reason})`);
  }

  async loadChallengeBank() {
    let bank = [];
    try {
      const snap = await getDoc(doc(db, 'game', 'speedBumpBank'));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.list)) bank = data.list;
      }
    } catch (err) {
      console.warn('⚠️ Failed to load Speed Bump bank from Firestore:', err);
    }

    if (!bank.length) {
      bank = loadPersistedBankLocal();
    }

    if (!bank.length) {
      bank = getDefaultPrompts();
    }

    this.challengeBank = bank
      .map(value => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);

    if (!this.challengeBank.length) {
      this.challengeBank = getDefaultPrompts();
    }

    setSpeedBumpPromptBank(this.challengeBank);
  }

  loadSavedPrompts() {
    const stored = loadPersistedPrompts();
    Object.entries(stored).forEach(([team, prompt]) => {
      if (typeof prompt === 'string' && prompt.trim()) {
        this.promptByTeam.set(team, prompt);
      }
    });
  }

  attachTableHandlers() {
    const { tableBody } = this.dom;
    if (!tableBody) return;

    tableBody.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('button[data-role]');
      if (!actionBtn) return;
      const tr = event.target.closest('tr[data-team]');
      if (!tr) return;
      const teamName = tr.dataset.team;
      const role = actionBtn.dataset.role;
      if (role === 'shuffle') {
        this.shuffleTeamPrompt(teamName);
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

  handleChallengeListInput(event) {
    const editable = event.target.closest('[data-role="challenge-text"]');
    if (!editable) return;
    const index = Number(editable.dataset.index);
    if (Number.isNaN(index)) return;

    const previous = this.challengeBank[index] ?? '';
    const next = editable.textContent.trim();
    this.challengeBank[index] = next;
    setSpeedBumpPromptBank(this.challengeBank);

    if (previous !== next) {
      this.updateTeamsUsingPrompt(previous, next);
      this.renderRows();
    }
  }

  handleChallengeListClick(event) {
    const removeBtn = event.target.closest('[data-role="remove-challenge"]');
    if (!removeBtn) return;
    const index = Number(removeBtn.dataset.index);
    if (Number.isNaN(index)) return;

    const removedPrompt = this.challengeBank[index];
    this.challengeBank.splice(index, 1);
    setSpeedBumpPromptBank(this.challengeBank);
    this.pendingFocusIndex = null;
    this.renderEditableChallengeBank();
    this.ensurePromptsAgainstBank(true);
    this.renderRows();

    if (removedPrompt) {
      this.updateTeamsUsingPrompt(removedPrompt, '');
    }
  }

  syncTeamsWithRegistry() {
    if (typeof window === 'undefined') {
      this.setActiveTeams(allTeams.map(team => team.name));
      return () => {};
    }

    try {
      const racersRef = collection(db, 'racers');
      return onSnapshot(racersRef, snapshot => {
        const teams = new Set();
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const teamName = typeof data?.team === 'string' ? data.team.trim() : '';
          if (teamName && teamName !== '-') teams.add(teamName);
        });
        this.setActiveTeams(Array.from(teams));
      }, err => {
        console.warn('⚠️ Failed to sync racer registry:', err);
        this.setActiveTeams([]);
      });
    } catch (err) {
      console.warn('⚠️ Unable to subscribe to team registry:', err);
      this.setActiveTeams([]);
      return () => {};
    }
  }

  setActiveTeams(teamNames = []) {
    const normalized = Array.from(new Set(
      teamNames
        .map(name => (typeof name === 'string' ? name.trim() : ''))
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    this.activeTeams = normalized;
    this.renderTeamTable();
    this.ensurePromptsAgainstBank();
    this.renderRows();
  }

  renderTeamTable() {
    const { tableBody } = this.dom;
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!this.activeTeams.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="${styles.loading}">Waiting for registered teams…</td>
        </tr>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    this.activeTeams.forEach(teamName => {
      const teamMeta = allTeams.find(team => team.name === teamName) || {};
      const prompt = this.ensurePromptForTeam(teamName);

      const row = document.createElement('tr');
      row.dataset.team = teamName;
      row.innerHTML = `
        <td class="${styles.teamCell}">
          <strong>${escapeHtml(teamName)}</strong>
          <span>${escapeHtml(teamMeta.slogan || '')}</span>
        </td>
        <td class="${styles.promptCell}">
          <input type="text"
                 class="${styles.promptInput}"
                 data-role="prompt-input"
                 value="${escapeHtml(prompt)}"
                 autocomplete="off"
                 spellcheck="false" />
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

      fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
  }

  ensurePromptForTeam(teamName) {
    const existing = this.promptByTeam.get(teamName);
    if (typeof existing === 'string' && existing.trim()) return existing;

    let prompt = getRandomSpeedBumpPrompt();
    if (!prompt) {
      const bank = getSpeedBumpPromptBank();
      prompt = bank[0] || '';
    }

    if (prompt) {
      this.promptByTeam.set(teamName, prompt);
    }
    return prompt || '';
  }

  shuffleTeamPrompt(teamName) {
    if (!teamName) return;
    const next = getRandomSpeedBumpPrompt([this.promptByTeam.get(teamName)]);
    if (next) {
      this.promptByTeam.set(teamName, next);
      this.updateRow(teamName);
    }
  }

  handleShuffleAll() {
    if (!this.challengeBank.length) return;
    this.activeTeams.forEach(team => {
      const next = getRandomSpeedBumpPrompt([this.promptByTeam.get(team)]);
      this.promptByTeam.set(team, next || this.challengeBank[0] || '');
    });
    this.renderRows();
  }

  async handleSend(teamName) {
    const fromTeam = 'Control';
    const challenge = (this.promptByTeam.get(teamName) || getRandomSpeedBumpPrompt() || '').trim();
    if (!challenge) {
      alert('⚠️ Add at least one challenge to the Speed Bump bank first.');
      return;
    }

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

  handleSavePrompts() {
    persistPrompts(this.promptByTeam, this.activeTeams);
    alert('💾 Team prompt overrides saved locally.');
  }

  async saveChallengeBank() {
    const entries = this.collectBankFromDom();
    if (!entries.length) {
      this.showBankStatus('⚠️ Add at least one challenge before saving.', false);
      return;
    }

    this.challengeBank = entries;
    setSpeedBumpPromptBank(entries);
    persistBankLocal(entries);
    this.ensurePromptsAgainstBank();
    this.renderRows();

    try {
      await setDoc(doc(db, 'game', 'speedBumpBank'), {
        list: entries,
        updatedAt: serverTimestamp()
      }, { merge: true });
      this.showBankStatus('✅ Speed Bump Bank Saved');
    } catch (err) {
      console.warn('⚠️ Failed to persist Speed Bump bank to Firestore:', err);
      this.showBankStatus('⚠️ Saved locally. Firestore sync failed.', false);
    }

    this.renderEditableChallengeBank();
  }

  appendNewChallengeRow() {
    this.challengeBank.push('');
    setSpeedBumpPromptBank(this.challengeBank);
    this.pendingFocusIndex = this.challengeBank.length - 1;
    this.renderEditableChallengeBank();
  }

  renderEditableChallengeBank() {
    const { bankList } = this.dom;
    if (!bankList) return;

    this.challengeBank = this.challengeBank
      .map(value => (typeof value === 'string' ? value.trim() : ''));

    bankList.innerHTML = '';

    if (!this.challengeBank.length) {
      bankList.innerHTML = `<div class="${styles.loading}">No challenges yet. Add one below.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    this.challengeBank.forEach((challenge, index) => {
      const row = document.createElement('div');
      row.className = styles.challengeRow;
      row.dataset.index = String(index);

      const indexSpan = document.createElement('span');
      indexSpan.className = styles.challengeIndex;
      indexSpan.textContent = `${index + 1}.`;

      const textDiv = document.createElement('div');
      textDiv.className = styles.challengeText;
      textDiv.setAttribute('data-role', 'challenge-text');
      textDiv.setAttribute('data-index', String(index));
      textDiv.setAttribute('data-placeholder', PLACEHOLDER_TEXT);
      textDiv.setAttribute('spellcheck', 'false');
      textDiv.contentEditable = 'true';
      textDiv.textContent = challenge;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = styles.removeChallengeBtn;
      removeBtn.setAttribute('data-role', 'remove-challenge');
      removeBtn.setAttribute('data-index', String(index));
      removeBtn.setAttribute('aria-label', `Remove challenge ${index + 1}`);
      removeBtn.textContent = '❌';

      row.append(indexSpan, textDiv, removeBtn);
      fragment.appendChild(row);
    });

    bankList.appendChild(fragment);

    if (this.pendingFocusIndex !== null) {
      const target = bankList.querySelector(`[data-role="challenge-text"][data-index="${this.pendingFocusIndex}"]`);
      if (target) focusEditable(target);
      this.pendingFocusIndex = null;
    }
  }

  collectBankFromDom() {
    const { bankList } = this.dom;
    if (!bankList) return [];
    return Array.from(bankList.querySelectorAll('[data-role="challenge-text"]'))
      .map(node => node.textContent.trim())
      .filter(Boolean);
  }

  showBankStatus(message, success = true) {
    const { bankStatus } = this.dom;
    if (!bankStatus) return;

    bankStatus.textContent = message;
    bankStatus.classList.toggle('error', !success);

    if (this.statusTimer) clearTimeout(this.statusTimer);
    if (!message) return;

    this.statusTimer = setTimeout(() => {
      bankStatus.textContent = '';
      bankStatus.classList.remove('error');
    }, success ? 2500 : 3500);
  }

  updateTeamsUsingPrompt(oldPrompt, newPrompt) {
    const trimmedOld = (oldPrompt || '').trim();
    const trimmedNew = (newPrompt || '').trim();
    if (!trimmedOld && !trimmedNew) return;

    this.activeTeams.forEach(team => {
      const current = (this.promptByTeam.get(team) || '').trim();
      if (current === trimmedOld) {
        if (trimmedNew) {
          this.promptByTeam.set(team, trimmedNew);
        } else {
          this.promptByTeam.delete(team);
          this.ensurePromptForTeam(team);
        }
        this.updateRow(team);
      }
    });
  }

  ensurePromptsAgainstBank(forceReassign = false) {
    const bank = this.challengeBank;
    const bankSet = new Set(bank);

    this.activeTeams.forEach(team => {
      const current = (this.promptByTeam.get(team) || '').trim();
      const needsUpdate = forceReassign || !current || (bankSet.size && current && !bankSet.has(current));
      if (!needsUpdate) return;

      let replacement = getRandomSpeedBumpPrompt([current]);
      if (!replacement && bank.length) replacement = bank[0];
      this.promptByTeam.set(team, replacement || '');
    });
  }

  handleStatePush() {
    this.renderRows();
  }

  renderRows() {
    this.activeTeams.forEach(team => this.updateRow(team));
  }

  updateRow(teamName) {
    const row = this.dom.tableBody?.querySelector(`tr[data-team="${escapeSelector(teamName)}"]`);
    if (!row) return;

    const prompt = this.ensurePromptForTeam(teamName);
    const inputEl = row.querySelector('[data-role="prompt-input"]');
    const statusEl = row.querySelector('[data-role="status"]');
    const sendBtn = row.querySelector('button[data-role="send"]');
    const releaseBtn = row.querySelector('button[data-role="release"]');

    if (inputEl && inputEl.value !== prompt) inputEl.value = prompt;

    const active = getActiveBump(teamName);
    const cooldownMs = getCooldownRemaining('Control', 'bump');
    const overrideEnabled = this.dom.overrideToggle?.checked ?? true;
    const onCooldown = cooldownMs > 0 && !overrideEnabled;

    if (sendBtn) {
      sendBtn.disabled = onCooldown || !prompt.trim();
      sendBtn.title = onCooldown ? `Cooldown – ready in ${Math.ceil(cooldownMs / 1000)}s` : '';
    }

    if (releaseBtn) {
      releaseBtn.disabled = !active && !overrideEnabled;
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
          <span class="${styles.statusBadge} ${styles.statusActive}">🚧 Active — from ${escapeHtml(active.by)}</span><br>
          <span class="${styles.statusDetail}">${escapeHtml(detail)}</span>
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
