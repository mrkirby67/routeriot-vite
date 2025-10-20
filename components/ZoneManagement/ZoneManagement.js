// ============================================================================
// FILE: components/ZoneManagement/ZoneManagement.js
// PURPOSE: Orchestrator – ties together UI, rendering, and handlers
// Syncs zone edits & captures with teamStatus/{teamName} (lastKnownLocation + timestamp)
// ============================================================================
import { ZoneManagementComponent } from './zoneUI.js';
import { renderZones } from './zoneRender.js';
import { attachZoneHandlers } from './zoneHandlers.js';
import {
  collection,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../../modules/config.js';
import { allTeams } from '../../data.js';

export { ZoneManagementComponent };

/**
 * Initialize Zone Management logic for the Control dashboard.
 * @param {boolean} googleMapsApiLoaded - Whether Google Maps API is ready
 */
export async function initializeZoneManagementLogic(googleMapsApiLoaded) {
  const tableBody = document.getElementById('zones-table-body');
  const banner = document.getElementById('zone-status-banner');
  if (!tableBody || !banner) {
    console.warn('⚠️ ZoneManagement initialization skipped — missing DOM elements.');
    return;
  }

  const zonesCollection = collection(db, 'zones');

  // ---------------------------------------------------------------------------
  // 🗺️ Update Team Location Helper
  // ---------------------------------------------------------------------------
  async function updateTeamLocation(teamName, zoneName) {
    if (!teamName || !zoneName) return;

    const standardizedTeam =
      allTeams.find(t => t.name === teamName)?.name || teamName.trim();

    try {
      await setDoc(
        doc(db, 'teamStatus', standardizedTeam),
        {
          lastKnownLocation: zoneName,
          timestamp: serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`📍 Updated ${standardizedTeam} → ${zoneName}`);
    } catch (err) {
      console.error(`❌ Failed to update location for ${standardizedTeam}:`, err);
    }
  }

  // ---------------------------------------------------------------------------
  // ♻️ Reset Team Location Helper
  // ---------------------------------------------------------------------------
  async function clearTeamLocation(teamName) {
    if (!teamName) return;

    const standardizedTeam =
      allTeams.find(t => t.name === teamName)?.name || teamName.trim();

    try {
      await updateDoc(doc(db, 'teamStatus', standardizedTeam), {
        lastKnownLocation: '',
        timestamp: serverTimestamp(),
      });
      console.log(`♻️ Cleared location for ${standardizedTeam}`);
    } catch (err) {
      // Fallback to create the doc if it doesn't exist yet
      if (err.code === 'not-found') {
        await setDoc(doc(db, 'teamStatus', standardizedTeam), {
          lastKnownLocation: '',
          timestamp: serverTimestamp(),
        });
        console.log(`🆕 Created new teamStatus doc for ${standardizedTeam}`);
      } else {
        console.warn(`⚠️ Could not reset location for ${standardizedTeam}:`, err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 🌐 Hook Handlers (passes callbacks to zoneHandlers)
  // ---------------------------------------------------------------------------
  attachZoneHandlers({
    tableBody,
    renderZones,
    googleMapsApiLoaded,
    onZoneCaptured: async (teamName, zoneName) => {
      await updateTeamLocation(teamName, zoneName);
    },
    onZoneManuallySet: async (teamName, zoneName) => {
      await updateTeamLocation(teamName, zoneName);
    },
    onZoneReset: async (teamName) => {
      await clearTeamLocation(teamName);
    },
  });

  // ---------------------------------------------------------------------------
  // 🔁 Manual Refresh
  // ---------------------------------------------------------------------------
  const refreshBtn = document.getElementById('refresh-zones-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () =>
      renderZones({ tableBody, googleMapsApiLoaded });
  }

  // ---------------------------------------------------------------------------
  // 🧭 Initial Render
  // ---------------------------------------------------------------------------
  try {
    await renderZones({ tableBody, googleMapsApiLoaded });
    console.log('✅ Zone Management initialized with teamStatus sync.');
  } catch (err) {
    console.error('❌ Failed to render zones on init:', err);
  }
}