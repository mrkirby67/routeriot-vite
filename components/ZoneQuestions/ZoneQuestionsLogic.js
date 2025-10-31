// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestionsLogic.js
// PURPOSE: ✅ Validate structure before saving a question
// DEPENDS_ON: components/ZoneQuestions/ZoneQuestionsTypes.js
// USED_BY: components/ZoneQuestions/ZoneQuestionsEditor.js, components/ZoneQuestions/ZoneQuestionsUI.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { allowedQuestionTypes, booleanSets } from './ZoneQuestionsTypes.js';

// ============================================================================
// ✅ Validate structure before saving a question
// ============================================================================
export function validateQuestionBeforeSave(q) {
  if (!q || typeof q !== 'object') return 'Invalid question object.';
  if (!q.type) return 'Missing question type.';
  if (!allowedQuestionTypes.includes(q.type)) return `Invalid type: ${q.type}`;
  if (!q.question?.trim()) return 'Question text required.';
  if (typeof q.points !== 'number' || q.points < 0) return 'Points must be ≥ 0.';

  switch (q.type) {
    // 🔸 Simple boolean questions
    case 'YES_NO':
    case 'TRUE_FALSE':
    case 'UP_DOWN':
      if (!q.booleanCorrect) return 'Missing correct answer.';
      if (!booleanSets[q.type].includes(q.booleanCorrect))
        return `Invalid boolean value: ${q.booleanCorrect}`;
      break;

    // 🔸 Numeric question with tolerance
    case 'NUMBER':
      if (Number.isNaN(q.numberCorrect)) return 'Numeric answer required.';
      if (q.numberTolerance < 0) return 'Tolerance must be ≥ 0.';
      break;

    // 🔸 Multiple choice — at least two options, one correct
    case 'MULTIPLE_CHOICE':
      if (!Array.isArray(q.mcOptions) || q.mcOptions.length < 2)
        return 'Need at least 2 choices.';
      if (q.mcOptions.filter(o => o.correct).length !== 1)
        return 'Mark exactly one choice as correct.';
      break;

    // 🔸 Open-ended questions — at least one valid phrase
    case 'OPEN':
      if (
        (!Array.isArray(q.openAccepted) || q.openAccepted.length === 0) &&
        (!Array.isArray(q.openInclude) || q.openInclude.length === 0)
      )
        return 'Provide at least one accepted or required phrase.';
      break;

    // 🔸 Complete (chat-trigger) type
    case 'COMPLETE':
      if (!q.triggerPhrase?.trim()) return 'Trigger phrase required.';
      if (!q.assignedTeam?.trim()) return 'Assigned team required.';
      break;
  }

  return null; // ✅ Valid
}

// ============================================================================
// ✅ Normalize comma-separated string → clean lowercase array
// ============================================================================
export function parseCsv(str = '') {
  return str
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.toLowerCase());
}

// ============================================================================
// ✅ Render a readable summary for display in tables or review screens
// ============================================================================
export function renderAnswerSummary(q) {
  if (!q) return '';

  switch (q.type) {
    case 'YES_NO':
    case 'TRUE_FALSE':
    case 'UP_DOWN':
      return q.booleanCorrect || '';

    case 'NUMBER':
      return `${q.numberCorrect ?? ''} ±${q.numberTolerance ?? 0}`;

    case 'MULTIPLE_CHOICE':
      if (!Array.isArray(q.mcOptions)) return '';
      return q.mcOptions
        .map(o => (o.correct ? `✅ ${o.text}` : o.text))
        .join(', ');

    case 'OPEN':
      return [
        q.openAccepted?.length ? `Accepted: ${q.openAccepted.join(', ')}` : '',
        q.openInclude?.length ? `Must include: ${q.openInclude.join(', ')}` : ''
      ]
        .filter(Boolean)
        .join(' | ');

    case 'COMPLETE':
      return `Trigger: “${q.triggerPhrase}” • Team: ${q.assignedTeam}${
        q.autoAward ? ' • Auto: Yes' : ''
      }`;

    default:
      return '';
  }
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneQuestions/ZoneQuestionsLogic.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: validateQuestionBeforeSave, parseCsv, renderAnswerSummary
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
