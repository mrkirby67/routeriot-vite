// ============================================================================
// CENTRAL HUB: Flat Tire Control Controller
// ============================================================================
import { setupDomRefs, renderRows } from './controller/domHandlers.js';
import { subscribeToRacers, applyConfig } from './controller/firestoreSync.js';
import { startAutoScheduler, stopAutoScheduler } from './controller/autoScheduler.js';
import styles from './FlatTireControl.module.css';
import {
  CAPTURE_RADIUS_METERS,
  loadFlatTireConfig,
  subscribeFlatTireAssignments,
  subscribeFlatTireConfig
} from '../../modules/flatTireManager.js';
import { generateMiniMap } from '../../modules/zonesMap.js';
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
  }

  async initialize() {
    setupDomRefs(this);
    const cfg = await loadFlatTireConfig();
    applyConfig(this, cfg);
    await this.ensureMapsAndZonesReady();
    this.refreshZonesDisplay(true);

    this.subscriptions.push(subscribeFlatTireConfig((config) => {
      applyConfig(this, config);
      this.ensureMapsAndZonesReady().then(() => this.refreshZonesDisplay());
    }));
    this.subscriptions.push(subscribeFlatTireAssignments(list => {
      this.assignments = new Map(list.map(i => [i.teamName, i]));
      this.refreshZonesDisplay();
    }));
    this.subscriptions.push(subscribeToRacers(this));

    this.renderTicker = setInterval(() => this.refreshZonesDisplay(), 1000);
  }

  handleTeamRegistry(teams = []) {
    this.activeTeams = teams.sort((a, b) => a.localeCompare(b));
    this.refreshZonesDisplay(true);
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
    stopAutoScheduler(this);
    this.mapReady = false;
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
    Object.keys(this.config.zones).forEach((key) => this.updateZonePreview(key));
  }

  updateZonePreview(zoneKey) {
    const mapEl = this.dom.zoneMaps.get(zoneKey);
    if (!mapEl) return;
    const zone = this.config?.zones?.[zoneKey];
    if (zone?.gps) {
      const diameterKm = Number(zone.diameter) || (Number(zone.diameterMeters) || 0) / 1000;
      const html = generateMiniMap({
        name: zone.name || `Zone ${zoneKey.toUpperCase()}`,
        gps: zone.gps,
        diameter: diameterKm,
        captureRadiusMeters: zone.captureRadiusMeters || CAPTURE_RADIUS_METERS
      });
      mapEl.innerHTML = html;
    } else {
      mapEl.innerHTML = `<div class="${styles.mapPlaceholder}">Waiting for GPS...</div>`;
    }
  }

  refreshZonesDisplay(forceFullRender = false) {
    if (this.config?.zones) {
      Object.keys(this.config.zones).forEach((key) => this.updateZonePreview(key));
    }
    renderRows(this, forceFullRender);
  }
}

export function createFlatTireControlController() {
  return new FlatTireControlController();
}
