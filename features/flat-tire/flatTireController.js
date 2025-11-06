// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/flat-tire/flatTireController.js
// PURPOSE: Orchestrates the Flat Tire feature, importing from smaller modules.
// DEPENDS_ON: services/flat-tire/flatTireService.js, ui/flat-tire/flatTireUI.js, features/flat-tire/flatTireEvents.js, components/FlatTireControl/controller/firestoreSync.js, components/FlatTireControl/controller/autoScheduler.js, ../../modules/googleMapsLoader.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

import * as service from '../../services/flat-tire/flatTireService.js';
import * as ui from '../../ui/flat-tire/flatTireUI.js';
import * as events from './flatTireEvents.js';
import { subscribeToRacers, applyConfig } from '../../components/FlatTireControl/controller/firestoreSync.js';
import { startAutoScheduler, stopAutoScheduler } from '../../components/FlatTireControl/controller/autoScheduler.js';
import { loadGoogleMapsApi } from '../../modules/googleMapsLoader.js';


export class FlatTireControlController {
  constructor() {
    this.dom = { zoneInputs: new Map(), zoneMaps: new Map(), zoneDiameterInputs: new Map(), zoneRefreshButtons: new Map() };
    this.assignments = new Map();
    this.activeTeams = [];
    this.config = {};
    this.subscriptions = [];
    this.autoScheduler = { running: false, timerId: null };
    this.mapReady = false;
    this.renderTicker = null;
    this._lastZoneSignature = '';
    this._renderTimer = null;
    this._teamSignature = '';
    this.selectedZones = new Map();
    this.handleRandomizeClick = events.handleRandomizeClick.bind(this);
    this.handleRefreshZonesClick = events.handleRefreshZonesClick.bind(this);
    this.handleZoneSelectChange = events.handleZoneSelectChange.bind(this);
    this.handleTableClick = events.handleTableClick.bind(this);
    this.handleBulkSendClick = events.handleBulkSendClick.bind(this);
  }

  async initialize() {
    ui.setupDomRefs(this);
    this.dom.tableBody?.addEventListener('click', (e) => events.handleTableClick(e, this));
    this.dom.sendBtn?.addEventListener('click', (e) => events.handleBulkSendClick(e, this));
    this.updateSendButtonState();
    this.dom.randomizeBtn?.addEventListener('click', (e) => events.handleRandomizeClick(e, this));
    this.dom.refreshZonesBtn?.addEventListener('click', () => events.handleRefreshZonesClick(this));
    this.dom.tableBody?.addEventListener('change', (e) => events.handleZoneSelectChange(e, this));
    const cfg = await service.loadFlatTireConfig();
    applyConfig(this, cfg);
    await this.ensureMapsAndZonesReady();
    this.queueRefresh(true);

    this.subscriptions.push(service.subscribeFlatTireConfig((config) => {
      applyConfig(this, config);
      this.ensureMapsAndZonesReady().then(() => this.queueRefresh());
    }));
    this.subscriptions.push(service.subscribeFlatTireAssignments(list => {
      this.assignments = new Map(list.map(i => [i.teamName, i]));
      list.forEach((entry) => {
        const teamName = typeof entry?.teamName === 'string' ? entry.teamName.trim() : '';
        if (teamName && entry?.zoneKey) {
          this.selectedZones.set(teamName, entry.zoneKey);
        }
      });
      this.queueRefresh();
      this.updateSendButtonState();
    }));
    this.subscriptions.push(subscribeToRacers(this));

    this.renderTicker = setInterval(() => this.queueRefresh(), 1000);
  }
  
