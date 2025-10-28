// ============================================================================
// FILE: components/FlatTireControl/flatTireControlController.js
// PURPOSE: UI orchestration for Flat Tire — Tow Time control panel
// ============================================================================

import styles from './FlatTireControl.module.css';
import { allTeams } from '../../data.js';
import {
  assignFlatTireTeam,
  loadFlatTireConfig,
  releaseFlatTireTeam,
  saveFlatTireConfig,
  subscribeFlatTireAssignments,
  subscribeFlatTireConfig,
  __flatTireDefaults,
  CAPTURE_RADIUS_METERS
} from '../../modules/flatTireManager.js';
import { generateMiniMap } from '../../modules/zonesMap.js';
import { db } from '../../modules/config.js';
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { escapeHtml } from '../../modules/utils.js';

let flatTireControllerBootstrapped = false;

const ZONE_KEYS = ['north', 'south', 'east', 'west'];
const AUTO_RELEASE_MINUTES = 20;
const DEFAULT_DIAMETER_METERS = 200;
const MIN_DIAMETER_METERS = 50;

function parseGps(value = '') {
  if (typeof value !== 'string') return null;
  const [latStr, lngStr] = value.split(',');
  const lat = Number.parseFloat(latStr);
  const lng = Number.parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function pickLeastBusyZone(assignmentsByZone = {}, availableKeys = []) {
  let bestKey = null;
  let bestCount = Infinity;
  availableKeys.forEach((zoneKey) => {
    const count = assignmentsByZone[zoneKey] || 0;
    if (count < bestCount) {
      bestCount = count;
      bestKey = zoneKey;
    }
  });
  return bestKey || availableKeys[0] || null;
}

export function createFlatTireControlController() {
  return new FlatTireControlController();
}

class FlatTireControlController {
  constructor() {
    this.dom = {
      tableBody: null,
      autoIntervalInput: null,
      autoToggleBtn: null,
      randomizeBtn: null,
      zoneInputs: new Map(),
      zoneMaps: new Map(),
      zoneDiameterInputs: new Map(),
      zoneRefreshButtons: new Map()
    };
    this.config = {
      zones: JSON.parse(JSON.stringify(__flatTireDefaults.DEFAULT_ZONES)),
      autoIntervalMinutes: __flatTireDefaults.DEFAULT_AUTO_INTERVAL_MINUTES
    };
    this.assignments = new Map();
    this.activeTeams = [];
    this.subscriptions = [];
    this.autoScheduler = { running: false, timerId: null, cursor: 0 };
    this.tickerId = null;
    this.saveTimerId = null;
    this.ignoreConfigInput = false;
    this.initialized = false;
    this.listenersAttached = false;

    this.handleAssignmentSnapshot = this.handleAssignmentSnapshot.bind(this);
    this.handleTeamRegistry = this.handleTeamRegistry.bind(this);
    this.onZoneInputChange = this.onZoneInputChange.bind(this);
    this.onDiameterInputChange = this.onDiameterInputChange.bind(this);
    this.onRefreshClick = this.onRefreshClick.bind(this);
    this.onTableClick = this.onTableClick.bind(this);
    this.onZoneSelectChange = this.onZoneSelectChange.bind(this);
    this.onAutoToggle = this.onAutoToggle.bind(this);
    this.onIntervalChange = this.onIntervalChange.bind(this);
    this.onRandomizeZones = this.onRandomizeZones.bind(this);
    this.ensureConfigLoaded = this.ensureConfigLoaded.bind(this);
  }

  async initialize() {
    if (this.initialized || flatTireControllerBootstrapped) {
      console.info('ℹ️ [flatTireControl] initialize() skipped — already active.');
      return () => {};
    }
    this.initialized = true;
    flatTireControllerBootstrapped = true;

    this.captureDom();
    this.attachListeners();

    try {
      const initialConfig = await loadFlatTireConfig();
      this.applyConfig(initialConfig);
    } catch (err) {
      console.warn('⚠️ Flat Tire config load failed:', err);
    }

    await this.ensureConfigLoaded();

    this.subscriptions.push(subscribeFlatTireConfig(config => this.applyConfig(config)));
    this.subscriptions.push(subscribeFlatTireAssignments(this.handleAssignmentSnapshot));
    this.subscriptions.push(this.subscribeToRacers());

    this.tickerId = setInterval(() => this.renderRows(), 1000);
    this.renderRows();

    return (reason) => this.destroy(reason);
  }

  destroy(reason = 'manual') {
    this.subscriptions.forEach(unsub => {
      try { unsub?.(); } catch (err) { console.warn('⚠️ Flat Tire unsub error:', err); }
    });
    this.subscriptions = [];

    this.detachListeners();

    if (this.autoScheduler.timerId) {
      clearInterval(this.autoScheduler.timerId);
      this.autoScheduler.timerId = null;
    }
    this.autoScheduler.running = false;

    if (this.tickerId) {
      clearInterval(this.tickerId);
      this.tickerId = null;
    }

    if (this.saveTimerId) {
      clearTimeout(this.saveTimerId);
      this.saveTimerId = null;
    }

    this.initialized = false;
    this.listenersAttached = false;
    flatTireControllerBootstrapped = false;

    console.info(`🧹 [flatTireControl] destroyed (${reason})`);
  }

  captureDom() {
    const tableBody = document.getElementById('flat-tire-table-body');
    const autoIntervalInput = document.getElementById('flat-tire-auto-interval');
    const autoToggleBtn = document.getElementById('flat-tire-toggle-auto');
    const randomizeBtn = document.getElementById('ft-randomize-zones-btn');

    this.dom.tableBody = tableBody;
    this.dom.autoIntervalInput = autoIntervalInput;
    this.dom.autoToggleBtn = autoToggleBtn;
    this.dom.randomizeBtn = randomizeBtn;

    ZONE_KEYS.forEach((key) => {
      const input = document.getElementById(`flat-tire-zone-gps-${key}`);
      const map = document.getElementById(`flat-tire-zone-map-${key}`);
      const diameterInput = document.getElementById(`flat-tire-zone-diameter-${key}`);
      const refreshBtn = document.querySelector(`button[data-role="refresh"][data-zone="${key}"]`);
      if (input) this.dom.zoneInputs.set(key, input);
      if (map) this.dom.zoneMaps.set(key, map);
      if (diameterInput) this.dom.zoneDiameterInputs.set(key, diameterInput);
      if (refreshBtn) this.dom.zoneRefreshButtons.set(key, refreshBtn);
    });
  }

  attachListeners() {
    if (this.listenersAttached) return;

    this.dom.zoneInputs.forEach((input) => {
      input.addEventListener('input', this.onZoneInputChange);
      input.addEventListener('change', this.onZoneInputChange);
    });
    this.dom.zoneDiameterInputs.forEach((input) => {
      input.addEventListener('input', this.onDiameterInputChange);
      input.addEventListener('change', this.onDiameterInputChange);
    });
    this.dom.zoneRefreshButtons.forEach((button) => {
      button.addEventListener('click', this.onRefreshClick);
    });
    this.dom.tableBody?.addEventListener('click', this.onTableClick);
    this.dom.tableBody?.addEventListener('change', this.onZoneSelectChange);
    this.dom.autoToggleBtn?.addEventListener('click', this.onAutoToggle);
    this.dom.autoIntervalInput?.addEventListener('change', this.onIntervalChange);
    this.dom.randomizeBtn?.addEventListener('click', this.onRandomizeZones);

    this.listenersAttached = true;
  }

  detachListeners() {
    if (!this.listenersAttached) return;

    this.dom.zoneInputs.forEach((input) => {
      input.removeEventListener('input', this.onZoneInputChange);
      input.removeEventListener('change', this.onZoneInputChange);
    });
    this.dom.zoneDiameterInputs.forEach((input) => {
      input.removeEventListener('input', this.onDiameterInputChange);
      input.removeEventListener('change', this.onDiameterInputChange);
    });
    this.dom.zoneRefreshButtons.forEach((button) => {
      button.removeEventListener('click', this.onRefreshClick);
    });
    this.dom.tableBody?.removeEventListener('click', this.onTableClick);
    this.dom.tableBody?.removeEventListener('change', this.onZoneSelectChange);
    this.dom.autoToggleBtn?.removeEventListener('click', this.onAutoToggle);
    this.dom.autoIntervalInput?.removeEventListener('change', this.onIntervalChange);
    this.dom.randomizeBtn?.removeEventListener('click', this.onRandomizeZones);

    this.listenersAttached = false;
  }

  subscribeToRacers() {
    try {
      const racersRef = collection(db, 'racers');
      return onSnapshot(racersRef, (snapshot) => {
        const teams = new Set();
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const teamName = typeof data?.team === 'string' ? data.team.trim() : '';
          if (teamName && teamName !== '-') teams.add(teamName);
        });
        this.handleTeamRegistry(Array.from(teams));
      }, (err) => {
        console.warn('⚠️ Flat Tire → racer registry failed:', err);
        this.handleTeamRegistry([]);
      });
    } catch (err) {
      console.warn('⚠️ Flat Tire → unable to subscribe to racers:', err);
      this.handleTeamRegistry([]);
      return () => {};
    }
  }

  handleTeamRegistry(teamNames = []) {
    const normalized = Array.from(new Set(
      teamNames
        .map(name => typeof name === 'string' ? name.trim() : '')
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    this.activeTeams = normalized;
    this.renderRows(true);
  }

  handleAssignmentSnapshot(list = []) {
    const map = new Map();
    list.forEach((entry) => {
      const teamName = entry?.teamName;
      if (!teamName) return;
      map.set(teamName, entry);
    });
    this.assignments = map;
    this.renderRows();
  }

  applyConfig(config = {}) {
    if (!config?.zones) return;
    this.config = config;
    this.ignoreConfigInput = true;

    ZONE_KEYS.forEach((key) => {
      const zone = { ...(config.zones[key] || {}) };
      const input = this.dom.zoneInputs.get(key);
      const diameterInput = this.dom.zoneDiameterInputs.get(key);
      const card = document.querySelector(`.${styles.zoneCard}[data-zone="${key}"] h3`);
      if (card) card.textContent = zone.name || `Zone ${key.toUpperCase()}`;
      if (input && input.value !== zone.gps) {
        input.value = zone.gps || '';
      }
      const diameterMeters = Number.isFinite(zone.diameterMeters) && zone.diameterMeters > 0
        ? zone.diameterMeters
        : (Number.isFinite(zone.diameter) && zone.diameter > 0
            ? zone.diameter * 1000
            : DEFAULT_DIAMETER_METERS);
      const normalizedZone = {
        ...zone,
        diameterMeters,
        diameter: diameterMeters / 1000
      };
      this.config.zones[key] = normalizedZone;
      config.zones[key] = normalizedZone;
      if (diameterInput) {
        const meters = Math.max(MIN_DIAMETER_METERS, Math.round(diameterMeters));
        if (Number(diameterInput.value) !== meters) {
          diameterInput.value = String(meters);
        }
      }
      this.updateZonePreview(key);
    });

    if (this.dom.autoIntervalInput) {
      this.dom.autoIntervalInput.value = config.autoIntervalMinutes;
    }

    this.ignoreConfigInput = false;
    void this.ensureConfigLoaded();
    this.renderRows();
  }

  queueConfigSave() {
    if (this.ignoreConfigInput) return;
    if (this.saveTimerId) clearTimeout(this.saveTimerId);
    this.saveTimerId = setTimeout(() => this.persistConfig(), 600);
  }

  async persistConfig() {
    this.saveTimerId = null;
    const zones = {};
    ZONE_KEYS.forEach((key) => {
      const input = this.dom.zoneInputs.get(key);
      const diameterInput = this.dom.zoneDiameterInputs.get(key);
      const current = this.config.zones[key] || {};
      const rawMeters = Number.parseFloat(diameterInput?.value) || DEFAULT_DIAMETER_METERS;
      const diameterMeters = Math.max(MIN_DIAMETER_METERS, rawMeters);
      if (diameterInput) diameterInput.value = String(Math.round(diameterMeters));

      const updated = {
        ...current,
        gps: input?.value.trim() || '',
        name: current.name || `Zone ${key.toUpperCase()}`,
        diameterMeters
      };
      delete updated.diameter;

      const coords = parseGps(updated.gps);
      if (coords) {
        updated.lat = coords.lat;
        updated.lng = coords.lng;
      } else {
        delete updated.lat;
        delete updated.lng;
      }

      zones[key] = updated;
      this.config.zones[key] = updated;
    });
    const autoInterval = parseInt(this.dom.autoIntervalInput?.value || `${this.config.autoIntervalMinutes}`, 10);
    try {
      await saveFlatTireConfig({
        zones,
        autoIntervalMinutes: Number.isFinite(autoInterval) && autoInterval > 0 ? autoInterval : __flatTireDefaults.DEFAULT_AUTO_INTERVAL_MINUTES
      });
    } catch (err) {
      console.error('❌ Failed to save Flat Tire config:', err);
      alert('Failed to save Flat Tire config. Check console for details.');
    }
  }

  updateZonePreview(zoneKey) {
    const map = this.dom.zoneMaps.get(zoneKey);
    if (!map) return;
    const zone = this.config.zones[zoneKey] || {};
    if (zone.gps) {
      const diameterMeters = Number.isFinite(zone.diameterMeters) && zone.diameterMeters > 0
        ? zone.diameterMeters
        : (Number.isFinite(zone.diameter) && zone.diameter > 0
            ? zone.diameter * 1000
            : DEFAULT_DIAMETER_METERS);
      const diameterKm = diameterMeters / 1000;
      map.innerHTML = generateMiniMap({
        name: zone.name || `Zone ${zoneKey.toUpperCase()}`,
        gps: zone.gps,
        diameter: diameterKm,
        captureRadiusMeters: CAPTURE_RADIUS_METERS
      });
    } else {
      map.innerHTML = `<div class="${styles.mapPlaceholder}">Waiting for GPS...</div>`;
    }
  }

  onZoneInputChange(event) {
    const input = event?.target;
    const zoneKey = input?.dataset?.zone;
    if (zoneKey) {
      const existing = this.config.zones[zoneKey] || {};
      this.config.zones[zoneKey] = {
        ...existing,
        gps: input.value.trim()
      };
    }
    this.queueConfigSave();
  }

  onDiameterInputChange(event) {
    const input = event?.target;
    const zoneKey = input?.dataset?.zone;
    if (zoneKey) {
      const meters = Math.max(MIN_DIAMETER_METERS, Number.parseFloat(input.value) || DEFAULT_DIAMETER_METERS);
      input.value = String(Math.round(meters));
      const existing = this.config.zones[zoneKey] || {};
      this.config.zones[zoneKey] = {
        ...existing,
        diameterMeters: meters
      };
      delete this.config.zones[zoneKey].diameter;
    }
    this.queueConfigSave();
  }

  onRefreshClick(event) {
    const button = event?.target?.closest('button[data-role="refresh"]');
    if (!button) return;
    const zoneKey = button.dataset.zone;
    if (!zoneKey) return;

    const gpsInput = this.dom.zoneInputs.get(zoneKey);
    const diameterInput = this.dom.zoneDiameterInputs.get(zoneKey);
    const meters = Math.max(
      MIN_DIAMETER_METERS,
      Number.parseFloat(diameterInput?.value) || DEFAULT_DIAMETER_METERS
    );
    if (diameterInput) {
      diameterInput.value = String(Math.round(meters));
    }

    const existing = this.config.zones[zoneKey] || {};
    this.config.zones[zoneKey] = {
      ...existing,
      gps: gpsInput?.value.trim() || '',
      diameterMeters: meters,
      name: existing.name || `Zone ${zoneKey.toUpperCase()}`
    };
    delete this.config.zones[zoneKey].diameter;

    this.updateZonePreview(zoneKey);
    this.queueConfigSave();
  }

  onIntervalChange() {
    this.queueConfigSave();
  }

  onAutoToggle() {
    if (this.autoScheduler.running) {
      this.stopAutoScheduler();
    } else {
      this.startAutoScheduler();
    }
  }

  async onRandomizeZones(event) {
    event?.preventDefault?.();
    await this.randomizeAssignedZones();
  }

  startAutoScheduler() {
    if (this.autoScheduler.running) return;
    const intervalMinutes = parseInt(this.dom.autoIntervalInput?.value || `${this.config.autoIntervalMinutes}`, 10);
    const minutes = Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? intervalMinutes
      : this.config.autoIntervalMinutes || __flatTireDefaults.DEFAULT_AUTO_INTERVAL_MINUTES;

    const intervalMs = minutes * 60_000;
    this.autoScheduler.running = true;
    this.autoScheduler.cursor = 0;
    this.autoScheduler.timerId = setInterval(() => this.runAutoCycle(), intervalMs);
    this.dom.autoToggleBtn.textContent = '⏹ Stop Auto Schedule';
    this.dom.autoToggleBtn.classList.add(styles.primaryBtn);
    this.dom.autoToggleBtn.classList.remove(styles.secondaryBtn);
    this.runAutoCycle(); // kick off immediately
  }

  stopAutoScheduler() {
    if (!this.autoScheduler.running) return;
    if (this.autoScheduler.timerId) clearInterval(this.autoScheduler.timerId);
    this.autoScheduler.timerId = null;
    this.autoScheduler.running = false;
    this.dom.autoToggleBtn.textContent = '▶️ Start Auto Schedule';
    this.dom.autoToggleBtn.classList.remove(styles.primaryBtn);
    this.dom.autoToggleBtn.classList.add(styles.secondaryBtn);
  }

  async ensureConfigLoaded() {
    const zones = this.config?.zones || {};
    const missingGps = ZONE_KEYS.filter((key) => {
      const gps = zones[key]?.gps;
      return !gps || !gps.trim();
    });

    if (missingGps.length) {
      console.warn(`⚠️ [flatTireControl] Missing GPS config for zones: ${missingGps.join(', ')}`);
    }

    if (this.dom.randomizeBtn) {
      this.dom.randomizeBtn.disabled = missingGps.length === ZONE_KEYS.length;
    }

    return missingGps.length === 0;
  }

  async randomizeAssignedZones() {
    const button = this.dom.randomizeBtn;
    const teams = Array.isArray(this.activeTeams) ? [...this.activeTeams] : [];
    if (!teams.length) {
      alert('No teams available to randomize.');
      return;
    }

    await this.ensureConfigLoaded();

    const availableZones = ZONE_KEYS.filter((key) => {
      const zone = this.config.zones[key];
      return zone && typeof zone.gps === 'string' && zone.gps.trim();
    });
    if (!availableZones.length) {
      alert('Configure at least one tow zone with GPS before randomizing assignments.');
      return;
    }

    if (button) button.disabled = true;

    try {
      const shuffledZones = availableZones.slice();
      for (let i = shuffledZones.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledZones[i], shuffledZones[j]] = [shuffledZones[j], shuffledZones[i]];
      }

      const operations = teams.map((teamName, index) => {
        const zoneKey = shuffledZones[index % shuffledZones.length];
        return this.assignTeam(teamName, zoneKey, { cause: 'randomize' });
      });

      await Promise.allSettled(operations);
      this.renderRows(true);
    } catch (err) {
      console.error('❌ Flat Tire randomize failed:', err);
      console.warn('⚠️ [flatTireControl] Randomize aborted — verify zone configuration and assignments.');
      alert('Failed to randomize tow zones. Check console for details.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  runAutoCycle() {
    const availableTeams = this.activeTeams.filter(team => !this.assignments.has(team));
    const availableZones = ZONE_KEYS.filter(key => {
      const zone = this.config.zones[key];
      return zone && zone.gps;
    });

    if (!availableTeams.length || !availableZones.length) {
      console.info('ℹ️ Flat Tire auto scheduler idle (no teams or zones).');
      return;
    }

    const index = this.autoScheduler.cursor % availableTeams.length;
    const teamName = availableTeams[index];
    this.autoScheduler.cursor = (index + 1) % Math.max(1, availableTeams.length);

    const assignmentsByZone = {};
    this.assignments.forEach((assignment) => {
      if (!assignment?.zoneKey) return;
      assignmentsByZone[assignment.zoneKey] = (assignmentsByZone[assignment.zoneKey] || 0) + 1;
    });

    const zoneKey = pickLeastBusyZone(assignmentsByZone, availableZones);
    if (!zoneKey) return;

    this.assignTeam(teamName, zoneKey, { cause: 'auto' }).catch(err => {
      console.warn('⚠️ Flat Tire auto assignment failed:', err);
    });
  }

  onTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('tr[data-team]');
    if (!row) return;
    const teamName = row.dataset.team;
    const action = button.dataset.action;
    const select = row.querySelector('select[data-role="zone-select"]');
    const zoneKey = select?.value || null;

    if (action === 'assign') {
      if (!zoneKey) {
        alert('Select a tow zone before dispatching.');
        return;
      }
      this.assignTeam(teamName, zoneKey).catch(err => {
        console.error('❌ Flat Tire assignment failed:', err);
        alert(`Failed to assign Flat Tire to ${teamName}.`);
      });
    } else if (action === 'release') {
      this.releaseTeam(teamName).catch(err => {
        console.error('❌ Flat Tire release failed:', err);
        alert(`Failed to release ${teamName} from Flat Tire.`);
      });
    }
  }

  onZoneSelectChange(event) {
    if (event.target.matches('select[data-role="zone-select"]')) {
      event.target.dataset.changed = 'true';
    }
  }

  async assignTeam(teamName, zoneKey, { cause = 'manual' } = {}) {
    const zone = this.config.zones[zoneKey];
    if (!zone || !zone.gps) {
      alert('Configure this tow zone GPS before dispatching.');
      return;
    }
    const now = Date.now();
    const coords = parseGps(zone.gps);
    const diameterMeters = Number.isFinite(zone.diameterMeters) && zone.diameterMeters > 0
      ? zone.diameterMeters
      : DEFAULT_DIAMETER_METERS;
    await assignFlatTireTeam(teamName, {
      zoneKey,
      depotId: zoneKey,
      zoneName: zone.name,
      gps: zone.gps,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      diameterMeters,
      assignedAt: now,
      autoReleaseAt: now + AUTO_RELEASE_MINUTES * 60_000,
      autoReleaseMinutes: AUTO_RELEASE_MINUTES,
      assignedBy: 'Game Control',
      status: cause === 'auto' ? 'auto-assigned' : 'assigned'
    });
  }

  async releaseTeam(teamName) {
    await releaseFlatTireTeam(teamName);
  }

  renderRows(forceFullRender = false) {
    const body = this.dom.tableBody;
    if (!body) return;

    const hasTeams = this.activeTeams.length > 0;
    const hasZonesConfigured = ZONE_KEYS.some((key) => {
      const zone = this.config.zones[key];
      return zone && typeof zone.gps === 'string' && zone.gps.trim();
    });

    if (this.dom.randomizeBtn) {
      this.dom.randomizeBtn.disabled = !(hasTeams && hasZonesConfigured);
    }

    if (!this.activeTeams.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4" class="${styles.loading}">
            Waiting for registered teams…
          </td>
        </tr>
      `;
      return;
    }

    if (forceFullRender || body.children.length !== this.activeTeams.length) {
      body.innerHTML = '';
      const fragment = document.createDocumentFragment();

      this.activeTeams.forEach(teamName => {
        const teamMeta = allTeams.find(t => t.name === teamName) || {};
        const row = document.createElement('tr');
        row.dataset.team = teamName;

        const assignment = this.assignments.get(teamName) || null;
        const zoneKey = assignment?.zoneKey || '';

        const zoneSelectOptions = ZONE_KEYS.map(key => {
          const zone = this.config.zones[key];
          const label = zone?.name || `Zone ${key.toUpperCase()}`;
          const disabled = zone?.gps ? '' : 'disabled';
          const selected = zoneKey === key ? 'selected' : '';
          return `<option value="${key}" ${disabled} ${selected}>${escapeHtml(label)}</option>`;
        }).join('');

        row.innerHTML = `
          <td class="${styles.teamCell}">
            <strong>${escapeHtml(teamName)}</strong>
            <span>${escapeHtml(teamMeta.slogan || '')}</span>
          </td>
          <td>
            <select class="${styles.zoneSelect}" data-role="zone-select">
              <option value="">Select tow zone…</option>
              ${zoneSelectOptions}
            </select>
          </td>
          <td class="${styles.statusCell}" data-role="status-cell"></td>
          <td class="${styles.actionsCell}">
            <button type="button" class="${styles.actionBtn} ${styles.assignBtn}" data-action="assign">🚨 Send Flat Tire</button>
            <button type="button" class="${styles.actionBtn} ${styles.releaseBtn}" data-action="release">✅ Release</button>
          </td>
        `;

        fragment.appendChild(row);
      });

      body.appendChild(fragment);
    }

    // Update status cells every tick
    Array.from(body.querySelectorAll('tr[data-team]')).forEach(row => {
      const teamName = row.dataset.team;
      const assignment = this.assignments.get(teamName);
      const statusCell = row.querySelector('[data-role="status-cell"]');
      const assignBtn = row.querySelector('button[data-action="assign"]');
      const releaseBtn = row.querySelector('button[data-action="release"]');
      const zoneSelect = row.querySelector('select[data-role="zone-select"]');

      if (!statusCell || !assignBtn || !releaseBtn) return;

      if (!assignment) {
        statusCell.innerHTML = `
          <span class="${styles.statusSubtext}">No tow dispatched.</span>
        `;
        assignBtn.disabled = false;
        releaseBtn.disabled = true;
        if (zoneSelect && !zoneSelect.dataset.changed) {
          zoneSelect.value = '';
          delete zoneSelect.dataset.changed;
        }
        return;
      }

      const status = (assignment.status || 'assigned').toLowerCase();
      const assignedAtMs = assignment.assignedAtMs || Date.now();
      const autoReleaseMs = assignment.autoReleaseAtMs || (assignedAtMs + AUTO_RELEASE_MINUTES * 60_000);
      const remainingMs = Math.max(0, autoReleaseMs - Date.now());

      const countdown = formatCountdown(remainingMs);
      const zoneName = assignment.zoneName || assignment.zoneKey || 'Tow Zone';
      const zoneKey = assignment.zoneKey || '';
      if (zoneSelect && zoneKey) {
        zoneSelect.value = zoneKey;
        delete zoneSelect.dataset.changed;
      }

      let statusLabel = 'Assigned';
      let statusModifier = styles.statusTagAssigned;
      if (status.startsWith('enroute')) {
        statusLabel = 'In Route';
        statusModifier = styles.statusTagEnroute;
      } else if (status.startsWith('cleared')) {
        statusLabel = 'Cleared';
        statusModifier = styles.statusTagCleared;
      }

      const distance = typeof assignment.distanceRemainingKm === 'number'
        ? `<span class="${styles.statusSubtext}">Distance remaining: ${assignment.distanceRemainingKm.toFixed(1)} km</span>`
        : '';

      statusCell.innerHTML = `
        <span class="${styles.statusTag} ${statusModifier}">${escapeHtml(statusLabel)}</span>
        <span class="${styles.statusCountdown}">⏱️ ${countdown}</span>
        <span class="${styles.statusSubtext}">${escapeHtml(zoneName)}</span>
        ${distance}
      `;

      assignBtn.disabled = true;
      releaseBtn.disabled = false;

      if (remainingMs <= 0) {
        this.releaseTeam(teamName).catch(err => {
          console.error('⚠️ Failed to auto-release Flat Tire:', err);
        });
      }
    });
  }
}
