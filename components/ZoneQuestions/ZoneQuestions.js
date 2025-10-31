// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestions.js
// PURPOSE: 🔹 Export both together for streamlined imports
// DEPENDS_ON: components/ZoneQuestions/ZoneQuestionsUI.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { ZoneQuestionsComponent, initializeZoneQuestionsUI } from './ZoneQuestionsUI.js';

// 🔹 Export both together for streamlined imports
export {
  ZoneQuestionsComponent,
  initializeZoneQuestionsUI
};

// 🔹 Optional helper if integrating via main control init system
export async function initializeZoneQuestions() {
  const container = document.getElementById('zone-questions-container');
  if (!container) return;
  container.innerHTML = ZoneQuestionsComponent();
  await initializeZoneQuestionsUI();
  console.log('✅ ZoneQuestions module initialized.');
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneQuestions/ZoneQuestions.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: initializeZoneQuestions, ZoneQuestionsComponent, initializeZoneQuestionsUI
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
