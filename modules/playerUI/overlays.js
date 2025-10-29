// CENTRAL HUB — aggregates overlay modules
export * from './overlays/baseOverlays.js';
export * from './overlays/speedBumpOverlay.js';
export * from './overlays/flatTireOverlay.js';
export * from './overlays/shieldAndWrecked.js';
console.log('🧩 overlays.js modular hub initialized');

export function showResumeBanner() {
  const el = document.getElementById('overlay-banner');
  if (!el) return;
  el.textContent = '🏁 Game Resumed!';
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2500);
}
