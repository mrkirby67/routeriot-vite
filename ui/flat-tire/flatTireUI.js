// === AICP UI HEADER ===
// ============================================================================
// FILE: ui/flat-tire/flatTireUI.js
// PURPOSE: Handles DOM rendering and UI logic for the Flat Tire feature.
// DEPENDS_ON: ../../modules/zonesMap.js, features/flat-tire/flatTireTypes.js, ../../modules/utils.js
// USED_BY: features/flat-tire/flatTireController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP UI HEADER ===

import { generateMiniMap } from '../../modules/zonesMap.js';
import { CAPTURE_RADIUS_METERS } from '../../features/flat-tire/flatTireTypes.js';
import styles from '../../components/FlatTireControl/FlatTireControl.module.css';
import { escapeHtml } from '../../modules/utils.js';

export function setupDomRefs(controller) {
  const dom = controller.dom;
  dom.tableBody = document.getElementById('flat-tire-table-body');
  dom.autoIntervalInput = document.getElementById('flat-tire-auto-interval');
  dom.autoToggleBtn = document.getElementById('flat-tire-toggle-auto');
  dom.randomizeBtn = document.getElementById('ft-randomize-zones-btn');
  dom.refreshZonesBtn = document.getElementById('ft-refresh-zones-btn');
  dom.sendBtn = document.getElementById('flat-tire-send-btn');

  ['north', 'south', 'east', 'west'].forEach(key => {
    dom.zoneInputs.set(key, document.getElementById(`flat-tire-zone-gps-${key}`));
    dom.zoneMaps.set(key, document.getElementById(`flat-tire-zone-map-${key}`));
    dom.zoneDiameterInputs.set(key, document.getElementById(`flat-tire-zone-diameter-${key}`));
    const btn = document.querySelector(`button[data-role="refresh"][data-zone="${key}"]`);
    if (btn) dom.zoneRefreshButtons.set(key, btn);
  });
}

export function renderRows(controller, forceFullRender = false) {
  const { activeTeams, assignments, dom } = controller;
  const body = dom.tableBody;
  if (!body) return;

  if (!activeTeams.length) {
    body.innerHTML = `<tr><td colspan="4" class="${styles.loading}">Waiting for registered teams…</td></tr>`;
    return;
  }

  const zones = controller.config?.zones || {};
  const zoneKeys = Object.keys(zones);
  const hasConfiguredZones = zoneKeys.some(key => zones[key]?.gps);
  const randomizeBtn = controller.dom.randomizeBtn;
  if (randomizeBtn) randomizeBtn.disabled = !(hasConfiguredZones && activeTeams.length);
  const buildOptions = (selectedKey = '') => {
    let html = `<option value="">Select tow zone…</option>`;
    zoneKeys.forEach((key) => {
      const zone = zones[key] || {};
      const label = zone.name || `Zone ${key.toUpperCase()}`;
      const disabled = '';
      const selected = key === selectedKey ? ' selected' : '';
      html += `<option value="${key}"${disabled}${selected}>${escapeHtml(label)}</option>`;
    });
    return html;
  };

  if (forceFullRender || body.children.length !== activeTeams.length) {
    const frag = document.createDocumentFragment();
    body.innerHTML = '';
    activeTeams.forEach(teamName => {
      const assigned = assignments.get(teamName);
      const historyEntry = controller.assignmentHistory?.get(teamName);
      if (assigned?.zoneKey) controller.selectedZones?.set(teamName, assigned.zoneKey);
      const cachedZone = controller.selectedZones?.get(teamName) || '';
      const selectedZone = assigned?.zoneKey || cachedZone || '';
      const row = document.createElement('tr');
      row.dataset.team = teamName;
      row.innerHTML = `
        <td class="${styles.teamCell}"><strong>${escapeHtml(teamName)}</strong></td>
        <td><select class="${styles.zoneSelect}" data-role="zone-select">
          ${buildOptions(selectedZone)}
        </select></td>
        <td class="${styles.statusCell}" data-role="status-cell">${renderStatusCell(assigned)}</td>
        <td class="${styles.actionsCell}" data-role="actions-cell">
          ${renderActionsCell(assigned, historyEntry, hasConfiguredZones)}
        </td>`;
      frag.appendChild(row);
    });
    body.appendChild(frag);
  } else {
    activeTeams.forEach((teamName) => {
      const row = body.querySelector(`tr[data-team="${cssEscape(teamName)}"]`);
      if (!row) return;
      const assigned = assignments.get(teamName);
      const historyEntry = controller.assignmentHistory?.get(teamName);
      if (assigned?.zoneKey) controller.selectedZones?.set(teamName, assigned.zoneKey);
      const select = row.querySelector('select[data-role="zone-select"]');
      if (select) {
        const cachedZone = controller.selectedZones?.get(teamName) || '';
        const selectedZone = assigned?.zoneKey || cachedZone || '';
        select.innerHTML = buildOptions(selectedZone);
        select.value = selectedZone;
      }
      const statusCell = row.querySelector('[data-role="status-cell"]');
      if (statusCell) statusCell.innerHTML = renderStatusCell(assigned);
      const actionsCell = row.querySelector('[data-role="actions-cell"]');
      if (actionsCell) actionsCell.innerHTML = renderActionsCell(assigned, historyEntry, hasConfiguredZones);
    });
  }
}

