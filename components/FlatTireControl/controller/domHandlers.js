// ============================================================================
// DOM HANDLERS for Flat Tire Control UI
// ============================================================================
import { escapeHtml } from '../../../modules/utils.js';
import styles from '../FlatTireControl.module.css';

export function setupDomRefs(controller) {
  const dom = controller.dom;
  dom.tableBody = document.getElementById('flat-tire-table-body');
  dom.autoIntervalInput = document.getElementById('flat-tire-auto-interval');
  dom.autoToggleBtn = document.getElementById('flat-tire-toggle-auto');

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

  if (forceFullRender || body.children.length !== activeTeams.length) {
    const frag = document.createDocumentFragment();
    body.innerHTML = '';
    activeTeams.forEach(teamName => {
      const row = document.createElement('tr');
      row.dataset.team = teamName;
      row.innerHTML = `
        <td class="${styles.teamCell}"><strong>${escapeHtml(teamName)}</strong></td>
        <td><select class="${styles.zoneSelect}" data-role="zone-select">
          <option value="">Select tow zone…</option>
        </select></td>
        <td class="${styles.statusCell}" data-role="status-cell"></td>
        <td class="${styles.actionsCell}">
          <button class="${styles.actionBtn} ${styles.assignBtn}" data-action="assign">🚨 Send</button>
          <button class="${styles.actionBtn} ${styles.releaseBtn}" data-action="release">✅ Release</button>
        </td>`;
      frag.appendChild(row);
    });
    body.appendChild(frag);
  }
}