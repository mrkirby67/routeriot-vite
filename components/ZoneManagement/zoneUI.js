// ============================================================================
// FILE: components/ZoneManagement/zoneUI.js
// PURPOSE: Component module components/ZoneManagement/zoneUI.js
// DEPENDS_ON: none
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
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
        margin-bottom: 16px;
      ">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="add-zone-btn" title="Add a new zone">
            ➕ Add Zone
          </button>

          <button id="refresh-zones-btn" title="Reload zone list">
            🔄 Refresh Zones
          </button>
        </div>

        <!-- Cooldown selector -->
        <div class="${cooldownSetup}" style="display:flex;align-items:center;gap:8px;">
          <label for="cooldown-time" style="font-weight:600;color:#ddd;">Cooldown:</label>
          <select id="cooldown-time" style="padding:4px 8px;border-radius:4px;">
            <option value="15">15 min</option>
            <option value="20">20 min</option>
            <option value="25">25 min</option>
            <option value="30" selected>30 min</option>
            <option value="45">45 min</option>
          </select>
        </div>
      </div>

      <!-- Status Banner -->
      <div id="zone-status-banner"
        style="padding:10px;margin-bottom:10px;border-radius:6px;
               text-align:center;background:#333;color:#bbb;
               font-weight:bold;display:none;">
        <!-- updated dynamically -->
      </div>

      <!-- Zones Table -->
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

// === AI-CONTEXT-MAP ===
// aicp_category: component
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// ai_role: UI Layer
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: ZoneManagementComponent
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END ===
