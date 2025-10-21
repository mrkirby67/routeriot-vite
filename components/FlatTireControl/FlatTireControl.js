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
  Timestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { planAssignments } from '../../modules/flatTireManager.js';

const CONFIG_REF = doc(db, 'game', 'flatTireConfig');
const ASSIGNMENTS_COLLECTION = collection(db, 'flatTireAssignments');

// ============================================================================
// 🧱 COMPONENT MARKUP
// ============================================================================
export function FlatTireControlComponent() {
  return `
    <div class="${styles.controlSection}">
      <div class="${styles.headerRow}">
        <h2>Flat Tire — Tow Time</h2>
        <div>
          <span class="${styles.countdownLabel}">Next window:</span>
          <span id="flat-tire-countdown" class="${styles.countdownValue}">--:--:--</span>
        </div>
      </div>

      <div class="${styles.settingsGrid}">
        <label class="${styles.field}">
          <span>Selection Strategy</span>
          <select id="flat-tire-strategy">
            <option value="random">Random Teams</option>
            <option value="farthest-from-last-zone">Farthest from Last Zone</option>
          </select>
        </label>

        <label class="${styles.field}">
          <span>Max Flats (per window)</span>
          <input id="flat-tire-max" type="number" min="1" max="${allTeams.length}" value="4">
        </label>

        <label class="${styles.field}">
          <span>Window Start</span>
          <input id="flat-tire-start" type="datetime-local">
        </label>

        <label class="${styles.field}">
          <span>Window End</span>
          <input id="flat-tire-end" type="datetime-local">
        </label>
      </div>

      <div class="${styles.towZones}">
        <h3>Tow Zones</h3>
        <div id="flat-tire-zones" class="${styles.zonesList}">
          <div class="${styles.loading}">Loading zones…</div>
        </div>
      </div>

      <div class="${styles.actions}">
        <button id="flat-tire-plan" class="${styles.primaryBtn}">
          📅 Plan Assignments
        </button>
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
  const strategySelect = document.getElementById('flat-tire-strategy');
  const maxInput = document.getElementById('flat-tire-max');
  const startInput = document.getElementById('flat-tire-start');
  const endInput = document.getElementById('flat-tire-end');
  const zonesContainer = document.getElementById('flat-tire-zones');
  const planButton = document.getElementById('flat-tire-plan');
  const statusLabel = document.getElementById('flat-tire-status');

  if (!strategySelect || !planButton || !zonesContainer) {
    console.warn('⚠️ Flat Tire control not mounted.');
    return;
  }

  // Populate zones list
  const zonesMap = await loadTowZones(zonesContainer);

  // Hydrate existing config if present
  const config = await loadExistingConfig();
  if (config) {
    strategySelect.value = config.selectionStrategy || 'random';
    maxInput.value = config.maxEvents || config.maxFlats || 4;
    setDateInput(startInput, config.windowStart);
    setDateInput(endInput, config.windowEnd);
    markSelectedZones(zonesContainer, config.towZoneIds || []);
  }

  // Countdown ticker
  startCountdownTicker(config?.windowStart || null);

  // Live assignment table
  watchAssignments(zonesMap);

  // Plan button handler
  planButton.addEventListener('click', async () => {
    statusLabel.textContent = '';

    const selectionStrategy = strategySelect.value;
    const maxEvents = Number(maxInput.value) || 1;
    const windowStart = parseDateInput(startInput.value);
    const windowEnd = parseDateInput(endInput.value);
    const towZoneIds = getSelectedZoneIds(zonesContainer);

    if (!windowStart || !windowEnd) {
      statusLabel.textContent = '⚠️ Provide both start and end date/time.';
      return;
    }
    if (windowEnd <= windowStart) {
      statusLabel.textContent = '⚠️ Window end must be after start.';
      return;
    }
    if (!towZoneIds.length) {
      statusLabel.textContent = '⚠️ Select at least one tow zone.';
      return;
    }

    planButton.disabled = true;
    planButton.textContent = 'Planning…';

    try {
      await saveConfig({
        selectionStrategy,
        maxEvents,
        windowStart,
        windowEnd,
        towZoneIds
      });

      const towZones = towZoneIds
        .map(id => zonesMap.get(id))
        .filter(Boolean)
        .map(zone => ({ id: zone.id, data: zone.data }));

      await planAssignments({
        teams: allTeams.map(t => t.name),
        towZones,
        strategy: selectionStrategy,
        maxEvents,
        windowStart,
        windowEnd
      });

      statusLabel.textContent = '✅ Flat Tire assignments scheduled.';
      startCountdownTicker(windowStart);
    } catch (err) {
      console.error('❌ Failed to plan assignments:', err);
      statusLabel.textContent = `❌ ${err.message || 'Could not schedule assignments.'}`;
    } finally {
      planButton.disabled = false;
      planButton.textContent = '📅 Plan Assignments';
    }
  });
}

// ============================================================================
// 📦 Loaders & Helpers
// ============================================================================
async function loadTowZones(container) {
  const map = new Map();
  try {
    const snap = await getDocs(collection(db, 'zones'));
    if (snap.empty) {
      container.innerHTML = `<p class="${styles.emptyState}">No zones found. Add tow zones first.</p>`;
      return map;
    }

    container.innerHTML = '';
    snap.forEach(docSnap => {
      const zoneData = docSnap.data();
      const zoneId = docSnap.id;
      map.set(zoneId, { id: zoneId, data: zoneData });

      const label = document.createElement('label');
      label.className = styles.zoneOption;
      label.innerHTML = `
        <input type="checkbox" value="${zoneId}">
        <div>
          <strong>${zoneData.name || 'Unnamed Zone'}</strong>
          <span>ID: ${zoneId}</span>
        </div>
      `;
      container.appendChild(label);
    });
  } catch (err) {
    console.error('❌ Unable to load zones:', err);
    container.innerHTML = `<p class="${styles.emptyState}">Failed to load zones. Check console.</p>`;
  }
  return map;
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
    maxEvents: config.maxEvents,
    windowStart: Timestamp.fromDate(new Date(config.windowStart)),
    windowEnd: Timestamp.fromDate(new Date(config.windowEnd)),
    towZoneIds: config.towZoneIds,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function setDateInput(input, value) {
  if (!input || !value) return;
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    const pad = num => String(num).padStart(2, '0');
    const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    input.value = iso;
  } catch (err) {
    console.warn('⚠️ Could not hydrate datetime value:', err);
  }
}

function parseDateInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function getSelectedZoneIds(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => cb.value);
}

function markSelectedZones(container, ids) {
  const set = new Set(ids);
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = set.has(cb.value);
  });
}

function startCountdownTicker(windowStart) {
  const label = document.getElementById('flat-tire-countdown');
  if (!label) return;

  if (windowStartTicker.interval) {
    clearInterval(windowStartTicker.interval);
    windowStartTicker.interval = null;
  }

  if (!windowStart) {
    label.textContent = '--:--:--';
    return;
  }

  const startMillis = windowStart?.toDate
    ? windowStart.toDate().getTime()
    : new Date(windowStart).getTime();

  if (!startMillis || Number.isNaN(startMillis)) {
    label.textContent = '--:--:--';
    return;
  }

  const updateCountdown = () => {
    const diff = startMillis - Date.now();
    if (diff <= 0) {
      label.textContent = 'LIVE';
      clearInterval(windowStartTicker.interval);
      windowStartTicker.interval = null;
      return;
    }
    label.textContent = formatDuration(diff);
  };

  updateCountdown();
  windowStartTicker.interval = setInterval(updateCountdown, 1000);
}

const windowStartTicker = { interval: null };

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = num => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function watchAssignments(zonesMap) {
  const tbody = document.getElementById('flat-tire-rows');
  if (!tbody) return;

  onSnapshot(ASSIGNMENTS_COLLECTION, (snapshot) => {
    const rows = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const zone = zonesMap.get(data.towZoneId);
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
