// ============================================================================
// CENTRAL HUB: Flat Tire Control Controller
// ============================================================================
import { setupDomRefs, renderRows } from './controller/domHandlers.js';
import { subscribeToRacers, applyConfig } from './controller/firestoreSync.js';
import { startAutoScheduler, stopAutoScheduler } from './controller/autoScheduler.js';
import { loadFlatTireConfig, subscribeFlatTireAssignments, subscribeFlatTireConfig } from '../../modules/flatTireManager.js';

export class FlatTireControlController {
  constructor() {
    this.dom = { zoneInputs: new Map(), zoneMaps: new Map(), zoneDiameterInputs: new Map(), zoneRefreshButtons: new Map() };
    this.assignments = new Map();
    this.activeTeams = [];
    this.config = {};
    this.subscriptions = [];
    this.autoScheduler = { running: false, timerId: null };
  }

  async initialize() {
    setupDomRefs(this);
    const cfg = await loadFlatTireConfig();
    applyConfig(this, cfg);
    this.subscriptions.push(subscribeFlatTireConfig(c => applyConfig(this, c)));
    this.subscriptions.push(subscribeFlatTireAssignments(list => {
      this.assignments = new Map(list.map(i => [i.teamName, i]));
      renderRows(this);
    }));
    this.subscriptions.push(subscribeToRacers(this));
    setInterval(() => renderRows(this), 1000);
  }

  handleTeamRegistry(teams = []) {
    this.activeTeams = teams.sort((a, b) => a.localeCompare(b));
    renderRows(this, true);
  }

  toggleAuto() {
    if (this.autoScheduler.running) stopAutoScheduler(this);
    else startAutoScheduler(this);
  }

  destroy() {
    this.subscriptions.forEach(u => u?.());
   stopAutoScheduler(this);
  }
}

export function createFlatTireControlController() {
  return new FlatTireControlController();
}
