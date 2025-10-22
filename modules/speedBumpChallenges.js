// ============================================================================
// FILE: modules/speedBumpChallenges.js
// PURPOSE: Speed Bump photo challenge prompts and helpers
// ============================================================================

export const speedBumpPrompts = [
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

export function getRandomSpeedBumpPrompt(exclusions = []) {
  const pool = speedBumpPrompts.filter(prompt => !exclusions.includes(prompt));
  const source = pool.length ? pool : speedBumpPrompts;
  const index = Math.floor(Math.random() * source.length);
  return source[index];
}

export function getDefaultPrompts() {
  return [...speedBumpPrompts];
}
