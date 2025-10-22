// ============================================================================
// FILE: components/FlatTireControl/FlatTireControl.js
// PURPOSE: Control dashboard panel for planning Flat Tire tow assignments
// ============================================================================

import styles from './FlatTireControl.module.css';
import { allTeams } from '../../data.js';
import { db } from '../../modules/config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  planAssignments,
  pauseAllAssignments,
  resumeAllAssignments,
  cancelAllAssignments
} from '../../modules/flatTireManager.js';
import { listenForGameStatus } from '../../modules/gameStateManager.js';
import { generateMiniMap, calculateZoomFromDiameter } from '../../modules/zonesMap.js';

const CONFIG_REF = doc(db, 'game', 'flatTireConfig');
const ASSIGNMENTS_COLLECTION = collection(db, 'flatTireAssignments');

let zonesMap = new Map();
let zonesList = [];
let selectedTowZones = new Set();
let isSelectingZones = false;
let currentGameState = null;
let lastGameStatus = null;
let gameStatusUnsub = null;
let assignmentsUnsub = null;
let unloadHandler = null;
let countdownFrame = null;
let countdownTargetMs = null;
let selectionSaveTimeout = null;

const selectionState = {
  selectButton: null,
  countLabel: null,
  mapContainer: null
};

let controlButtons = {
  planButton: null,
  pauseButton: null,
  resumeButton: null
};

