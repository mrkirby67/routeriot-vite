// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/FlatTireControl/controller/autoScheduler.js
// PURPOSE: === AI-CONTEXT-MAP ===
// DEPENDS_ON: ../../../modules/flatTireManager.js
// USED_BY: features/flat-tire/flatTireController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { assignFlatTireTeam } from '../../../modules/flatTireManager.js';

const AUTO_RELEASE_MINUTES = 20;

export function startAutoScheduler(controller) {
  if (controller.autoScheduler.running) return;
  const minutes = parseInt(controller.dom.autoIntervalInput.value || controller.config.autoIntervalMinutes, 10) || 10;
  const ms = minutes * 60_000;
  controller.autoScheduler.running = true;
  controller.autoScheduler.timerId = setInterval(() => runAutoCycle(controller), ms);
  runAutoCycle(controller);
}

export function stopAutoScheduler(controller) {
  if (!controller.autoScheduler.running) return;
  clearInterval(controller.autoScheduler.timerId);
  controller.autoScheduler.running = false;
}

function runAutoCycle(controller) {
  const { activeTeams, assignments } = controller;
  const available = activeTeams.filter(t => !assignments.has(t));
  if (!available.length) return;
  const team = available[Math.floor(Math.random() * available.length)];
  const zoneKeys = Object.keys(controller.config.zones).filter(k => controller.config.zones[k].gps);
  const zoneKey = zoneKeys[Math.floor(Math.random() * zoneKeys.length)];
  if (!zoneKey) return;
  const zone = controller.config.zones[zoneKey];
  assignFlatTireTeam(team, {
    zoneKey,
    depotId: zoneKey,
    zoneName: zone.name,
    gps: zone.gps,
    assignedAt: Date.now(),
    autoReleaseAt: Date.now() + AUTO_RELEASE_MINUTES * 60_000,
    assignedBy: 'Auto',
    status: 'auto-assigned'
  }).catch(err => console.warn('Auto assign fail', err));
}
// === AI-CONTEXT-MAP ===
phase: {{phase}}
aicp_category: {{category}}
exports: {{exports}}
linked_files: {{linked_files}}
status: {{status}}
ai_origin:
  primary: {{primary_ai}}
  secondary: {{secondary_ai}}
sync_state: {{sync_state}}
// === END ===

