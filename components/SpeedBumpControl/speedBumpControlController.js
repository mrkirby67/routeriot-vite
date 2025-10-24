// ============================================================================
// HUB: SpeedBump Control Controller (modular) — FIXED
// POLICY: DO NOT change UI styles, HTML structure, class names, or assets.
//         DO NOT refactor unrelated code. Functional restore only.
// WHAT:   Adds missing handlers expected by domHandlers.js, reinstates
//         table event delegation, and includes a safe wiring validator.
// NOTE:   Validation logs to console; it does not modify the DOM.
// ============================================================================

import styles from './SpeedBumpControl.module.css';
import {
  setupDomRefs,
  wireButtons,
  renderTeamRows,
  updateRow
} from './controller/domHandlers.js';

import {
  loadBank,
  saveBankLocal,
  saveBankToFirestore
} from './controller/promptBank.js';

import {
  loadPrompts,
  savePrompts,
  shufflePrompt,
  ensurePrompt,
  reconcileWithBank
} from './controller/teamPrompts.js';

import {
  sendSpeedBump,
  releaseSpeedBump
} from '../../modules/speedBump/index.js';

export class SpeedBumpControlController {
  constructor() {
    this.dom = {};
    this.promptByTeam = new Map();
    this.challengeBank = [];
    this.activeTeams = [];
    this.subs = [];

    // Bind handlers that domHandlers.js expects to exist
    this.onOverrideChange = this.onOverrideChange.bind(this);
    this.handleShuffleAll = this.handleShuffleAll.bind(this);
    this.handleSavePrompts = this.handleSavePrompts.bind(this);
    this.saveChallengeBank = this.saveChallengeBank.bind(this);
    this.appendNewChallengeRow = this.appendNewChallengeRow.bind(this);
    this.handleChallengeListInput = this.handleChallengeListInput.bind(this);
    this.handleChallengeListClick = this.handleChallengeListClick.bind(this);

    // Table event delegation
    this._onTableClick = this._onTableClick.bind(this);
    this._onTableInput = this._onTableInput.bind(this);
  }

  // ----------------------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------------------
  async initialize() {
    setupDomRefs(this);
    wireButtons(this);

    // load bank + local per-team prompts
    this.challengeBank = await loadBank();
    const stored = loadPrompts();
    Object.entries(stored).forEach(([t, p]) => this.promptByTeam.set(t, p));

    // initial UI
    renderTeamRows(this);
    this.renderEditableChallengeBank();

    // hook table interactions
    this.attachTableHandlers();

    // external subscriptions (teams + bump state)
    const { syncTeams, syncBumps } = await import('./controller/stateSync.js');
    this.subs.push(syncTeams(this), syncBumps(this));

    // non-intrusive wiring validation
    this.runWiringValidation();
  }

  destroy() {
    // unsubscribe
    this.subs.forEach((u) => u?.());
    this.subs = [];

    // unhook table listeners
    this.detachTableHandlers();
  }

  // ----------------------------------------------------------------------------
  // Team prompt helpers
  // ----------------------------------------------------------------------------
  ensurePromptForTeam(team) {
    return ensurePrompt(this, team);
  }

  shuffleTeamPrompt(team) {
    shufflePrompt(this, team);
    updateRow(this, team);
  }

  renderRows() {
    this.activeTeams.forEach((t) => updateRow(this, t));
  }

  renderTeamTable() {
    renderTeamRows(this);
  }

  onOverrideChange() {
    // just recompute enabled/disabled state + labels
    this.renderRows();
  }

  // ----------------------------------------------------------------------------
  // Top controls
  // ----------------------------------------------------------------------------
  handleShuffleAll() {
    if (!this.activeTeams.length || !this.challengeBank.length) return;
    this.activeTeams.forEach((team) => this.shuffleTeamPrompt(team));
    this.renderRows();
  }

  handleSavePrompts() {
    savePrompts(this.promptByTeam, this.activeTeams);
    alert('💾 Team overrides saved locally.');
  }

  async saveChallengeBank() {
    // Persist current bank (local + Firestore), reconcile with prompts, refresh UI
    saveBankLocal(this.challengeBank);
    await saveBankToFirestore(this.challengeBank);
    reconcileWithBank(this);
    this.renderEditableChallengeBank();
    this.renderRows();
    alert('✅ Speed Bump Bank Saved');
  }

  // ----------------------------------------------------------------------------
  // Send/Release (per team)
  // ----------------------------------------------------------------------------
  async handleSend(team) {
    const challenge = (this.promptByTeam.get(team) || '').trim();
    if (!challenge) return alert('⚠️ No prompt for this team.');
    await sendSpeedBump('Control', team, challenge, { override: true });
    updateRow(this, team);
  }

  async handleRelease(team) {
    await releaseSpeedBump(team, 'Control');
    updateRow(this, team);
  }

