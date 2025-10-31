// ============================================================================
// FILE: components/FlatTireControl/controller/firestoreSync.js
// PURPOSE: Component module components/FlatTireControl/controller/firestoreSync.js
// DEPENDS_ON: https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, modules/config.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================

import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../../../modules/config.js';

export function subscribeToRacers(controller) {
  try {
    const racersRef = collection(db, 'racers');
    return onSnapshot(racersRef, snapshot => {
      const teams = [];
      snapshot.forEach(doc => {
        const t = doc.data();
        if (t.team && t.team !== '-') teams.push(t.team.trim());
      });
      controller.handleTeamRegistry(teams);
    });
  } catch (err) {
    console.warn('⚠️ Racer subscription failed:', err);
    controller.handleTeamRegistry([]);
    return () => {};
  }
}

export function applyConfig(controller, config) {
  if (!config?.zones) return;
  controller.config = config;
  controller.ignoreConfigInput = true;

  ['north', 'south', 'east', 'west'].forEach(k => {
    const zone = config.zones[k];
    const input = controller.dom.zoneInputs.get(k);
    if (input) input.value = zone.gps || '';
  });

  if (controller.dom.autoIntervalInput)
    controller.dom.autoIntervalInput.value = config.autoIntervalMinutes;

  controller.ignoreConfigInput = false;
}

// === AI-CONTEXT-MAP ===
// aicp_category: component
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// ai_role: UI Layer
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: subscribeToRacers, applyConfig
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END ===
