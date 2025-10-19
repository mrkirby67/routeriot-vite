// ============================================================================
// File: components/ZoneManagement/zoneUI.js
// Purpose: Static markup for the Zone Management section (Control page)
// ============================================================================

import styles from './ZoneManagement.module.css';

export function ZoneManagementComponent() {
  const controlSection = styles?.controlSection || '';
  const dataTable = styles?.dataTable || '';
  const cooldownSetup = styles?.cooldownSetup || '';

  return `
    <div class="${controlSection}">
      <h2>Zone Management</h2>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <button id="add-zone-btn"
          style="background:#00897B;color:white;padding:8px 16px;
                 border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
          ➕ Add Zone
        </button>

        <button id="refresh-zones-btn"
          style="background:#3949AB;color:white;padding:8px 16px;
                 border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
          🔄 Refresh
        </button>
      </div>

      <div id="zone-status-banner"
        style="padding:10px;margin-bottom:10px;border-radius:6px;text-align:center;
               background:#333;color:#bbb;font-weight:bold;display:none;">
      </div>

      <div class="${cooldownSetup}">
        <label for="cooldown-time">Capture Cooldown:</label>
        <select id="cooldown-time">
          <option value="15">15 minutes</option>
          <option value="20">20 minutes</option>
          <option value="25">25 minutes</option>
          <option value="30" selected>30 minutes</option>
          <option value="45">45 minutes</option>
        </select>
      </div>

      <table class="${dataTable}" id="zones-table">
        <thead>
          <tr>
            <th>Zone (ID)</th>
            <th>Name (Editable)</th>
            <th>GPS (Lat,Lng)</th>
            <th>Diameter (km)</th>
            <th>Action</th>
            <th>Status / Team</th>
          </tr>
        </thead>
        <tbody id="zones-table-body"></tbody>
      </table>
    </div>
  `;
}