// ============================================================================
// FILE: components/ZoneManagement/zoneUI.js
// PURPOSE: Static markup for the Zone Management section (Control page)
// ============================================================================
import styles from './ZoneManagement.module.css';

export function ZoneManagementComponent() {
  const controlSection = styles?.controlSection || '';
  const dataTable = styles?.dataTable || '';
  const cooldownSetup = styles?.cooldownSetup || '';

  return `
    <div class="${controlSection}">
      <h2>🗺️ Zone Management</h2>

      <!-- Header Controls -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 12px;
      ">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="add-zone-btn"
            style="background:#00897B;color:white;padding:8px 16px;
                   border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
            ➕ Add Zone
          </button>

          <button id="refresh-zones-btn"
            style="background:#3949AB;color:white;padding:8px 16px;
                   border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
            🔄 Refresh Zones
          </button>
        </div>

        <div class="${cooldownSetup}" style="display:flex;align-items:center;gap:6px;">
          <label for="cooldown-time" style="font-weight:bold;color:#ddd;">Cooldown:</label>
          <select id="cooldown-time" style="padding:4px;border-radius:4px;">
            <option value="15">15 min</option>
            <option value="20">20 min</option>
            <option value="25">25 min</option>
            <option value="30" selected>30 min</option>
            <option value="45">45 min</option>
          </select>
        </div>
      </div>

      <!-- Banner -->
      <div id="zone-status-banner"
        style="padding:10px;margin-bottom:10px;border-radius:6px;
               text-align:center;background:#333;color:#bbb;
               font-weight:bold;display:none;">
      </div>

      <!-- Table -->
      <table class="${dataTable}" id="zones-table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#212121;color:#fff;text-align:left;">
            <th style="padding:8px;">Zone (ID)</th>
            <th style="padding:8px;">Name (Editable)</th>
            <th style="padding:8px;">GPS (Lat,Lng)</th>
            <th style="padding:8px;">Diameter (km)</th>
            <th style="padding:8px;">Actions</th>
            <th style="padding:8px;">Status / Team</th>
          </tr>
        </thead>
        <tbody id="zones-table-body">
          <tr>
            <td colspan="6" style="text-align:center;color:#888;padding:20px;">
              Loading zones...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}