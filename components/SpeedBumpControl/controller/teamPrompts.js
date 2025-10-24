// ============================================================================
// TEAM PROMPTS – mapping, shuffle, and persistence
// ============================================================================
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