// ============================================================================
// 🧱 COMPONENT MARKUP
// ============================================================================
export function FlatTireControlComponent() {
  return `
    <div class="${styles.controlSection}">
      <div class="${styles.headerRow}">
        <h2>Flat Tire — Tow Time</h2>
        <div class="${styles.countdownWrapper}">
          <span class="${styles.countdownLabel}">Game Window:</span>
          <span id="flat-tire-countdown" class="${styles.countdownValue}">--:--:--</span>
        </div>
      </div>

      <div class="${styles.settingsRow}">
        <label class="${styles.field}">
          <span>Flats per Team</span>
          <input id="flat-tire-flats" type="number" min="1" value="1">
        </label>

        <label class="${styles.field}">
          <span>Selection Strategy</span>
          <select id="flat-tire-strategy">
            <option value="random">Random Teams</option>
            <option value="farthest-from-last-zone">Farthest from Last Zone</option>
          </select>
        </label>
      </div>

      <div class="${styles.selectionToolbar}">
        <button id="flat-tire-select" type="button" class="${styles.secondaryBtn}">
          🗺️ Select Zones
        </button>
        <span id="flat-tire-selected-count" class="${styles.selectionMeta}">No zones selected</span>
      </div>

      <div id="flat-tire-map-region" class="${styles.mapRegion}">
        <div class="${styles.loading}">Loading zones…</div>
      </div>

      <div class="${styles.actions}">
        <button id="flat-tire-plan" class="${styles.primaryBtn}">📅 Plan Assignments</button>
        <button id="flat-tire-pause" class="${styles.secondaryBtn}">⏸️ Pause Flats</button>
        <button id="flat-tire-resume" class="${styles.secondaryBtn}">▶️ Resume Flats</button>
        <span id="flat-tire-status" class="${styles.statusMsg}"></span>
      </div>

      <div class="${styles.tableWrapper}">
        <h3>Scheduled Flats</h3>
        <table class="${styles.dataTable}">
          <thead>
            <tr>
              <th>Team</th>
              <th>Tow Zone</th>
              <th>Reveals At</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="flat-tire-rows">
            <tr><td colspan="5" class="${styles.loading}">No assignments planned yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================================================
// 🚀 INITIALIZER
// ============================================================================
export async function initializeFlatTireControl() {
  cleanupListeners('reinitialize');

  zonesMap = new Map();
  zonesList = [];
  selectedTowZones = new Set();
  isSelectingZones = false;
  currentGameState = null;
  lastGameStatus = null;
  if (selectionSaveTimeout) {
    clearTimeout(selectionSaveTimeout);
    selectionSaveTimeout = null;
  }

  const strategySelect = document.getElementById('flat-tire-strategy');
  const flatsInput = document.getElementById('flat-tire-flats');
  const mapContainer = document.getElementById('flat-tire-map-region');
  const planButton = document.getElementById('flat-tire-plan');
  const pauseButton = document.getElementById('flat-tire-pause');
  const resumeButton = document.getElementById('flat-tire-resume');
  const selectButton = document.getElementById('flat-tire-select');
  const selectedCountLabel = document.getElementById('flat-tire-selected-count');

  if (!strategySelect || !planButton || !mapContainer || !selectButton || !selectedCountLabel) {
    console.warn('⚠️ Flat Tire control not mounted.');
    return () => cleanupListeners('missing-dom');
  }

  selectionState.selectButton?.removeEventListener('click', onSelectButtonClick);
  selectionState.mapContainer?.removeEventListener('click', handleZoneSelection);
  selectionState.selectButton = selectButton;
  selectionState.countLabel = selectedCountLabel;
  selectionState.mapContainer = mapContainer;
  selectButton.addEventListener('click', onSelectButtonClick);
  mapContainer.addEventListener('click', handleZoneSelection);

  controlButtons = { planButton, pauseButton, resumeButton };
  toggleSelectionMode(false);
  updateSelectionMeta();

  try {
    const zoneData = await loadTowZones();
    zonesMap = zoneData.map;
    zonesList = zoneData.list;
    renderTowMap();
    updateControlStates(currentGameState);

    const config = await loadExistingConfig();
    if (config) {
      strategySelect.value = config.selectionStrategy || 'random';
      if (config.flatsPerTeam) flatsInput.value = config.flatsPerTeam;
      applySavedSelection(config.towZoneIds || []);
    }

    watchAssignments(zonesMap);
  } catch (err) {
    console.error('⚠️ Failed to initialize Flat Tire control:', err);
    setStatus('❌ Failed to load zones. Check console.', true);
  }

  planButton.addEventListener('click', async () => {
    const towZoneIds = Array.from(selectedTowZones).filter(id => zonesMap.get(id)?.isSelectable);
    if (!towZoneIds.length) {
      setStatus('⚠️ Select at least one tow zone.', true);
      return;
    }

    const flatsPerTeam = Math.max(1, Number(flatsInput.value) || 1);
    const strategy = strategySelect.value;
    const windowFrame = computeGameWindow(currentGameState);

    if (!windowFrame) {
      setStatus('⚠️ Game not active. Unable to schedule.', true);
      return;
    }

    planButton.disabled = true;
    setStatus('Planning assignments…');

    try {
      await saveConfig({
        selectionStrategy: strategy,
        flatsPerTeam,
        towZoneIds
      });

      const towZones = towZoneIds
        .map(id => zonesMap.get(id))
        .filter(zone => zone?.isSelectable)
        .map(zone => ({ id: zone.id, data: zone.data }));

      await planAssignments({
        teams: allTeams.map(t => t.name),
        towZones,
        strategy,
        flatsPerTeam,
        windowStartMs: windowFrame.startMs,
        windowEndMs: windowFrame.endMs
      });

      setStatus('✅ Flat Tire assignments scheduled.');
    } catch (err) {
      console.error('❌ Failed to plan assignments:', err);
      setStatus(`❌ ${err.message || 'Could not schedule assignments.'}`, true);
    } finally {
      planButton.disabled = false;
    }
  });

  pauseButton.addEventListener('click', async () => {
    try {
      await pauseAllAssignments();
      setStatus('⏸️ Flat Tire assignments paused.');
    } catch (err) {
      console.error('❌ Failed to pause assignments:', err);
      setStatus('❌ Failed to pause assignments.', true);
    }
  });

  resumeButton.addEventListener('click', async () => {
    try {
      await resumeAllAssignments();
      setStatus('▶️ Flat Tire assignments resumed.');
    } catch (err) {
      console.error('❌ Failed to resume assignments:', err);
      setStatus('❌ Failed to resume assignments.', true);
    }
  });

  gameStatusUnsub = listenForGameStatus((state) => handleGameStateChange(state));

  if (unloadHandler) {
    window.removeEventListener('beforeunload', unloadHandler);
  }
  unloadHandler = () => cleanupListeners('page-unload');
  window.addEventListener('beforeunload', unloadHandler, { once: true });

  console.info('✅ [flatTireControl] initialization complete');
  return (reason = 'control-cleanup') => cleanupListeners(reason);
}

// ============================================================================
// 📦 Loaders & Helpers
// ============================================================================
async function loadTowZones() {
  const map = new Map();
  const list = [];

  try {
    const snap = await getDocs(collection(db, 'zones'));
    if (snap.empty) {
      return { map, list };
    }

    snap.forEach(docSnap => {
      const zoneData = docSnap.data();
      const zoneId = docSnap.id;
      const [lat, lng] = parseGps(zoneData.gps);
      const isSelectable = lat !== null && lng !== null;
      const diameterKm = parseFloat(zoneData?.diameter) || 0.05;
      const zoom = calculateZoomFromDiameter(diameterKm);
      const radiusMeters = Math.round(Math.max((diameterKm / 2) * 1000, 20));

      const zoneEntry = {
        id: zoneId,
        data: zoneData,
        lat,
        lng,
        zoom,
        radiusMeters,
        isSelectable
      };

      map.set(zoneId, zoneEntry);
      list.push(zoneEntry);
    });

    list.sort((a, b) => {
      if (a.isSelectable !== b.isSelectable) {
        return a.isSelectable ? -1 : 1;
      }
      const nameA = (a.data?.name || a.id || '').toLowerCase();
      const nameB = (b.data?.name || b.id || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } catch (err) {
    console.error('❌ Unable to load zones:', err);
  }

  return { map, list };
}

async function loadExistingConfig() {
  try {
    const snap = await getDoc(CONFIG_REF);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.error('⚠️ Failed to load flat tire config:', err);
  }
  return null;
}

async function saveConfig(config) {
  await setDoc(CONFIG_REF, {
    selectionStrategy: config.selectionStrategy,
    flatsPerTeam: config.flatsPerTeam,
    towZoneIds: config.towZoneIds,
    plannedAt: serverTimestamp()
  }, { merge: true });
}

async function saveTowZones(towZoneIds) {
  await setDoc(CONFIG_REF, {
    towZoneIds,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function watchAssignments(zonesMapRef) {
  const tbody = document.getElementById('flat-tire-rows');
  if (!tbody) return;

  assignmentsUnsub?.();
  assignmentsUnsub = onSnapshot(ASSIGNMENTS_COLLECTION, (snapshot) => {
    const rows = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const zone = zonesMapRef.get(data.towZoneId);
      rows.push({
        team: docSnap.id,
        towZone: zone?.data?.name || data.towZoneId,
        revealedAt: data.revealedAt,
        dueBy: data.dueBy,
        status: data.status || 'scheduled'
      });
    });

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="${styles.loading}">No assignments planned yet.</td></tr>`;
      return;
    }

    rows.sort((a, b) => a.team.localeCompare(b.team));

    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${row.team}</td>
        <td>${row.towZone}</td>
        <td>${formatTimestamp(row.revealedAt)}</td>
        <td>${formatTimestamp(row.dueBy)}</td>
        <td class="${styles.statusCell}">${row.status}</td>
      </tr>
    `).join('');
  }, (err) => {
    console.error('⚠️ Failed to listen for assignments:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="${styles.loading}">Failed to load assignments.</td></tr>`;
  });
  console.info('📡 [flatTireControl] attached assignments listener');
}

