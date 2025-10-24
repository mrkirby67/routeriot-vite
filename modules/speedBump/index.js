// ============================================================================
// FILE: modules/speedBump/index.js
// PURPOSE: Unified export hub for all Speed Bump logic (core, comms, timers, etc.)
// ============================================================================

// --- Core Data & Constants ---
export * from './core.js';

// --- Interaction Logic (assignments, proof, etc.) ---
export * from './interactions.js';

// --- Communication / Broadcast Layer ---
export * from './comms.js';

// --- Timing / Cooldown Logic ---
export * from './timers.js';

// --- Reversal Logic (Instant Karma events) ---
export * from './reversals.js';

// --- Compatibility Layer ---
// For legacy modules that previously imported from speedBumpManager.js
export {
  getCooldownRemaining,
  getActiveBump,
  subscribeSpeedBumps,
  subscribeSpeedBumpsForAttacker,
  sendSpeedBump,
  sendSpeedBumpChirp,
  markProofSent,
  releaseSpeedBump,
  applyProofSent
} from './interactions.js';

export { clearValidationTimer } from './timers.js';
