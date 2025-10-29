// ============================================================================
// HUB: SpeedBump Control Controller (modular) — DEDUP + BANK SYNC
// - Removes internal table listeners to avoid double-firing (domHandlers owns it)
// - Syncs challenge bank to global pool via setSpeedBumpPromptBank
// - No visuals altered
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

// 🔁 NEW: propagate bank changes to the shared prompt pool immediately
import { setSpeedBumpPromptBank } from '../../modules/speedBumpChallenges.js';

export class SpeedBumpControlController {
  constructor() {
    this.dom = {};
    this.promptByTeam = new Map();
    this.challengeBank = [];
    this.activeTeams = [];
    this.activeChallenges = new Map();
    this.subs = [];

    // Bind handlers expected by domHandlers.js
    this.onOverrideChange = this.onOverrideChange.bind(this);
    this.handleShuffleAll = this.handleShuffleAll.bind(this);
    this.handleSavePrompts = this.handleSavePrompts.bind(this);
    this.saveChallengeBank = this.saveChallengeBank.bind(this);
    this.appendNewChallengeRow = this.appendNewChallengeRow.bind(this);
    this.handleChallengeListInput = this.handleChallengeListInput.bind(this);
    this.handleChallengeListClick = this.handleChallengeListClick.bind(this);

    // ❌ removed internal table delegation to avoid duplicate events
    // (domHandlers.js already wires table clicks + prompt edits)
  }

  // ----------------------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------------------
  async initialize() {
    setupDomRefs(this);
    wireButtons(this);

    // load bank + local per-team prompts
    this.challengeBank = await loadBank();
    setSpeedBumpPromptBank(this.challengeBank); // <-- make bank live now

    const stored = loadPrompts();
    Object.entries(stored).forEach(([t, p]) => this.promptByTeam.set(t, p));

    // initial UI
    renderTeamRows(this);
    this.renderEditableChallengeBank();

    // external subscriptions (teams + bump state)
    const { syncTeams, syncBumps } = await import('./controller/stateSync.js');
    this.subs.push(syncTeams(this), syncBumps(this));

    this.runWiringValidation();
  }

  destroy() {
    this.subs.forEach((u) => u?.());
    this.subs = [];
  }

  // ----------------------------------------------------------------------------
  // Team prompt helpers
  // ----------------------------------------------------------------------------
  ensurePromptForTeam(team) { return ensurePrompt(this, team); }

  shuffleTeamPrompt(team) {
    shufflePrompt(this, team);
    updateRow(this, team);
  }

  renderRows() { this.activeTeams.forEach((t) => updateRow(this, t)); }
  renderTeamTable() { renderTeamRows(this); }

  onOverrideChange() { this.renderRows(); }

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
    // Persist current bank, push to shared store, reconcile prompts, refresh UI
    saveBankLocal(this.challengeBank);
    await saveBankToFirestore(this.challengeBank);
    setSpeedBumpPromptBank(this.challengeBank); // <-- live update shared pool
    reconcileWithBank(this);
    this.renderEditableChallengeBank();
    this.renderRows();
    alert('✅ Speed Bump Bank Saved');
  }

  // ----------------------------------------------------------------------------
  // Send/Release (per team)
  // ----------------------------------------------------------------------------
  async handleSend(team) {
    const existing = this.activeChallenges.get?.(team);
    if (existing && (existing.challenge || existing.prompt)) {
      console.info(`🧩 [SpeedBump] Duplicate photo challenge prevented for ${team}`);
      alert('ℹ️ This team already has an active Speed Bump challenge. Release it before sending another.');
      return;
    }

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
  // ----------------------------------------------------------------------------
  renderEditableChallengeBank() {
    const list = this.dom.bankList;
    if (!list) return;

    this.challengeBank = this.challengeBank.map(v => typeof v === 'string' ? v.trim() : '');

    if (!this.challengeBank.length) {
      list.innerHTML = `<div class="${styles.loading}">No challenges yet. Add one below.</div>`;
      return;
    }

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
    setSpeedBumpPromptBank(this.challengeBank); // keep pool in sync on add
    this.renderEditableChallengeBank();
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

    if (prev !== next) {
      setSpeedBumpPromptBank(this.challengeBank); // live update on edit
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
    setSpeedBumpPromptBank(this.challengeBank); // live update on remove
    this.renderEditableChallengeBank();

    if (removed) {
      reconcileWithBank(this, { removedPrompt: removed });
      this.renderRows();
    }
  }

  handleSpeedBumpUpdate(payload = {}) {
    const rawList = Array.isArray(payload.activeBumps)
      ? payload.activeBumps.map(([teamName, data]) => ({
          teamName,
          ...(data || {})
        }))
      : [];

    const unique = [];
    const seen = new Set();
    rawList.forEach((entry) => {
      const teamName = typeof entry.teamName === 'string' ? entry.teamName.trim() : '';
      if (!teamName || seen.has(teamName)) return;
      seen.add(teamName);
      unique.push({ ...entry, teamName });
    });

    this.activeChallenges = new Map(unique.map(item => [item.teamName, item]));
    this.renderRows();
  }

  // ----------------------------------------------------------------------------
  // Console-only wiring validator
  // ----------------------------------------------------------------------------
  runWiringValidation() {
    try {
      const ids = [
        'speedbump-table-body','speedbump-admin-override','speedbump-shuffle-all',
        'speedbump-save-prompts','speedbump-save-bank','speedbump-bank-add',
        'speedbump-bank-list','speedbump-bank-status'
      ];
      const missing = ids.filter(id => !document.getElementById(id));

      const requiredFns = [
        'handleShuffleAll','handleSavePrompts','saveChallengeBank',
        'appendNewChallengeRow','handleChallengeListInput','handleChallengeListClick',
        'onOverrideChange','ensurePromptForTeam','shuffleTeamPrompt',
        'renderTeamTable','renderRows'
      ];
      const missingFns = requiredFns.filter(k => typeof this[k] !== 'function');

      // eslint-disable-next-line no-console
      console.info('🧪 SpeedBumpControl wiring check:', {
        ok: !missing.length && !missingFns.length,
        missingDomIds: missing,
        missingControllerFns: missingFns
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('SpeedBumpControl wiring validation errored:', e);
    }
  }
}

export function createSpeedBumpControlController() {
  return new SpeedBumpControlController();
}
