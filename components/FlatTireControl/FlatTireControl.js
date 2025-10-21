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
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  planAssignments,
  pauseAllAssignments,
  resumeAllAssignments,
  cancelAllAssignments
} from '../../modules/flatTireManager.js';
import { listenForGameStatus } from '../../modules/gameStateManager.js';
import { generateMiniMap } from '../../modules/zonesMap.js';

const CONFIG_REF = doc(db, 'game', 'flatTireConfig');
const ASSIGNMENTS_COLLECTION = collection(db, 'flatTireAssignments');

const DIRECTIONS = [
  { key: 'north', label: 'North', emoji: '⬆️' },
  { key: 'east', label: 'East', emoji: '➡️' },
  { key: 'south', label: 'South', emoji: '⬇️' },
  { key: 'west', label: 'West', emoji: '⬅️' },
];

let zonesMap = new Map();
let zoneGroups = { north: [], east: [], south: [], west: [] };
let currentGameState = null;
let lastGameStatus = null;
let gameStatusUnsub = null;
let assignmentsUnsub = null;

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

      <div id="flat-tire-zones" class="${styles.zoneGrid}">
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
  cleanupListeners();

  zonesMap = new Map();
  zoneGroups = { north: [], east: [], south: [], west: [] };
  currentGameState = null;
  lastGameStatus = null;

  const strategySelect = document.getElementById('flat-tire-strategy');
  const flatsInput = document.getElementById('flat-tire-flats');
  const zonesContainer = document.getElementById('flat-tire-zones');
  const planButton = document.getElementById('flat-tire-plan');
  const pauseButton = document.getElementById('flat-tire-pause');
  const resumeButton = document.getElementById('flat-tire-resume');
  const statusLabel = document.getElementById('flat-tire-status');

  if (!strategySelect || !planButton || !zonesContainer) {
    console.warn('⚠️ Flat Tire control not mounted.');
    return;
  }

  try {
    const zoneData = await loadTowZones();
    zonesMap = zoneData.map;
    zoneGroups = zoneData.groups;
    renderZoneTiles(zonesContainer, zoneGroups);

    const config = await loadExistingConfig();
    if (config) {
      strategySelect.value = config.selectionStrategy || 'random';
      if (config.flatsPerTeam) flatsInput.value = config.flatsPerTeam;
      markSelectedZones(zonesContainer, config.towZoneIds || []);
    }

    watchAssignments(zonesMap);
  } catch (err) {
    console.error('⚠️ Failed to initialize Flat Tire control:', err);
    setStatus('❌ Failed to load zones. Check console.', true);
  }

  planButton.addEventListener('click', async () => {
    const towZoneIds = getSelectedZoneIds(zonesContainer);
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
        .filter(Boolean)
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

  gameStatusUnsub = listenForGameStatus((state) => handleGameStateChange(state, { planButton, pauseButton, resumeButton }));
  window.addEventListener('beforeunload', cleanupListeners, { once: true });
}

// ============================================================================
// 📦 Loaders & Helpers
// ============================================================================
async function loadTowZones() {
  const map = new Map();
  const groups = { north: [], east: [], south: [], west: [] };

  try {
    const snap = await getDocs(collection(db, 'zones'));
    if (snap.empty) {
      return { map, groups };
    }

    const zonesWithCoords = [];
    snap.forEach(docSnap => {
      const zoneData = docSnap.data();
      const zoneId = docSnap.id;
      map.set(zoneId, { id: zoneId, data: zoneData });

      const [lat, lng] = parseGps(zoneData.gps);
      if (lat !== null && lng !== null) {
        zonesWithCoords.push({ id: zoneId, data: zoneData, lat, lng });
      }
    });

    const center = computeCenter(zonesWithCoords);
    zonesWithCoords.forEach(zone => {
      const direction = resolveDirection(center, zone);
      groups[direction].push(zone);
    });
  } catch (err) {
    console.error('❌ Unable to load zones:', err);
  }

  return { map, groups };
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
}

function renderZoneTiles(container, groups) {
  if (!container) return;

  container.innerHTML = DIRECTIONS.map(({ key, label, emoji }) => {
    const zones = groups[key] || [];
    const listContent = zones.length
      ? zones.map(zone => `
          <label class="${styles.zoneOption}">
            <input type="checkbox" value="${zone.id}">
            <div>
              <strong>${zone.data.name || zone.id}</strong>
              <span>ID: ${zone.id}</span>
              ${renderMiniMap(zone)}
            </div>
          </label>
        `).join('')
      : `<p class="${styles.emptyState}">⚠️ Zones not initialized.</p>`;

    return `
      <div class="${styles.zoneTile}" data-direction="${key}">
        <div class="${styles.zoneHeading}">
          <span>${emoji} ${label}</span>
          <span class="${styles.zoneCount}">${zones.length}</span>
        </div>
        <div class="${styles.zoneList}">
          ${listContent}
        </div>
      </div>
    `;
  }).join('');
}

function renderMiniMap(zone) {
  try {
    return generateMiniMap({ ...(zone.data || {}), name: zone.data?.name });
  } catch {
    return '';
  }
}

function markSelectedZones(container, ids) {
  const set = new Set(ids);
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = set.has(cb.value);
  });
}

