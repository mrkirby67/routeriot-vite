// ============================================================================
// CORE – shared state, helpers, team lookup, broadcast sanitation
// ============================================================================
import { allTeams } from '../../data.js';

export const TEAM_DIRECTORY = new Map(
  Array.isArray(allTeams) ? allTeams.map(t => [String(t?.name || '').trim(), t]) : []
);

export const activeBumps = new Map();
export const cooldowns = new Map();
export const subscribers = new Set();
export const processedMessages = new Set();
export const validationTimers = new Map();
export const interactionCooldowns = new Map();

export const COOLDOWN_MS = 60_000;
export const VALIDATION_MS = 5 * 60_000;
export const INTERACTION_COOLDOWN_MS = 60_000;
export const WILD_CARD_DURATION_MS = 90_000;
export const REVERSAL_DELAY_MS = 10_000;

export function normalizeTeamKey(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

export function sanitize(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/[<>]/g, '').trim();
}

export function findTeamByName(name) {
  if (!name) return null;
  const key = name.trim();
  const direct = TEAM_DIRECTORY.get(key);
  if (direct) return direct;
  const lower = key.toLowerCase();
  for (const t of TEAM_DIRECTORY.values()) {
    if (t?.name && t.name.toLowerCase() === lower) return t;
  }
  return null;
}