function renderStatusCell(assignment) {
  if (!assignment) {
    return `<span class="${styles.statusSubtext}">No tow dispatched.</span>`;
  }

  const status = (assignment.status || 'assigned').toLowerCase();
  let modifier = styles.statusTagAssigned;
  let label = 'Assigned';
  if (status.startsWith('enroute')) {
    modifier = styles.statusTagEnroute;
    label = 'In Route';
  } else if (status.startsWith('cleared')) {
    modifier = styles.statusTagCleared;
    label = 'Cleared';
  }

  const autoReleaseAt = assignment.autoReleaseAtMs || assignment.autoReleaseAt?.toMillis?.();
  const countdownMarkup = autoReleaseAt
    ? `<span class="${styles.statusCountdown}">⏱️ ${formatCountdown(autoReleaseAt - Date.now())}</span>` 
    : '';

  const zoneName = assignment.zoneName || assignment.zoneKey || '';
  const subtext = zoneName
    ? `<span class="${styles.statusSubtext}">${escapeHtml(zoneName)}</span>`
    : '';

  return `
    <span class="${styles.statusTag} ${modifier}">${escapeHtml(label)}</span>
    ${countdownMarkup}
    ${subtext}
  `;
}

function renderActionsCell(assignment, historyEntry, hasConfiguredZones) {
  const assignDisabled = Boolean(assignment) || !hasConfiguredZones;
  const releaseDisabled = !assignment;
  return `
    <div class="${styles.actionButtonsRow}">
      <button class="${styles.actionBtn} ${styles.assignBtn}" data-action="assign" ${assignDisabled ? 'disabled' : ''}>🚨 Send</button>
      <button class="${styles.actionBtn} ${styles.releaseBtn}" data-action="release" ${releaseDisabled ? 'disabled' : ''}>✅ Release</button>
    </div>
    ${renderActionMeta(assignment, historyEntry)}
  `;
}

function renderActionMeta(assignment, historyEntry) {
  const source = assignment || historyEntry;
  if (!source) {
    return `<span class="${styles.actionsMeta} ${styles.actionsMetaEmpty}">No flat tire history.</span>`;
  }
  const assignedBy = source.assignedBy || source.fromTeam || 'Game Control';
  const timestamp =
    source.assignedAtMs ??
    source.assignedAt?.toMillis?.() ??
    source.updatedAtMs ??
    null;
  const formatted = formatTimestamp(timestamp);
  const zoneName = source.zoneName || source.zoneKey || '';
  const zoneMarkup = zoneName
    ? `<span>→ ${escapeHtml(zoneName)}</span>`
    : '';
  return `
    <span class="${styles.actionsMeta}">
      Sent by <strong>${escapeHtml(assignedBy)}</strong>
      <span class="${styles.actionsMetaTime}">${escapeHtml(formatted)}</span>
      ${zoneMarkup}
    </span>
  `;
}

function formatTimestamp(value) {
  if (!Number.isFinite(value)) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, '\\$&');
}

function formatCountdown(remainingMs) {
  const safeMs = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function updateZonePreview(zoneKey, config, dom) {
    const mapEl = dom.zoneMaps.get(zoneKey);
    if (!mapEl) return;
    const zone = config?.zones?.[zoneKey];
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

export function generateZoneSignature(zones = {}) {
  const normalized = {};
  Object.entries(zones).forEach(([key, zone]) => {
    const gps = typeof zone?.gps === 'string' ? zone.gps.trim() : '';
    const diameter = Number(zone?.diameterMeters) || Number(zone?.diameter) || 0;
    normalized[key] = { gps, diameter };
  });
  return JSON.stringify(normalized);
}

// === AICP UI FOOTER ===
// ai_origin: ui/flat-tire/flatTireUI.js
// ai_role: Presentation Layer
// aicp_category: ui
// aicp_version: 3.0
// codex_phase: tier4_ui_injection
// export_bridge: components
// exports: setupDomRefs, renderRows, updateZonePreview, generateZoneSignature
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier4_ui_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// === END AICP UI FOOTER ===
