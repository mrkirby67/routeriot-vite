// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneManagement/ZoneManagement.js
// PURPOSE: Initialize Zone Management logic for the Control dashboard.
// DEPENDS_ON: components/ZoneManagement/zoneUI.js, components/ZoneManagement/zoneRender.js, components/ZoneManagement/zoneHandlers.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, /core/config.js, ../../data.js, ../../modules/zoneManager.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { ZoneManagementComponent } from './zoneUI.js';
import { renderZones } from './zoneRender.js';
import { attachZoneHandlers } from './zoneHandlers.js';
import {
  collection,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '/core/config.js';
import { allTeams } from '../../data.js';
import {
  hydrateZoneCooldown,
  isZoneOnCooldown,
  getZoneCooldownRemaining
} from '../../modules/zoneManager.js';

export { ZoneManagementComponent };

/*
 * Initialize Zone Management logic for the Control dashboard.
 * @param {boolean} googleMapsApiLoaded - Whether Google Maps API is ready
 */

export async function initializeZoneManagementLogic(googleMapsApiLoaded) {
  const toggleBtn = document.getElementById('toggle-zone-management-btn');
  const panel = document.getElementById('zone-management-panel');

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? 'Collapse ▲' : 'Expand ▼';
    });
  }

  const tableBody = document.getElementById('zones-table-body');
  const banner = document.getElementById('zone-status-banner');
  if (!tableBody || !banner) {
    console.warn('⚠️ ZoneManagement initialization skipped — missing DOM elements.');
    return;
  }

  const zonesCollection = collection(db, 'zones');
  let unsubscribeZones = null;
  const cooldownRegistry = new Map(); // zoneId -> cell element
  let cooldownTimerId = null;
  let renderQueue = Promise.resolve();

  function stopCooldownTicker() {
    if (cooldownTimerId) {
      clearInterval(cooldownTimerId);
      cooldownTimerId = null;
    }
  }

  function ensureCooldownTicker() {
    if (!cooldownRegistry.size) {
      stopCooldownTicker();
      return;
    }
    if (!cooldownTimerId) {
      cooldownTimerId = setInterval(() => updateCooldownDisplays(), 30000);
    }
  }

  function rebuildStatusCell(cell) {
    if (!cell) return;
    const zoneId = cell.dataset.zoneId;
    if (!zoneId) return;

    const owner = cell.dataset.team || '';
    const zoneStatus = cell.dataset.zoneStatus || 'Available';
    const updatedTs = Number(cell.dataset.updatedTs || '');
    const updatedLabel = updatedTs ? new Date(updatedTs).toLocaleString() : '—';

    const cooldownClass = cell.dataset.classCooldown || 'cooldown-active';
    const ownedClass = cell.dataset.classOwned || 'owned-by';
    const availableClass = cell.dataset.classAvailable || 'zone-available';
    const updatedClass = cell.dataset.classUpdated || 'status-updated';

    const onCooldown = isZoneOnCooldown(zoneId);
    const remainingMinutes = onCooldown
      ? Math.max(1, Math.ceil(getZoneCooldownRemaining(zoneId) / 60000))
      : 0;

    let statusHtml = `<span class="${availableClass}">${zoneStatus}</span>`;
    if (owner) {
      statusHtml = onCooldown
        ? `<span class="${cooldownClass}">${owner} ⏳ (${remainingMinutes} min left)</span>`
        : `<span class="${ownedClass}">${owner}</span>`;
    } else if (onCooldown) {
      statusHtml = `<span class="${cooldownClass}">Cooldown ⏳ (${remainingMinutes} min left)</span>`;
    }

    cell.innerHTML = `${statusHtml}<br><small class="${updatedClass}">Updated: ${updatedLabel}</small>`;
    if (!onCooldown) {
      cell.dataset.cooldownUntil = '';
    }
  }

  function updateCooldownDisplays() {
    if (!cooldownRegistry.size) {
      stopCooldownTicker();
      return;
    }

    const entries = Array.from(cooldownRegistry.entries());
    for (const [zoneId, cell] of entries) {
      if (!cell?.isConnected) {
        cooldownRegistry.delete(zoneId);
        continue;
      }

      const datasetCooldown = Number(cell.dataset.cooldownUntil || '');
      if (datasetCooldown) {
        hydrateZoneCooldown(zoneId, datasetCooldown);
      }

      rebuildStatusCell(cell);

      if (!isZoneOnCooldown(zoneId)) {
        cooldownRegistry.delete(zoneId);
      }
    }

    if (!cooldownRegistry.size) {
      stopCooldownTicker();
    }
  }

  function registerCooldownCells(body = tableBody) {
    cooldownRegistry.clear();
    if (!body) return;

    const now = Date.now();
    body.querySelectorAll('td[data-zone-id]').forEach((cell) => {
      const zoneId = cell.dataset.zoneId;
      if (!zoneId) return;
      const datasetCooldown = Number(cell.dataset.cooldownUntil || '');
      if (datasetCooldown && datasetCooldown > now) {
        hydrateZoneCooldown(zoneId, datasetCooldown);
        cooldownRegistry.set(zoneId, cell);
      } else if (isZoneOnCooldown(zoneId)) {
        cooldownRegistry.set(zoneId, cell);
      }
      rebuildStatusCell(cell);
    });

    if (cooldownRegistry.size) {
      ensureCooldownTicker();
    } else {
      stopCooldownTicker();
    }
  }

  function enqueueRender({ tableBody: body = tableBody, googleMapsApiLoaded: mapsLoaded = googleMapsApiLoaded } = {}) {
    renderQueue = renderQueue
      .then(async () => {
        await renderZones({ tableBody: body, googleMapsApiLoaded: mapsLoaded });
        registerCooldownCells(body);
      })
      .catch((err) => {
        console.error('❌ Failed to render zones:', err);
      });
    return renderQueue;
  }

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
    renderZones: enqueueRender,
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
    refreshBtn.onclick = () => enqueueRender();
  }

  // ---------------------------------------------------------------------------
  // 🧭 Initial Render
  // ---------------------------------------------------------------------------
  try {
    await enqueueRender();
    unsubscribeZones = onSnapshot(zonesCollection, () => enqueueRender());
    console.log('✅ Zone Management initialized with teamStatus sync.');
  } catch (err) {
    console.error('❌ Failed to render zones on init:', err);
  }

  return () => {
    unsubscribeZones?.();
    stopCooldownTicker();
  };
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneManagement/ZoneManagement.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: initializeZoneManagementLogic, ZoneManagementComponent
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
