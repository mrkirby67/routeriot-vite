// ============================================================================
// File: components/ZoneManagement/ZoneManagement.js
// Purpose: Orchestrator – ties together UI, rendering, and handlers
// ============================================================================

import { ZoneManagementComponent } from './zoneUI.js';
import { renderZones } from './zoneRender.js';
import { attachZoneHandlers } from './zoneHandlers.js';
import { collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../../modules/config.js';

export { ZoneManagementComponent };

/**
 * Initialize Zone Management logic for the control dashboard.
 * @param {boolean} googleMapsApiLoaded - whether Google Maps API is ready
 */
export async function initializeZoneManagementLogic(googleMapsApiLoaded) {
  const tableBody = document.getElementById('zones-table-body');
  const banner = document.getElementById('zone-status-banner');
  if (!tableBody || !banner) return;

  // Reference for Firestore collection (used in handlers)
  const zonesCollection = collection(db, "zones");

  // Initial render
  await renderZones({ tableBody, googleMapsApiLoaded });

  // Attach handlers (edit, reset, add, force capture)
  attachZoneHandlers({
    tableBody,
    renderZones,
    googleMapsApiLoaded
  });

  // Manual refresh button
  const refreshBtn = document.getElementById('refresh-zones-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => renderZones({ tableBody, googleMapsApiLoaded });
  }

  console.log("✅ Zone Management initialized.");
}