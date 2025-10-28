// ============================================================================
// CENTRAL HUB: Flat Tire Control Controller
// ============================================================================
import { setupDomRefs, renderRows } from './controller/domHandlers.js';
import { subscribeToRacers, applyConfig } from './controller/firestoreSync.js';
import { startAutoScheduler, stopAutoScheduler } from './controller/autoScheduler.js';
import styles from './FlatTireControl.module.css';
import {
  CAPTURE_RADIUS_METERS,
  assignFlatTireTeam,
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
    this._teamSignature = '';
    this.handleRandomizeClick = this.handleRandomizeClick.bind(this);
  }

  async initialize() {
    setupDomRefs(this);
    this.dom.randomizeBtn?.addEventListener('click', this.handleRandomizeClick);
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
    this.dom.randomizeBtn?.removeEventListener('click', this.handleRandomizeClick);
    stopAutoScheduler(this);
    this.mapReady = false;
    this._lastZoneSignature = '';
    if (this._renderTimer) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }
    this._teamSignature = '';
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

  async handleRandomizeClick(event) {
    event?.preventDefault?.();

    if (!this.activeTeams.length) {
      alert('No teams registered to randomize.');
      return;
    }

    const configuredZones = this.getConfiguredZoneKeys();
    if (!configuredZones.length) {
      alert('Tow zones not ready — please configure GPS coordinates.');
      return;
    }

    const button = this.dom.randomizeBtn;
    if (button) button.disabled = true;

    try {
      await this.randomizeAssignedZones(configuredZones);
      this.queueRefresh(true);
    } catch (err) {
      console.error('❌ Randomize tow zones failed:', err);
      alert('Failed to randomize tow zones. Check console for details.');
    } finally {
      const enabled = this.activeTeams.length > 0 && this.getConfiguredZoneKeys().length > 0;
      if (button) button.disabled = !enabled;
      this.queueRefresh();
    }
  }

  getConfiguredZoneKeys() {
    if (!this.config?.zones) return [];
    return Object.keys(this.config.zones).filter((key) => {
      const zone = this.config.zones[key];
      return zone && typeof zone.gps === 'string' && zone.gps.trim();
    });
  }

  async randomizeAssignedZones(zoneKeys = this.getConfiguredZoneKeys()) {
    if (!zoneKeys.length) {
      alert('Configure at least one tow zone with GPS before randomizing.');
      return;
    }

    console.log('🎲 Randomizing Flat Tire zones for teams:', this.activeTeams);
    const shuffledZones = shuffleArray(zoneKeys);

    const operations = this.activeTeams.map((teamName, index) => {
      const zoneKey = shuffledZones[index % shuffledZones.length];
      const zone = this.config.zones[zoneKey] || {};
      const now = Date.now();
      const diameterMeters = Number(zone.diameterMeters)
        || (Number(zone.diameter) || 0) * 1000
        || 200;
      return assignFlatTireTeam(teamName, {
        zoneKey,
        depotId: zoneKey,
        zoneName: zone.name || `Zone ${zoneKey.toUpperCase()}`,
        gps: zone.gps || '',
        lat: Number.isFinite(zone.lat) ? zone.lat : undefined,
        lng: Number.isFinite(zone.lng) ? zone.lng : undefined,
        diameterMeters,
        captureRadiusMeters: zone.captureRadiusMeters || CAPTURE_RADIUS_METERS,
        assignedAt: now,
        autoReleaseAt: now + 20 * 60_000,
        assignedBy: 'Control Randomize',
        status: 'auto-assigned'
      });
    });

    await Promise.allSettled(operations);
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

function shuffleArray(array) {
  const clone = array.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}
