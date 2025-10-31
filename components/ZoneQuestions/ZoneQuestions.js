// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestions.js
// PURPOSE: Component module components/ZoneQuestions/ZoneQuestions.js
// DEPENDS_ON: components/ZoneQuestions/ZoneQuestionsUI.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================

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

// === AI-CONTEXT-MAP ===
// aicp_category: component
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// ai_role: UI Layer
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: initializeZoneQuestions
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END ===