  // ----------------------------------------------------------------------------
  // Challenge Bank: render + interactions
  // Expected by domHandlers.js: appendNewChallengeRow, handleChallengeListInput, handleChallengeListClick
  // ----------------------------------------------------------------------------
  renderEditableChallengeBank() {
    const list = this.dom.bankList;
    if (!list) return;

    // normalize
    this.challengeBank = this.challengeBank.map((v) =>
      typeof v === 'string' ? v.trim() : ''
    );

    // empty state
    if (!this.challengeBank.length) {
      list.innerHTML = `<div class="${styles.loading}">No challenges yet. Add one below.</div>`;
      return;
    }

    // build rows
    const frag = document.createDocumentFragment();
    this.challengeBank.forEach((challenge, index) => {
      const row = document.createElement('div');
      row.className = styles.challengeRow;
      row.dataset.index = String(index);

      const idx = document.createElement('span');
      idx.className = styles.challengeIndex;
      idx.textContent = `${index + 1}.`;

      const text = document.createElement('div');
      text.className = styles.challengeText;
      text.setAttribute('data-role', 'challenge-text');
      text.setAttribute('data-index', String(index));
      text.setAttribute('data-placeholder', 'Enter a photo challenge…');
      text.setAttribute('spellcheck', 'false');
      text.contentEditable = 'true';
      text.textContent = challenge;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = styles.removeChallengeBtn;
      del.setAttribute('data-role', 'remove-challenge');
      del.setAttribute('data-index', String(index));
      del.setAttribute('aria-label', `Remove challenge ${index + 1}`);
      del.textContent = '❌';

      row.append(idx, text, del);
      frag.appendChild(row);
    });

    list.innerHTML = '';
    list.appendChild(frag);
  }

  appendNewChallengeRow() {
    this.challengeBank.push('');
    this.renderEditableChallengeBank();
    // focus the new row
    const last = this.dom.bankList?.querySelector(
      `[data-role="challenge-text"][data-index="${this.challengeBank.length - 1}"]`
    );
    last?.focus();
  }

  handleChallengeListInput(event) {
    const el = event.target?.closest('[data-role="challenge-text"]');
    if (!el) return;
    const idx = Number(el.dataset.index);
    if (Number.isNaN(idx)) return;

    const prev = this.challengeBank[idx] ?? '';
    const next = (el.textContent || '').trim();
    this.challengeBank[idx] = next;

    // If the value changed, reconcile teams that used the old text
    if (prev !== next) {
      reconcileWithBank(this);
      this.renderRows();
    }
  }

  handleChallengeListClick(event) {
    const btn = event.target?.closest('[data-role="remove-challenge"]');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    if (Number.isNaN(idx)) return;

    const removed = this.challengeBank[idx] || '';
    this.challengeBank.splice(idx, 1);
    this.renderEditableChallengeBank();

    // If we deleted the exact text a team is using, reassign those prompts
    if (removed) {
      reconcileWithBank(this, { removedPrompt: removed });
      this.renderRows();
    }
  }

  // ----------------------------------------------------------------------------
  // Table delegation (per-row buttons + prompt input)
  // ----------------------------------------------------------------------------
  attachTableHandlers() {
    const body = this.dom.tableBody;
    if (!body) return;
    body.addEventListener('click', this._onTableClick);
    body.addEventListener('input', this._onTableInput);
  }

  detachTableHandlers() {
    const body = this.dom.tableBody;
    if (!body) return;
    body.removeEventListener('click', this._onTableClick);
    body.removeEventListener('input', this._onTableInput);
  }

  _onTableClick(event) {
    const btn = event.target?.closest('button[data-role]');
    if (!btn) return;
    const tr = btn.closest('tr[data-team]');
    if (!tr) return;
    const team = tr.dataset.team;
    const role = btn.dataset.role;

    if (role === 'shuffle') {
      this.shuffleTeamPrompt(team);
    } else if (role === 'send') {
      this.handleSend(team);
    } else if (role === 'release') {
      this.handleRelease(team);
    }
  }

  _onTableInput(event) {
    const input = event.target;
    if (!input || input.dataset.role !== 'prompt-input') return;
    const tr = input.closest('tr[data-team]');
    if (!tr) return;
    const team = tr.dataset.team;
    this.promptByTeam.set(team, input.value || '');
  }

  // ----------------------------------------------------------------------------
  // Safe, non-intrusive wiring validator (console-only)
  // ----------------------------------------------------------------------------
  runWiringValidation() {
    try {
      const mustExistIds = [
        'speedbump-table-body',
        'speedbump-admin-override',
        'speedbump-shuffle-all',
        'speedbump-save-prompts',
        'speedbump-save-bank',
        'speedbump-bank-add',
        'speedbump-bank-list',
        'speedbump-bank-status'
      ];
      const missing = mustExistIds.filter(id => !document.getElementById(id));
      const missingHandlers = [];
      const requiredFns = [
        'handleShuffleAll',
        'handleSavePrompts',
        'saveChallengeBank',
        'appendNewChallengeRow',
        'handleChallengeListInput',
        'handleChallengeListClick',
        'onOverrideChange',
        'ensurePromptForTeam',
        'shuffleTeamPrompt',
        'renderTeamTable',
        'renderRows'
      ];
      requiredFns.forEach(fn => { if (typeof this[fn] !== 'function') missingHandlers.push(fn); });
      const summary = {
        ok: !missing.length && !missingHandlers.length,
        missingDomIds: missing,
        missingControllerFns: missingHandlers
      };
      // eslint-disable-next-line no-console
      console.info('🧪 SpeedBumpControl wiring check:', summary);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('SpeedBumpControl wiring validation errored:', e);
    }
  }
}

// Factory export retained
export function createSpeedBumpControlController() {
  return new SpeedBumpControlController();
}
