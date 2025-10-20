// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestions.js
// PURPOSE: Entry point that ties together UI + Logic for zone questions.
// Exports main component and initialization method for Control Page integration.
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