  handleTeamRegistry(teamNames = []) {
    const normalized = Array.from(new Set(
      teamNames
        .map((name) => (typeof name === 'string' ? name.trim() : ''))
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const signature = JSON.stringify(normalized);
    if (signature === this._teamSignature) return;
    this._teamSignature = signature;

    this.activeTeams = normalized;
    const activeSet = new Set(normalized);
    this.selectedZones.forEach((_, key) => {
      if (!activeSet.has(key)) this.selectedZones.delete(key);
    });
    this.queueRefresh(true);
    this.updateSendButtonState();
  }

  toggleAuto() {
    if (this.autoScheduler.running) stopAutoScheduler(this);
    else startAutoScheduler(this);
  }

  destroy() {
    this.subscriptions.forEach(u => u?.());
    this.subscriptions = [];
    if (this.renderTicker) {
      clearInterval(this.renderTicker);
      this.renderTicker = null;
    }
    this.dom.randomizeBtn?.removeEventListener('click', this.handleRandomizeClick);
    this.dom.refreshZonesBtn?.removeEventListener('click', this.handleRefreshZonesClick);
    this.dom.tableBody?.removeEventListener('click', this.handleTableClick);
    this.dom.tableBody?.removeEventListener('change', this.handleZoneSelectChange);
    this.dom.sendBtn?.removeEventListener('click', this.handleBulkSendClick);
    stopAutoScheduler(this);
    this.mapReady = false;
    this._lastZoneSignature = '';
    if (this._renderTimer) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }
    this._teamSignature = '';
    this.selectedZones.clear();
  }

  async ensureMapsAndZonesReady() {
    try {
      if (!this.mapReady) {
        await loadGoogleMapsApi();
        this.mapReady = true;
      }
    } catch (err) {
      console.warn('⚠️ Flat Tire control failed to load Google Maps API:', err);
    }

    if (!this.config?.zones) return;
    this.forceMapRefresh();
  }

  refreshZonesDisplay(forceFullRender = false) {
    this.forceMapRefresh();
    ui.renderRows(this, forceFullRender);
  }

  forceMapRefresh() {
    if (!this.config?.zones) return;
    const signature = ui.generateZoneSignature(this.config.zones);
    if (signature === this._lastZoneSignature) return;
    this._lastZoneSignature = signature;
    Object.keys(this.config.zones).forEach((key) => ui.updateZonePreview(key, this.config, this.dom));
  }

  queueRefresh(force = false) {
    if (force) {
      this.refreshZonesDisplay(true);
      return;
    }
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => {
      this._renderTimer = null;
      this.refreshZonesDisplay();
    }, 300);
  }

  getConfiguredZoneKeys() {
    if (!this.config?.zones) return [];
    return Object.keys(this.config.zones).filter((key) => {
      const zone = this.config.zones[key];
      return zone && typeof zone.gps === 'string' && zone.gps.trim();
    });
  }

  updateSendButtonState() {
    const button = this.dom.sendBtn;
    if (!button) return;
    const hasReadyAssignment = this.activeTeams.some((teamName) => {
      const zoneKey = this.getSelectedZoneKey(teamName);
      if (!zoneKey) return false;
      const zone = this.config?.zones?.[zoneKey];
      if (!zone?.gps) return false;
      const currentAssignment = this.assignments.get(teamName);
      return !currentAssignment || currentAssignment.zoneKey !== zoneKey;
    });
    button.disabled = !hasReadyAssignment;
  }

  getSelectedZoneKey(teamName) {
    if (this.selectedZones.has(teamName)) {
      const stored = this.selectedZones.get(teamName);
      if (stored) return stored;
    }
    const select = this.dom.tableBody?.querySelector(`tr[data-team="${escapeSelector(teamName)}"] select[data-role="zone-select"]`);
    return select?.value || '';
  }
}

export function createFlatTireControlController() {
  return new FlatTireControlController();
}

function escapeSelector(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/[\"]/g, '\\$&');
}

// === AICP FEATURE FOOTER ===
// ai_origin: features/flat-tire/flatTireController.js
// ai_role: Logic Layer
// aicp_category: feature
// aicp_version: 3.0
// codex_phase: tier2_features_injection
// depends_on: services
// export_bridge: components
// exports: createFlatTireControlController, FlatTireControlController
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
