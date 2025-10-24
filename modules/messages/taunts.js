// ============================================================================
// FILE: modules/messages/taunts.js
// PURPOSE: Centralized bank of playful chirps/taunts for in-game replies
// ============================================================================

import { CHIRP_MESSAGES } from '../../data/chirpMessages.js';

const baseTaunts = Array.isArray(CHIRP_MESSAGES) ? [...CHIRP_MESSAGES] : [];

const flatTireExtras = [
  "Tow trucks on standby? We'll send flowers to the depot you sent us to.",
  "Appreciate the cardio. Hope your next pit stop comes with jazz hands.",
  "We're airlifting this donut to your depot—care to race us there?",
  "North, south, east, west—whichever compass you picked, we're still coming for you."
];

const speedBumpExtras = [
  "Proof incoming. Maybe grab popcorn while you wait.",
  "Consider this the calm before our counter-bump.",
  "We're posing for your challenge like it's a music video.",
  "Hope you enjoy the suspense—we sure are."
];

function mergeTaunts(generic = [], extras = []) {
  return Object.freeze([...generic, ...extras].filter(Boolean));
}

const TAUNTS = Object.freeze({
  general: mergeTaunts(baseTaunts),
  flatTire: mergeTaunts(baseTaunts, flatTireExtras),
  speedBump: mergeTaunts(baseTaunts, speedBumpExtras)
});

export function getTauntList(kind = 'general') {
  const key = typeof kind === 'string' ? kind.trim().toLowerCase() : 'general';
  return TAUNTS[key] || TAUNTS.general;
}

export function getRandomTaunt(kind = 'general') {
  const list = getTauntList(kind);
  if (!list.length) return 'Nice move—game on!';
  const index = Math.floor(Math.random() * list.length);
  return list[index] || 'Nice move—game on!';
}
