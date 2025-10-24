// ============================================================================
// SPEED BUMP OVERLAY
// ============================================================================
import { escapeHtml } from '../../utils.js';

export function showSpeedBumpOverlay({ by = '', challenge = '' } = {}) {
  let el = document.getElementById('speedbump-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'speedbump-overlay';
    Object.assign(el.style, {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
      color: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 6000
    });
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <h2>🚧 Speed Bump by ${escapeHtml(by)}</h2>
    <p>${escapeHtml(challenge)}</p>
    <button id="speedbump-dismiss">OK</button>`;
  document.getElementById('speedbump-dismiss').onclick = () => el.remove();
}

export function hideSpeedBumpOverlay() {
  document.getElementById('speedbump-overlay')?.remove();
}