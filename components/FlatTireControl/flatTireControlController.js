// ============================================================================
// FILE: components/FlatTireControl/flatTireControlController.js
// PURPOSE: Component module components/FlatTireControl/flatTireControlController.js
// DEPENDS_ON: components/FlatTireControl/controller/domHandlers.js, components/FlatTireControl/controller/firestoreSync.js, components/FlatTireControl/controller/autoScheduler.js, modules/zonesMap.js, modules/googleMapsLoader.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================

import { setupDomRefs, renderRows } from './controller/domHandlers.js';
import { subscribeToRacers, applyConfig } from './controller/firestoreSync.js';
import { startAutoScheduler, stopAutoScheduler } from './controller/autoScheduler.js';
import styles from './FlatTireControl.module.css';
import {
  CAPTURE_RADIUS_METERS,
  loadFlatTireConfig,
  subscribeFlatTireAssignments,
  subscribeFlatTireConfig,
  assignFlatTireTeam,
  releaseFlatTireTeam
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
    this.selectedZones = new Map();
    this.handleRandomizeClick = this.handleRandomizeClick.bind(this);
    this.handleRefreshZonesClick = this.handleRefreshZonesClick.bind(this);
    this.handleZoneSelectChange = this.handleZoneSelectChange.bind(this);
    this.handleTableClick = this.handleTableClick.bind(this);
    this.handleBulkSendClick = this.handleBulkSendClick.bind(this);
  }

  async initialize() {
    setupDomRefs(this);
    this.dom.tableBody?.addEventListener('click', this.handleTableClick);
    this.dom.sendBtn?.addEventListener('click', this.handleBulkSendClick);
    this.updateSendButtonState();
    this.dom.randomizeBtn?.addEventListener('click', this.handleRandomizeClick);
    this.dom.refreshZonesBtn?.addEventListener('click', this.handleRefreshZonesClick);
    this.dom.tableBody?.addEventListener('change', this.handleZoneSelectChange);
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

  handleRefreshZonesClick() {
    const button = this.dom.refreshZonesBtn;
    if (button) button.disabled = true;

    loadFlatTireConfig()
      .then((cfg) => {
        applyConfig(this, cfg);
        return this.ensureMapsAndZonesReady();
      })
      .then(() => this.queueRefresh(true))
      .catch((err) => console.error('❌ Failed to refresh Flat Tire zones:', err))
      .finally(() => {
        if (button) button.disabled = false;
      });
  }

  handleZoneSelectChange(event) {
    const select = event?.target;
    if (!select || !select.matches('select[data-role="zone-select"]')) return;
    const team = select.closest('tr[data-team]')?.dataset.team;
    if (!team) return;
    this.selectedZones.set(team, select.value || '');
    this.updateSendButtonState();
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

    this.activeTeams.forEach((teamName, index) => {
      const zoneKey = shuffledZones[index % shuffledZones.length];
      this.selectedZones.set(teamName, zoneKey);
      const select = this.dom.tableBody?.querySelector(`tr[data-team="${escapeSelector(teamName)}"] select[data-role="zone-select"]`);
      if (select) select.value = zoneKey;
    });
    this.updateSendButtonState();
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

  handleTableClick(event) {
    const target = event?.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('tr[data-team]');
    if (!row) return;
    const teamName = row.dataset.team;
    if (!teamName) return;

    const action = button.dataset.action;
    if (action === 'assign') {
      this.assignTeam(teamName, button).catch((err) => {
        console.error(`❌ Flat Tire send failed for ${teamName}:`, err);
      });
    } else if (action === 'release') {
      this.releaseTeam(teamName, button).catch((err) => {
        console.error(`❌ Flat Tire release failed for ${teamName}:`, err);
      });
    }
  }

  async handleBulkSendClick(event) {
    event?.preventDefault?.();
    const button = this.dom.sendBtn;
    if (!button) return;

    if (!this.activeTeams.length) {
      alert('No teams available to send. Wait for racers to register.');
      return;
    }

    const teamsToSend = this.activeTeams.filter((teamName) => {
      const zoneKey = this.getSelectedZoneKey(teamName);
      if (!zoneKey) return false;
      const zone = this.config?.zones?.[zoneKey];
      if (!zone?.gps) return false;
      const currentAssignment = this.assignments.get(teamName);
      return !currentAssignment || currentAssignment.zoneKey !== zoneKey;
    });

    if (!teamsToSend.length) {
      alert('Select tow zones for at least one team before sending.');
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Sending...';

    try {
      for (const teamName of teamsToSend) {
        // Sequential to propagate alerts accurately and simplify UI feedback.
        await this.assignTeam(teamName);
      }
      button.textContent = '✅ Sent!';
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2500);
    } catch (err) {
      console.error('❌ Bulk Flat Tire send failed:', err);
      alert('Failed to send one or more tow assignments. Check console for details.');
      button.textContent = '⚠️ Error — Retry';
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 3500);
    }
  }

  async assignTeam(teamName, button) {
    const zoneKey = this.getSelectedZoneKey(teamName);
    if (!zoneKey) {
      alert(`Select a tow zone for ${teamName} before sending.`);
      throw new Error(`No tow zone selected for ${teamName}.`);
    }

    const zone = this.config?.zones?.[zoneKey];
    if (!zone?.gps) {
      alert(`The ${zone?.name || zoneKey} zone is missing GPS details. Configure it before sending.`);
      throw new Error(`Tow zone ${zoneKey} missing GPS details.`);
    }

    this.selectedZones.set(teamName, zoneKey);
    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Sending...';
    }

    try {
      await assignFlatTireTeam(teamName, {
        depotId: zoneKey,
        zoneKey,
        zoneName: zone.name || `Zone ${zoneKey.toUpperCase()}`,
        gps: zone.gps,
        lat: zone.lat,
        lng: zone.lng,
        diameterMeters: zone.diameterMeters,
        captureRadiusMeters: zone.captureRadiusMeters,
        assignedBy: 'Control Panel',
        status: 'control-assigned'
      });
      this.assignments.set(teamName, { zoneKey });
      if (button) {
        button.textContent = '✅ Sent!';
        setTimeout(() => {
          button.textContent = originalText || '🚨 Send';
          button.disabled = false;
        }, 2500);
      }
      this.queueRefresh();
      this.updateSendButtonState();
      return true;
    } catch (err) {
      if (button) {
        button.textContent = '⚠️ Error — Retry';
        setTimeout(() => {
          button.textContent = originalText || '🚨 Send';
          button.disabled = false;
        }, 3500);
      } else {
        alert(`Failed to send a tow crew to ${teamName}. Check console for details.`);
      }
      throw err;
    }
  }

  async releaseTeam(teamName, button) {
    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Releasing...';
    }
    try {
      await releaseFlatTireTeam(teamName);
      this.assignments.delete(teamName);
      if (button) {
        button.textContent = '✅ Released';
        setTimeout(() => {
          button.textContent = originalText || '✅ Release';
          button.disabled = true;
        }, 2000);
      }
      this.queueRefresh();
    } catch (err) {
      if (button) {
        button.textContent = '⚠️ Error — Retry';
        setTimeout(() => {
          button.textContent = originalText || '✅ Release';
          button.disabled = false;
        }, 3500);
      } else {
        alert(`Failed to release ${teamName}. Check console for details.`);
      }
      throw err;
    } finally {
      this.updateSendButtonState();
    }
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

function escapeSelector(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/["]/g, '\\$&');
}

// === AI-CONTEXT-MAP ===
// aicp_category: component
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// ai_role: UI Layer
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: FlatTireControlController, createFlatTireControlController
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END ===
