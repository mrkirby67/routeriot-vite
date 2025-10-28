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
    this._lastZoneSignature = '';
    this._renderTimer = null;
  }

  async initialize() {
    setupDomRefs(this);
    const cfg = await loadFlatTireConfig();
    applyConfig(this, cfg);
    await this.ensureMapsAndZonesReady();
    this.queueRefresh(true);

    this.subscriptions.push(subscribeFlatTireConfig((config) => {
      applyConfig(this, config);
      this.ensureMapsAndZonesReady().then(() => this.queueRefresh());
    }));
    this.subscriptions.push(subscribeFlatTireAssignments(list => {
      this.assignments = new Map(list.map(i => [i.teamName, i]));
      this.queueRefresh();
    }));
    this.subscriptions.push(subscribeToRacers(this));

    this.renderTicker = setInterval(() => this.queueRefresh(), 1000);
  }

  handleTeamRegistry(teams = []) {
    this.activeTeams = teams.sort((a, b) => a.localeCompare(b));
    this.queueRefresh(true);
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
    this._lastZoneSignature = '';
    if (this._renderTimer) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }
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
    this.forceMapRefresh();
    renderRows(this, forceFullRender);
  }

  forceMapRefresh() {
    if (!this.config?.zones) return;
    const signature = generateZoneSignature(this.config.zones);
    if (signature === this._lastZoneSignature) return;
    this._lastZoneSignature = signature;
    Object.keys(this.config.zones).forEach((key) => this.updateZonePreview(key));
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
}

export function createFlatTireControlController() {
  return new FlatTireControlController();
}

function generateZoneSignature(zones = {}) {
  const normalized = {};
  Object.entries(zones).forEach(([key, zone]) => {
    const gps = typeof zone?.gps === 'string' ? zone.gps.trim() : '';
    const diameter = Number(zone?.diameterMeters) || Number(zone?.diameter) || 0;
    normalized[key] = { gps, diameter };
  });
  return JSON.stringify(normalized);
}
