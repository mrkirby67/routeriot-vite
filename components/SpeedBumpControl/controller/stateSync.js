// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SpeedBumpControl/controller/stateSync.js
// PURPOSE: === AI-CONTEXT-MAP ===
// DEPENDS_ON: https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../../modules/config.js, ../../../modules/speedBump/index.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../../../modules/config.js';
import { subscribeSpeedBumps } from '../../../modules/speedBump/index.js';

export function syncTeams(controller) {
  const racersRef = collection(db, 'racers');
  return onSnapshot(racersRef, snap => {
    const teams = new Set();
    snap.forEach(d => {
      const t = d.data()?.team;
      if (typeof t === 'string' && t.trim() && t.trim() !== '-') {
        teams.add(t.trim());
      }
    });
    controller.activeTeams = Array.from(teams).sort();
    controller.renderTeamTable();
  });
}

export function syncBumps(controller) {
  return subscribeSpeedBumps((payload = {}) => {
    if (typeof controller.handleSpeedBumpUpdate === 'function') {
      controller.handleSpeedBumpUpdate(payload);
    } else {
      controller.renderRows();
    }
  });
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SpeedBumpControl/controller/stateSync.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: syncTeams, syncBumps
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
