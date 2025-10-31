// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SpeedBumpControl/controller/teamPrompts.js
// PURPOSE: === AI-CONTEXT-MAP ===
// DEPENDS_ON: ../../../modules/speedBumpChallenges.js
// USED_BY: components/SpeedBumpControl/speedBumpControlController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { getRandomSpeedBumpPrompt, getSpeedBumpPromptBank } from '../../../modules/speedBumpChallenges.js';
const PROMPTS_STORAGE_KEY = 'speedBumpPrompts';

export function loadPrompts() {
  try {
    return JSON.parse(localStorage.getItem(PROMPTS_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

export function savePrompts(map, teams) {
  const obj = {};
  teams.forEach(t => { const p = map.get(t); if (p) obj[t] = p; });
  localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(obj));
}

export function ensurePrompt(controller, team) {
  const current = controller.promptByTeam.get(team);
  if (current) return current;
  const next = getRandomSpeedBumpPrompt();
  controller.promptByTeam.set(team, next);
  return next;
}

export function shufflePrompt(controller, team) {
  const next = getRandomSpeedBumpPrompt([controller.promptByTeam.get(team)]);
  if (next) controller.promptByTeam.set(team, next);
}

export function reconcileWithBank(controller) {
  const bank = getSpeedBumpPromptBank();
  controller.activeTeams.forEach(team => {
    const p = controller.promptByTeam.get(team);
    if (!bank.includes(p)) controller.promptByTeam.set(team, getRandomSpeedBumpPrompt());
  });
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SpeedBumpControl/controller/teamPrompts.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: loadPrompts, savePrompts, ensurePrompt, shufflePrompt, reconcileWithBank
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
