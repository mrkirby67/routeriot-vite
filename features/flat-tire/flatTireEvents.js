// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/flat-tire/flatTireEvents.js
// PURPOSE: Handles event bindings, listeners, and timers for the Flat Tire feature.
// DEPENDS_ON: services/flat-tire/flatTireService.js
// USED_BY: features/flat-tire/flatTireController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

import * as service from '../../services/flat-tire/flatTireService.js';

export function handleTableClick(event, controller) {
    const target = event?.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('tr[data-team]');
    if (!row) return;
    const teamName = row.dataset.team;
    if (!teamName) return;

    const action = button.dataset.action;
    if (action === 'assign') {
      assignTeam(teamName, controller, button).catch((err) => {
        console.error(`❌ Flat Tire send failed for ${teamName}:`, err);
      });
    } else if (action === 'release') {
      releaseTeam(teamName, controller, button).catch((err) => {
        console.error(`❌ Flat Tire release failed for ${teamName}:`, err);
      });
    }
}

export async function handleBulkSendClick(event, controller) {
    event?.preventDefault?.();
    const button = controller.dom.sendBtn;
    if (!button) return;

    if (!controller.activeTeams.length) {
      alert('No teams available to send. Wait for racers to register.');
      return;
    }

    const teamsToSend = controller.activeTeams.filter((teamName) => {
      const zoneKey = controller.getSelectedZoneKey(teamName);
      if (!zoneKey) return false;
      const zone = controller.config?.zones?.[zoneKey];
      if (!zone?.gps) return false;
      const currentAssignment = controller.assignments.get(teamName);
      return !currentAssignment || currentAssignment.zoneKey !== zoneKey;
    });

    if (!teamsToSend.length) {
      alert('Select tow zones for at least one team before sending.');
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Sending...';

    try {
      for (const teamName of teamsToSend) {
        // Sequential to propagate alerts accurately and simplify UI feedback.
        await assignTeam(teamName, controller);
      }
      button.textContent = '✅ Sent!';
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2500);
    } catch (err) {
      console.error('❌ Bulk Flat Tire send failed:', err);
      alert('Failed to send one or more tow assignments. Check console for details.');
      button.textContent = '⚠️ Error — Retry';
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 3500);
    }
}

export function handleRefreshZonesClick(controller) {
    const button = controller.dom.refreshZonesBtn;
    if (button) button.disabled = true;

    service.loadFlatTireConfig()
      .then((cfg) => {
        controller.applyConfig(controller, cfg);
        return controller.ensureMapsAndZonesReady();
      })
      .then(() => controller.queueRefresh(true))
      .catch((err) => console.error('❌ Failed to refresh Flat Tire zones:', err))
      .finally(() => {
        if (button) button.disabled = false;
      });
}

export function handleZoneSelectChange(event, controller) {
    const select = event?.target;
    if (!select || !select.matches('select[data-role="zone-select"]')) return;
    const team = select.closest('tr[data-team]')?.dataset.team;
    if (!team) return;
    controller.selectedZones.set(team, select.value || '');
    controller.updateSendButtonState();
}

export async function handleRandomizeClick(event, controller) {
    event?.preventDefault?.();

    if (!controller.activeTeams.length) {
      alert('No teams registered to randomize.');
      return;
    }

    const configuredZones = controller.getConfiguredZoneKeys();
    if (!configuredZones.length) {
      alert('Tow zones not ready — please configure GPS coordinates.');
      return;
    }

    const button = controller.dom.randomizeBtn;
    if (button) button.disabled = true;

    try {
      await randomizeAssignedZones(controller, configuredZones);
      controller.queueRefresh(true);
    } catch (err) {
      console.error('❌ Randomize tow zones failed:', err);
      alert('Failed to randomize tow zones. Check console for details.');
    } finally {
      const enabled = controller.activeTeams.length > 0 && controller.getConfiguredZoneKeys().length > 0;
      if (button) button.disabled = !enabled;
      controller.queueRefresh();
    }
}

