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
      const disabled = zone.gps ? '' : ' disabled';
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
        <td class="${styles.actionsCell}">
          <button class="${styles.actionBtn} ${styles.assignBtn}" data-action="assign" ${assigned || !hasConfiguredZones ? 'disabled' : ''}>🚨 Send</button>
          <button class="${styles.actionBtn} ${styles.releaseBtn}" data-action="release" ${assigned ? '' : 'disabled'}>✅ Release</button>
        </td>`;
      frag.appendChild(row);
    });
    body.appendChild(frag);
  } else {
    activeTeams.forEach((teamName) => {
      const row = body.querySelector(`tr[data-team="${cssEscape(teamName)}"]`);
      if (!row) return;
      const assigned = assignments.get(teamName);
      if (assigned?.zoneKey) controller.selectedZones?.set(teamName, assigned.zoneKey);
      const select = row.querySelector('select[data-role="zone-select"]');
      if (select) {
        const cachedZone = controller.selectedZones?.get(teamName) || '';
        const selectedZone = assigned?.zoneKey || cachedZone || '';
        select.innerHTML = buildOptions(selectedZone);
      }
      const statusCell = row.querySelector('[data-role="status-cell"]');
      if (statusCell) statusCell.innerHTML = renderStatusCell(assigned);
      const assignBtn = row.querySelector('button[data-action="assign"]');
      if (assignBtn) assignBtn.disabled = Boolean(assigned) || !hasConfiguredZones;
      const releaseBtn = row.querySelector('button[data-action="release"]');
      if (releaseBtn) releaseBtn.disabled = !assigned;
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
// export_bridge: components/*
// exports: setupDomRefs, renderRows, updateZonePreview, generateZoneSignature
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier4_ui_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// === END AICP UI FOOTER ===
