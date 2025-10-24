// ============================================================================
// HUB: SpeedBump Control Controller (modular)
// ============================================================================
import styles from './SpeedBumpControl.module.css';
import { setupDomRefs, wireButtons, renderTeamRows, updateRow } from './controller/domHandlers.js';
import { loadBank, saveBankLocal, saveBankToFirestore } from './controller/promptBank.js';
import { loadPrompts, savePrompts, shufflePrompt, ensurePrompt, reconcileWithBank } from './controller/teamPrompts.js';
import { syncTeams, syncBumps } from './controller/stateSync.js';
import { sendSpeedBump, releaseSpeedBump } from '../../modules/speedBump/index.js';

export class SpeedBumpControlController {
  constructor() {
    this.dom = {};
    this.promptByTeam = new Map();
    this.challengeBank = [];
    this.activeTeams = [];
    this.subs = [];
  }

  async initialize() {
    setupDomRefs(this);
    wireButtons(this);
    this.challengeBank = await loadBank();
    const stored = loadPrompts();
    Object.entries(stored).forEach(([t,p]) => this.promptByTeam.set(t,p));
    renderTeamRows(this);
    this.subs.push(syncTeams(this), syncBumps(this));
  }

  destroy() { this.subs.forEach(u=>u?.()); }

  ensurePromptForTeam(team) { return ensurePrompt(this, team); }
  shuffleTeamPrompt(team) { shufflePrompt(this, team); updateRow(this, team); }
  renderRows() { this.activeTeams.forEach(t=>updateRow(this,t)); }
  renderTeamTable() { renderTeamRows(this); }

  handleSavePrompts() { savePrompts(this.promptByTeam,this.activeTeams); alert('💾 Saved locally'); }

  async saveChallengeBank() {
    saveBankLocal(this.challengeBank);
    await saveBankToFirestore(this.challengeBank);
    reconcileWithBank(this);
    alert('✅ Bank Saved');
  }

  async handleSend(team) {
    const challenge = this.promptByTeam.get(team) || '';
    if (!challenge) return alert('No prompt!');
    await sendSpeedBump('Control', team, challenge, { override:true });
    updateRow(this, team);
  }

  async handleRelease(team) {
    await releaseSpeedBump(team, 'Control');
    updateRow(this, team);
  }
}

export function createSpeedBumpControlController() {
  return new SpeedBumpControlController();
}
