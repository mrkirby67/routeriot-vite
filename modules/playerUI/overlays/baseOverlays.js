// ============================================================================
// BASE OVERLAYS: pause, game over, confetti, tire celebration
// ============================================================================
import { startConfetti, stopConfetti } from './confetti.js';

export function showPausedOverlay() {
  const existing = document.getElementById('paused-overlay');
  if (existing) return;
  const el = document.createElement('div');
  el.id = 'paused-overlay';
  el.textContent = '⏸️ Paused — wait for host to resume...';
  Object.assign(el.style, {
    position: 'fixed', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '2rem', zIndex: 5000
  });
  document.body.appendChild(el);
}

export function hidePausedOverlay() {
  const el = document.getElementById('paused-overlay');
  if (el) el.remove();
}

export function showGameOverOverlay() {
  if (document.getElementById('gameover-overlay')) return;
  const el = document.createElement('div');
  el.id = 'gameover-overlay';
  el.innerHTML = `<div style="font-size:3rem;">🏁 GAME OVER</div>`;
  Object.assign(el.style, {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 6000
  });
  document.body.appendChild(el);
  startConfetti?.();
  setTimeout(stopConfetti, 5000);
}

export function showTireCelebration() {
  const container = document.createElement('div');
  container.className = 'tire-celebration';
  for (let i = 0; i < 6; i++) {
    const t = document.createElement('div');
    t.textContent = '🛞';
    t.style.position = 'absolute';
    t.style.left = `${Math.random() * 90}%`;
    t.style.top = `${Math.random() * 90}%`;
    container.appendChild(t);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 2500);
}

export { startConfetti, stopConfetti } from './confetti.js';
