// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestionsTypes.js
// PURPOSE: 🔹 All supported question types
// DEPENDS_ON: none
// USED_BY: components/ZoneManagement/zoneRender.js, components/ZoneQuestions/ZoneQuestionsEditor.js, components/ZoneQuestions/ZoneQuestionsLogic.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

// 🔹 All supported question types
export const allowedQuestionTypes = [
  'YES_NO',
  'TRUE_FALSE',
  'NUMBER',
  'MULTIPLE_CHOICE',
  'OPEN',
  'COMPLETE',
  'UP_DOWN', // legacy support
];

// 🔹 Predefined boolean answer sets for simple question types
export const booleanSets = {
  YES_NO: ['YES', 'NO'],
  TRUE_FALSE: ['TRUE', 'FALSE'],
  UP_DOWN: ['UP', 'DOWN']
};

// 🔹 Default values used across numeric and multiple-choice templates
export const defaultTolerance = 0;
export const minChoices = 2;

// 🔹 Human-readable labels for UI elements (dropdowns, etc.)
export const questionTypeLabels = {
  YES_NO: 'Yes / No',
  TRUE_FALSE: 'True / False',
  NUMBER: 'Number (Exact or Range)',
  MULTIPLE_CHOICE: 'Multiple Choice',
  OPEN: 'Open (case-insensitive)',
  COMPLETE: 'Complete (chat-trigger)',
  UP_DOWN: 'Up / Down (legacy)',
};

// ============================================================================
// 🔹 Helper: Validate a question object by type before saving
// This ensures consistent validation across all modules (Editor, Logic, etc.)
// ============================================================================
export function validateQuestionType(q) {
  if (!q || typeof q !== 'object') throw new Error('Invalid question object.');
  if (!q.type) throw new Error('Question type is required.');
  if (!allowedQuestionTypes.includes(q.type))
    throw new Error(`Invalid type: ${q.type}`);

  switch (q.type) {
    case 'NUMBER':
      if (isNaN(q.numberCorrect))
        throw new Error('NUMBER type requires a valid numeric answer.');
      if (q.numberTolerance < 0)
        throw new Error('NUMBER tolerance must be ≥ 0.');
      break;

    case 'MULTIPLE_CHOICE':
      if (!Array.isArray(q.mcOptions) || q.mcOptions.length < minChoices)
        throw new Error(`MULTIPLE_CHOICE requires at least ${minChoices} options.`);
      if (q.mcOptions.filter(o => o.correct).length !== 1)
        throw new Error('MULTIPLE_CHOICE must have exactly one correct option.');
      break;

    case 'OPEN':
      if (
        (!Array.isArray(q.openAccepted) || q.openAccepted.length === 0) &&
        (!Array.isArray(q.openInclude) || q.openInclude.length === 0)
      )
        throw new Error('OPEN type must include accepted and/or required phrases.');
      break;

    case 'COMPLETE':
      if (!q.triggerPhrase)
        throw new Error('COMPLETE type requires a trigger phrase.');
      if (!q.assignedTeam)
        throw new Error('COMPLETE type must specify an assigned team.');
      break;
  }

  return true;
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneQuestions/ZoneQuestionsTypes.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: validateQuestionType, allowedQuestionTypes, booleanSets, defaultTolerance, minChoices, questionTypeLabels
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