function renderTowMap() {
  const container = selectionState.mapContainer;
  if (!container) return;

  container.innerHTML = '';

  if (!zonesList.length) {
    const empty = document.createElement('div');
    empty.className = styles.emptyState;
    empty.textContent = '⚠️ Zones not initialized.';
    container.appendChild(empty);
    updateControlStates(currentGameState);
    return;
  }

  const grid = document.createElement('div');
  grid.className = styles.zoneMapGrid;

  zonesList.forEach(zone => {
    const selected = selectedTowZones.has(zone.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.zoneId = zone.id;
    button.setAttribute('aria-pressed', String(selected));

    const classes = [styles.zoneOption];
    if (selected) classes.push(styles.zoneOptionSelected);
    if (isSelectingZones) classes.push(styles.zoneOptionSelectable);
    if (!zone.isSelectable) classes.push(styles.zoneOptionDisabled);
    button.className = classes.filter(Boolean).join(' ');

    if (!zone.isSelectable) {
      button.disabled = true;
    }

    const mapPreview = document.createElement('div');
    mapPreview.className = styles.zoneMapPreview;
    mapPreview.innerHTML = safeMiniMap(zone);

    const badge = document.createElement('span');
    badge.className = styles.zoneBadge;
    badge.textContent = zone.isSelectable
      ? (selected ? 'Selected' : 'Available')
      : 'Needs GPS';
    mapPreview.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = styles.zoneMeta;

    const title = document.createElement('strong');
    title.textContent = zone.data?.name || zone.id;
    meta.appendChild(title);

    const idLabel = document.createElement('span');
    idLabel.className = styles.zoneIdLabel;
    idLabel.textContent = zone.id;
    meta.appendChild(idLabel);

    const gpsLabel = document.createElement('span');
    gpsLabel.className = styles.zoneGps;
    gpsLabel.textContent = zone.data?.gps || 'GPS missing';
    meta.appendChild(gpsLabel);

    if (zone.isSelectable && Number.isFinite(zone.radiusMeters)) {
      const radiusLabel = document.createElement('span');
      radiusLabel.className = styles.zoneRadius;
      radiusLabel.textContent = `≈ ${zone.radiusMeters}m radius`;
      meta.appendChild(radiusLabel);
    }

    button.appendChild(mapPreview);
    button.appendChild(meta);
    grid.appendChild(button);
  });

  container.appendChild(grid);
  updateSelectionMeta();
  updateControlStates(currentGameState);
}

function safeMiniMap(zone) {
  try {
    return generateMiniMap({ ...(zone.data || {}), name: zone.data?.name });
  } catch {
    return '<div style="height:150px;background:#111;border-radius:10px;"></div>';
  }
}

function applySavedSelection(ids = []) {
  const filtered = Array.isArray(ids)
    ? ids.filter(id => zonesMap.get(id)?.isSelectable)
    : [];
  selectedTowZones = new Set(filtered);

  if (!selectionState.mapContainer) {
    updateSelectionMeta();
    updateControlStates(currentGameState);
    return;
  }

  selectionState.mapContainer
    .querySelectorAll('button[data-zone-id]')
    .forEach(button => {
      const zoneId = button.dataset.zoneId;
      const isSelected = selectedTowZones.has(zoneId) && !button.disabled;
      toggleZoneVisualState(button, isSelected);
    });

  updateSelectionMeta();
  updateControlStates(currentGameState);
}

function parseGps(raw) {
  if (!raw || typeof raw !== 'string') return [null, null];
  const [latStr, lngStr] = raw.split(',').map(part => part.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return [null, null];
  return [lat, lng];
}

// ============================================================================
// 🕒 Game State Integration
// ============================================================================
function handleGameStateChange(state) {
  currentGameState = state;
  updateCountdown(state);
  updateControlStates(state);

  if (!lastGameStatus) {
    lastGameStatus = state.status;
    return;
  }

  if (state.status === 'paused' && lastGameStatus !== 'paused') {
    pauseAllAssignments().catch(err => console.error('❌ Flat Tire pause sync failed:', err));
    setStatus('⏸️ Game paused. Flats paused automatically.');
  }

  if (state.status === 'active' && lastGameStatus === 'paused') {
    resumeAllAssignments().catch(err => console.error('❌ Flat Tire resume sync failed:', err));
    setStatus('▶️ Game resumed. Flats back on schedule.');
  }

  if (['finished', 'ended'].includes(state.status) && !['finished', 'ended'].includes(lastGameStatus)) {
    cancelAllAssignments().catch(err => console.error('❌ Flat Tire cancel sync failed:', err));
    setStatus('🏁 Game ended. Flats cancelled.');
  }

  lastGameStatus = state.status;
}

function computeGameWindow(state) {
  if (!state || state.status !== 'active') return null;

  const startMs = state.startTime?.toMillis
    ? state.startTime.toMillis()
    : (state.startTime instanceof Date ? state.startTime.getTime() : null);

  let endMs = null;
  if (state.endTime?.toMillis) endMs = state.endTime.toMillis();
  else if (state.endTime instanceof Date) endMs = state.endTime.getTime();
  else if (typeof state.remainingMs === 'number') endMs = Date.now() + state.remainingMs;
  else if (startMs && state.durationMinutes) endMs = startMs + state.durationMinutes * 60_000;

  if (!startMs || !endMs || endMs <= startMs) return null;
  return { startMs, endMs };
}

function updateCountdown(state) {
  const label = document.getElementById('flat-tire-countdown');
  if (!label) return;

  const windowFrame = computeGameWindow(state);
  if (!state || !windowFrame) {
    cancelCountdownLoop();
    label.textContent = state?.status === 'paused' ? 'PAUSED' : '--:--:--';
    return;
  }

  if (!countdownTargetMs || Math.abs(countdownTargetMs - windowFrame.endMs) > 1000) {
    startCountdownLoop(windowFrame.endMs);
  }
}

function updateControlStates(state) {
  const planButton = controlButtons.planButton;
  const pauseButton = controlButtons.pauseButton;
  const resumeButton = controlButtons.resumeButton;

  const zonesAvailable = zonesList.length > 0;
  const hasSelection = selectedTowZones.size > 0;
  const gameActive = state?.status === 'active';

  if (planButton) planButton.disabled = !gameActive || !zonesAvailable || !hasSelection;
  if (pauseButton) pauseButton.disabled = !gameActive;
  if (resumeButton) resumeButton.disabled = !gameActive;

  if (!zonesAvailable) {
    setStatus('⚠️ Zones not initialized.', true);
  } else if (!hasSelection) {
    setStatus('⚠️ Select at least one tow zone.', true);
  } else if (!gameActive) {
    setStatus('⚠️ Game not active.', true);
  } else {
    setStatus('');
  }
}

function startCountdownLoop(endMs) {
  cancelCountdownLoop();
  countdownTargetMs = endMs;
  const step = () => {
    if (!countdownTargetMs) return;
    const label = document.getElementById('flat-tire-countdown');
    if (!label) return;

    const remaining = countdownTargetMs - Date.now();
    if (remaining <= 0) {
      label.textContent = 'LIVE';
      cancelCountdownLoop();
      return;
    }

    label.textContent = formatDuration(remaining);
    countdownFrame = requestAnimationFrame(step);
  };
  countdownFrame = requestAnimationFrame(step);
}

function cancelCountdownLoop() {
  if (countdownFrame) {
    cancelAnimationFrame(countdownFrame);
    countdownFrame = null;
  }
  countdownTargetMs = null;
}

function cleanupListeners(reason = 'manual') {
  if (gameStatusUnsub) {
    try {
      gameStatusUnsub();
      console.info(`🧹 [flatTireControl] detached game status listener (${reason})`);
    } catch (err) {
      console.warn('⚠️ Failed to detach game status listener:', err);
    }
  }
  if (assignmentsUnsub) {
    try {
      assignmentsUnsub();
      console.info(`🧹 [flatTireControl] detached assignments listener (${reason})`);
    } catch (err) {
      console.warn('⚠️ Failed to detach assignments listener:', err);
    }
  }
  gameStatusUnsub = null;
  assignmentsUnsub = null;
  lastGameStatus = null;

  if (selectionSaveTimeout) {
    clearTimeout(selectionSaveTimeout);
    selectionSaveTimeout = null;
  }

  if (selectionState.selectButton) {
    selectionState.selectButton.removeEventListener('click', onSelectButtonClick);
  }
  if (selectionState.mapContainer) {
    selectionState.mapContainer.removeEventListener('click', handleZoneSelection);
  }
  selectionState.selectButton = null;
  selectionState.countLabel = null;
  selectionState.mapContainer = null;

  if (unloadHandler) {
    window.removeEventListener('beforeunload', unloadHandler);
    unloadHandler = null;
  }

  controlButtons = { planButton: null, pauseButton: null, resumeButton: null };
  cancelCountdownLoop();
}

// ============================================================================
// 🧰 Utility Helpers
// ============================================================================
function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  } catch {
    return '—';
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = num => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function setStatus(message, isWarning = false) {
  const label = document.getElementById('flat-tire-status');
  if (!label) return;
  label.textContent = message;
  label.style.color = isWarning ? '#ff7043' : '#ffcc80';
}

function updateSelectionMeta() {
  const label = selectionState.countLabel;
  if (!label) return;

  const count = selectedTowZones.size;
  label.textContent = count === 0
    ? 'No zones selected'
    : `${count} zone${count === 1 ? '' : 's'} selected`;
}

function toggleZoneVisualState(button, isSelected) {
  const selectable = !button.disabled;
  const badge = button.querySelector(`.${styles.zoneBadge}`);

  button.classList.toggle(styles.zoneOptionSelected, selectable && isSelected);
  button.setAttribute('aria-pressed', String(selectable && isSelected));

  if (badge) {
    if (!selectable) {
      badge.textContent = 'Needs GPS';
    } else {
      badge.textContent = isSelected ? 'Selected' : 'Available';
    }
  }
}

function toggleSelectionMode(active) {
  isSelectingZones = !!active;

  const button = selectionState.selectButton;
  const container = selectionState.mapContainer;
  if (button) {
    button.classList.toggle(styles.modeActive, isSelectingZones);
    button.setAttribute('aria-pressed', String(isSelectingZones));
    button.textContent = isSelectingZones ? '✅ Done Selecting' : '🗺️ Select Zones';
  }
  if (container) {
    container.classList.toggle(styles.selectionActive, isSelectingZones);
    container.querySelectorAll('button[data-zone-id]').forEach(btn => {
      btn.classList.toggle(styles.zoneOptionSelectable, isSelectingZones && !btn.disabled);
    });
  }
}

function scheduleTowZoneSave() {
  if (selectionSaveTimeout) {
    clearTimeout(selectionSaveTimeout);
  }
  const ids = Array.from(selectedTowZones);
  selectionSaveTimeout = setTimeout(() => {
    saveTowZones(ids).catch(err => console.error('⚠️ Failed to save tow zones selection:', err));
  }, 350);
}

// ============================================================================
// 🎛️ Event Handlers
// ============================================================================
function onSelectButtonClick() {
  toggleSelectionMode(!isSelectingZones);
}

function handleZoneSelection(event) {
  const button = event.target.closest('button[data-zone-id]');
  if (!button) return;

  if (button.disabled) {
    setStatus('⚠️ This zone is missing GPS coordinates.', true);
    return;
  }

  if (!isSelectingZones) {
    setStatus('Tap “Select Zones” to edit tow circles.', true);
    return;
  }

  const zoneId = button.dataset.zoneId;
  if (!zonesMap.has(zoneId)) return;

  const wasSelected = selectedTowZones.has(zoneId);
  if (wasSelected) {
    selectedTowZones.delete(zoneId);
  } else {
    selectedTowZones.add(zoneId);
  }

  toggleZoneVisualState(button, !wasSelected);
  updateSelectionMeta();
  updateControlStates(currentGameState);
  scheduleTowZoneSave();
}