async function assignTeam(teamName, controller, button) {
    const zoneKey = controller.getSelectedZoneKey(teamName);
    if (!zoneKey) {
      alert(`Select a tow zone for ${teamName} before sending.`);
      throw new Error(`No tow zone selected for ${teamName}.`);
    }

    const zone = controller.config?.zones?.[zoneKey];
    if (!zone?.gps) {
      alert(`The ${zone?.name || zoneKey} zone is missing GPS details. Configure it before sending.`);
      throw new Error(`Tow zone ${zoneKey} missing GPS details.`);
    }

    controller.selectedZones.set(teamName, zoneKey);
    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Sending...';
    }

    try {
      await service.assignFlatTireTeam(teamName, {
        depotId: zoneKey,
        zoneKey,
        zoneName: zone.name || `Zone ${zoneKey.toUpperCase()}`,
        gps: zone.gps,
        lat: zone.lat,
        lng: zone.lng,
        diameterMeters: zone.diameterMeters,
        captureRadiusMeters: zone.captureRadiusMeters,
status: 'control-assigned'
      });
      controller.assignments.set(teamName, { zoneKey });
      if (button) {
        button.textContent = '✅ Sent!';
        setTimeout(() => {
          button.textContent = originalText || '🚨 Send';
          button.disabled = false;
        }, 2500);
      }
      controller.queueRefresh();
      controller.updateSendButtonState();
      return true;
    } catch (err) {
      if (button) {
        button.textContent = '⚠️ Error — Retry';
        setTimeout(() => {
          button.textContent = originalText || '🚨 Send';
          button.disabled = false;
        }, 3500);
      } else {
        alert(`Failed to send a tow crew to ${teamName}. Check console for details.`);
      }
      throw err;
    }
}

async function releaseTeam(teamName, controller, button) {
    const originalText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Releasing...';
    }
    try {
      await service.releaseFlatTireTeam(teamName);
      controller.assignments.delete(teamName);
      if (button) {
        button.textContent = '✅ Released';
        setTimeout(() => {
          button.textContent = originalText || '✅ Release';
          button.disabled = true;
        }, 2000);
      }
      controller.queueRefresh();
    } catch (err) {
      if (button) {
        button.textContent = '⚠️ Error — Retry';
        setTimeout(() => {
          button.textContent = originalText || '✅ Release';
          button.disabled = false;
        }, 3500);
      } else {
        alert(`Failed to release ${teamName}. Check console for details.`);
      }
      throw err;
    } finally {
      controller.updateSendButtonState();
    }
}

async function randomizeAssignedZones(controller, zoneKeys) {
    if (!zoneKeys.length) {
      alert('Configure at least one tow zone with GPS before randomizing.');
      return;
    }

    console.log('🎲 Randomizing Flat Tire zones for teams:', controller.activeTeams);
    const shuffledZones = shuffleArray(zoneKeys);

    controller.activeTeams.forEach((teamName, index) => {
      const zoneKey = shuffledZones[index % shuffledZones.length];
      controller.selectedZones.set(teamName, zoneKey);
      const select = controller.dom.tableBody?.querySelector(`tr[data-team="${escapeSelector(teamName)}"] select[data-role="zone-select"]`);
      if (select) select.value = zoneKey;
    });
    controller.updateSendButtonState();
}

function shuffleArray(array) {
  const clone = array.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function escapeSelector(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/[\"]/g, '\\{new_string}');
}

// AI-CONTEXT: aicp_category=feature; ai_origin=Gemini; ai_role=Feature Logic; codex_phase=tier3_refactoring; export_bridge=none
// AI-CONTEXT: exports=handleTableClick|handleBulkSendClick|handleRefreshZonesClick|handleZoneSelectChange|handleRandomizeClick; owner=RouteRiot-AICP; phase=tier3_refactoring; review_status=pending_review; status=stable; sync_state=aligned; ui_dependency=none
