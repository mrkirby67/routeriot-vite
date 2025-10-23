// ============================================================================
// FILE: modules/speedBumpChallenges.js
// PURPOSE: Speed Bump photo challenge prompts with editable bank helpers
// ============================================================================

const DEFAULT_PROMPTS = [
  'Pose with a city landmark making your best victory face.',
  'Grab a photo with a stranger wearing your team color.',
  'Stage a slow-motion action shot crossing a finish line.',
  'Snap your team acting out a famous movie scene.',
  'Find a mural and recreate it with your team as props.',
  'Capture a teammate balancing something silly on their head.',
  'Photograph your team forming the shape of a letter R.',
  'Take a photo with a passerby giving a thumbs-up.',
  'Document a creative “car repair” using items nearby.',
  'Take a selfie with everyone making the same goofy expression.'
];

let promptBank = [...DEFAULT_PROMPTS];

function normalizeBank(prompts = []) {
  if (!Array.isArray(prompts)) return [...DEFAULT_PROMPTS];
  const cleaned = prompts
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return cleaned.length ? cleaned : [...DEFAULT_PROMPTS];
}

export function setSpeedBumpPromptBank(prompts = []) {
  promptBank = normalizeBank(prompts);
  return getSpeedBumpPromptBank();
}

export function resetPromptBankToDefault() {
  promptBank = [...DEFAULT_PROMPTS];
  return getSpeedBumpPromptBank();
}

export function getSpeedBumpPromptBank() {
  return [...promptBank];
}

export function getRandomSpeedBumpPrompt(exclusions = []) {
  const exclusionSet = new Set(exclusions || []);
  const pool = promptBank.filter(prompt => !exclusionSet.has(prompt));
  const source = pool.length ? pool : promptBank;
  if (!source.length) return '';
  const index = Math.floor(Math.random() * source.length);
  return source[index];
}

export function getDefaultPrompts() {
  return [...DEFAULT_PROMPTS];
}
