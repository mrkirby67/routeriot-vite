// ============================================================================
// FILE: modules/speedBumpPlayer.js
// PURPOSE: Player-side wiring for Speed Bump overlay subscriptions
// ============================================================================

import { ensureSpeedBumpOverlayListeners } from '../ui/overlays/speedBumpOverlay.js';
import { triggerSpeedBump } from '../services/speed-bump/speedBumpService.js';
import { formatSenderContact } from './speedBump/interactions.js';

let teardownOverlay = null;

function resolveTeamName(input) {
  if (typeof input === 'string' && input.trim()) return input.trim();
  if (input && typeof input.teamName === 'string' && input.teamName.trim()) return input.teamName.trim();
  if (typeof window !== 'undefined') {
    const candidate = window.currentPlayerTeam || window.localStorage?.getItem?.('teamName');
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function resolveGameId() {
  if (typeof window === 'undefined') return 'global';
  const candidates = [
    window.__rrGameId,
    window.__routeRiotGameId,
    window.sessionStorage?.getItem?.('activeGameId'),
    window.localStorage?.getItem?.('activeGameId')
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return 'global';
}

export function initSpeedBumpPlayer(teamContext) {
  const teamName = resolveTeamName(teamContext);
  if (!teamName) {
    console.warn('[speedBumpPlayer] No team resolved; skipping overlay init.');
    return () => {};
  }

  teardownOverlay?.('handover');
  teardownOverlay = ensureSpeedBumpOverlayListeners({ teamName });
  return teardownOverlay;
}

export function teardownSpeedBumpPlayer(reason = 'manual') {
  try { teardownOverlay?.(reason); } catch {}
  teardownOverlay = null;
}

// Backward compatibility alias
export const initializeSpeedBumpPlayer = initSpeedBumpPlayer;

export async function sendSpeedBumpFromPlayer(fromTeam, targetTeam, type = 'slowdown') {
  const attacker =
    typeof fromTeam === 'string' && fromTeam.trim() ? fromTeam.trim().toLowerCase() : null;
  const defender =
    typeof targetTeam === 'string' && targetTeam.trim() ? targetTeam.trim().toLowerCase() : null;
  const gameId = resolveGameId();
  const { email: contactEmail, phone: contactPhone } = formatSenderContact(fromTeam);

  if (!attacker || !defender || attacker === defender) {
    throw new Error('Valid attacker and victim are required.');
  }

  return triggerSpeedBump(defender, type, {
    teamName: typeof targetTeam === 'string' ? targetTeam.trim() : defender,
    triggeredBy: typeof fromTeam === 'string' ? fromTeam.trim() : attacker,
    origin: 'player',
    attackerId: attacker,
    gameId,
    contactName: typeof fromTeam === 'string' ? fromTeam.trim() : attacker,
    contactPhone: contactPhone || null,
    contactEmail: contactEmail || null
  });
}

// === AICP MODULE FOOTER ===
// ai_origin: modules/speedBumpPlayer.js
// ai_role: Player Logic
// aicp_category: module
// aicp_version: 3.3
// codex_phase: legacy_restore_phase2
// export_bridge: ui
// exports: initSpeedBumpPlayer, teardownSpeedBumpPlayer, initializeSpeedBumpPlayer
// linked_files: []
// owner: Route Riot-AICP
// phase: legacy_restore_phase2
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: services
// === END AICP MODULE FOOTER ===