function getSelectedZoneIds(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => cb.value);
}

function parseGps(raw) {
  if (!raw || typeof raw !== 'string') return [null, null];
  const [latStr, lngStr] = raw.split(',').map(part => part.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return [null, null];
  return [lat, lng];
}

function computeCenter(zones) {
  if (!zones.length) return { lat: 0, lng: 0 };
  const avg = zones.reduce((acc, zone) => {
    acc.lat += zone.lat;
    acc.lng += zone.lng;
    return acc;
  }, { lat: 0, lng: 0 });
  return {
    lat: avg.lat / zones.length,
    lng: avg.lng / zones.length
  };
}

function resolveDirection(center, zone) {
  const latDelta = zone.lat - center.lat;
  const lngDelta = zone.lng - center.lng;
  if (latDelta === 0 && lngDelta === 0) return 'north';

  const angle = (Math.atan2(latDelta, lngDelta) * 180) / Math.PI;
  const normalized = (angle + 360) % 360;

  if (normalized >= 45 && normalized < 135) return 'north';
  if (normalized >= 135 && normalized < 225) return 'west';
  if (normalized >= 225 && normalized < 315) return 'south';
  return 'east';
}

// ============================================================================
// 🕒 Game State Integration
// ============================================================================
function handleGameStateChange(state, controls) {
  currentGameState = state;
  updateCountdown(state);
  updateControlStates(state, controls);

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
    label.textContent = state?.status === 'paused' ? 'PAUSED' : '--:--:--';
    return;
  }

  const remaining = Math.max(windowFrame.endMs - Date.now(), 0);
  label.textContent = remaining > 0 ? formatDuration(remaining) : 'LIVE';
}

function updateControlStates(state, controls) {
  const planButton = controls.planButton;
  const pauseButton = controls.pauseButton;
  const resumeButton = controls.resumeButton;
  const zonesAvailable = zonesMap.size > 0;

  const gameActive = state?.status === 'active';
  if (planButton) planButton.disabled = !gameActive || !zonesAvailable;
  if (pauseButton) pauseButton.disabled = !gameActive;
  if (resumeButton) resumeButton.disabled = !gameActive;

  if (!zonesAvailable) {
    setStatus('⚠️ Zones not initialized.', true);
  } else if (!gameActive) {
    setStatus('⚠️ Game not active.', true);
  } else {
    setStatus('');
  }
}

function cleanupListeners() {
  gameStatusUnsub?.();
  assignmentsUnsub?.();
  gameStatusUnsub = null;
  assignmentsUnsub = null;
  lastGameStatus = null;
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
