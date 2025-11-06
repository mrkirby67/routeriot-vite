// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/FlatTireControl/FlatTireControl.js
// PURPOSE: Auto-generated metadata for FlatTireControl
// DEPENDS_ON: features/flat-tire/flatTireController.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import styles from './FlatTireControl.module.css';
import { createFlatTireControlController } from './flatTireControlController.js';

let controllerInstance = null;

export function FlatTireControlComponent() {
  return `
    <div class="${styles.controlSection}">
      <div class="${styles.headerRow}">
        <div>
          <h2>Flat Tire — Tow Time</h2>
          <p class="${styles.subhead}">Dispatch repair crews and monitor tow assignments.</p>
        </div>
        <div class="${styles.schedulerControls}">
          <label class="${styles.intervalField}">
            <span>Auto schedule interval (minutes)</span>
            <input type="number" id="flat-tire-auto-interval" min="5" max="120" step="1" value="15" />
          </label>
          <button type="button" id="flat-tire-toggle-auto" class="${styles.secondaryBtn}">▶️ Start Auto Schedule</button>
        </div>
      </div>

      <div class="${styles.zoneGrid}">
        <div class="${styles.zoneCard}" data-zone="north">
          <div class="${styles.zoneCardHeader}">
            <h3>North Repair Depot</h3>
            <small>GPS (lat, lng)</small>
          </div>
          <input type="text" class="${styles.gpsInput}" id="flat-tire-zone-gps-north" placeholder="45.0123,-93.1234" spellcheck="false" data-zone="north" />
          <label class="${styles.diameterLabel}" for="flat-tire-zone-diameter-north">Map Diameter (m)</label>
          <input type="number" class="${styles.diameterInput}" id="flat-tire-zone-diameter-north" min="50" step="10" value="200" data-zone="north" />
          <div class="${styles.mapPreview}" id="flat-tire-zone-map-north">
            <div class="${styles.mapPlaceholder}">Waiting for GPS...</div>
          </div>
        </div>

        <div class="${styles.zoneCard}" data-zone="south">
          <div class="${styles.zoneCardHeader}">
            <h3>South Repair Depot</h3>
            <small>GPS (lat, lng)</small>
          </div>
          <input type="text" class="${styles.gpsInput}" id="flat-tire-zone-gps-south" placeholder="44.9876,-93.2100" spellcheck="false" data-zone="south" />
          <label class="${styles.diameterLabel}" for="flat-tire-zone-diameter-south">Map Diameter (m)</label>
          <input type="number" class="${styles.diameterInput}" id="flat-tire-zone-diameter-south" min="50" step="10" value="200" data-zone="south" />
          <div class="${styles.mapPreview}" id="flat-tire-zone-map-south">
            <div class="${styles.mapPlaceholder}">Waiting for GPS...</div>
          </div>
        </div>

        <div class="${styles.zoneCard}" data-zone="east">
          <div class="${styles.zoneCardHeader}">
            <h3>East Repair Depot</h3>
            <small>GPS (lat, lng)</small>
          </div>
          <input type="text" class="${styles.gpsInput}" id="flat-tire-zone-gps-east" placeholder="44.9980,-93.0456" spellcheck="false" data-zone="east" />
          <label class="${styles.diameterLabel}" for="flat-tire-zone-diameter-east">Map Diameter (m)</label>
          <input type="number" class="${styles.diameterInput}" id="flat-tire-zone-diameter-east" min="50" step="10" value="200" data-zone="east" />
          <div class="${styles.mapPreview}" id="flat-tire-zone-map-east">
            <div class="${styles.mapPlaceholder}">Waiting for GPS...</div>
          </div>
        </div>

        <div class="${styles.zoneCard}" data-zone="west">
          <div class="${styles.zoneCardHeader}">
            <h3>West Repair Depot</h3>
            <small>GPS (lat, lng)</small>
          </div>
          <input type="text" class="${styles.gpsInput}" id="flat-tire-zone-gps-west" placeholder="45.0456,-93.2901" spellcheck="false" data-zone="west" />
          <label class="${styles.diameterLabel}" for="flat-tire-zone-diameter-west">Map Diameter (m)</label>
          <input type="number" class="${styles.diameterInput}" id="flat-tire-zone-diameter-west" min="50" step="10" value="200" data-zone="west" />
          <div class="${styles.mapPreview}" id="flat-tire-zone-map-west">
            <div class="${styles.mapPlaceholder}">Waiting for GPS...</div>
          </div>
        </div>
      </div>

      <div class="${styles.legendRow}">
        <div>
          <strong>How it works:</strong>
          <p>Assign a tow zone to a stranded team. Countdown auto-releases after 20 minutes unless control releases early.</p>
        </div>
        <div class="${styles.legendBadges}">
          <span class="${styles.badge} ${styles.badgeActive}">Assigned</span>
          <span class="${styles.badge} ${styles.badgeInRoute}">In Route</span>
          <span class="${styles.badge} ${styles.badgeCleared}">Cleared</span>
        </div>
      </div>

      <div class="${styles.buttonRow}">
        <button type="button" id="flat-tire-send-btn" class="${styles.primaryBtn}">
          🚨 Send Selected
        </button>
        <button type="button" id="ft-randomize-zones-btn" class="${styles.secondaryBtn}">
          Randomize Assigned Zones
        </button>
        <button type="button" id="ft-refresh-zones-btn" class="${styles.secondaryBtn}">
          🔁 Refresh Zones
        </button>
      </div>

      <table class="${styles.dataTable}" id="flat-tire-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>Assigned Zone</th>
            <th>Status / Countdown</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="flat-tire-table-body">
          <tr>
            <td colspan="4" class="${styles.loading}">Loading registered teams…</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export async function initializeFlatTireControl() {
  controllerInstance?.destroy('reinitialize');
  controllerInstance = createFlatTireControlController();
  return controllerInstance.initialize();
}

export function teardownFlatTireControl(reason = 'manual') {
  controllerInstance?.destroy(reason);
  controllerInstance = null;
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/FlatTireControl/FlatTireControl.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: FlatTireControlComponent, initializeFlatTireControl, teardownFlatTireControl
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
