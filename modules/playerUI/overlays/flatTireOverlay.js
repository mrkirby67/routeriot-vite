// ============================================================================
// FLAT TIRE OVERLAY
// ============================================================================
import { generateMiniMap } from '../../zonesMap.js';
import { escapeHtml } from '../../utils.js';

export function showFlatTireOverlay({ zoneName = 'Tow Zone' } = {}) {
  const el = document.createElement('div');
  el.id = 'flat-tire-overlay';
  el.innerHTML = `
    <h2>🚗 Flat Tire</h2>
    <p>Head to <strong>${escapeHtml(zoneName)}</strong> to check in!</p>
    <div id="flat-tire-map">${generateMiniMap({ name: zoneName, gps: '' })}</div>
    <button id="flat-tire-close">Got It</button>`;
  Object.assign(el.style, {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
    color: '#fff', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', zIndex: 6100
  });
  document.body.appendChild(el);
  document.getElementById('flat-tire-close').onclick = () => el.remove();
}

export function hideFlatTireOverlay() {
  document.getElementById('flat-tire-overlay')?.remove();
}

export function clearFlatTireOverlay() {
  hideFlatTireOverlay();
}
