// ============================================================================
// FLAT TIRE OVERLAY
// ============================================================================
import { generateMiniMap } from '../../zonesMap.js';
import { escapeHtml } from '../../utils.js';
import { getRandomChirp } from '../../../data/chirpMessages.js';

let countdownInterval = null;

function startCountdown(elementId, autoReleaseAtMs) {
    const countdownEl = document.getElementById(elementId);
    if (!countdownEl) return;

    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const update = () => {
        const now = Date.now();
        const remainingMs = Math.max(0, autoReleaseAtMs - now);
        const seconds = Math.floor(remainingMs / 1000) % 60;
        const minutes = Math.floor(remainingMs / (1000 * 60));
        countdownEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        if (remainingMs === 0) {
            clearInterval(countdownInterval);
        }
    };

    update();
    countdownInterval = setInterval(update, 1000);
}

export function showFlatTireOverlay({
  zoneName,
  gps,
  diameterMeters,
  autoReleaseAtMs,
  onCheckIn,
  onChirp
}) {
  let overlay = document.getElementById('flat-tire-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'flat-tire-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.9)';
    overlay.style.color = '#fff';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '6100';
    document.body.appendChild(overlay);
  }

  const mapHtml = generateMiniMap({ gps, diameter: diameterMeters / 1000 });

  overlay.innerHTML = `
    <div style="text-align: center;">
        <h2>🚧 Flat Tire</h2>
        <p>Head to <strong>${escapeHtml(zoneName)}</strong> to check in!</p>
        <div id="flat-tire-map">${mapHtml}</div>
        <div id="flat-tire-countdown" style="font-size: 1.5rem; margin: 1rem 0;"></div>
        <div>
            <button id="flat-tire-checkin-btn" style="padding: 10px 20px; font-size: 1rem; margin-right: 10px;">I’m Here</button>
            <button id="flat-tire-chirp-btn" style="padding: 10px 20px; font-size: 1rem;">🐦 Chirp</button>
        </div>
    </div>
  `;

  document.getElementById('flat-tire-checkin-btn')?.addEventListener('click', onCheckIn);
  
  const chirpButton = document.getElementById('flat-tire-chirp-btn');
  let chirpMessage = '';
  let isChirpPreviewed = false;

  chirpButton?.addEventListener('click', () => {
    if (!isChirpPreviewed) {
      // First click: Preview the message
      chirpMessage = getRandomChirp();
      chirpButton.textContent = `Send: "${chirpMessage}"`;
      isChirpPreviewed = true;
    } else {
      // Second click: Send the message
      onChirp(chirpMessage);
      chirpButton.textContent = '🐦 Chirp'; // Reset button text
      chirpButton.disabled = true; // Disable the button
      isChirpPreviewed = false;
    }
  });

  if (autoReleaseAtMs) {
    startCountdown('flat-tire-countdown', autoReleaseAtMs);
  }
}

export function hideFlatTireOverlay() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  document.getElementById('flat-tire-overlay')?.remove();
}

export function clearFlatTireOverlay() {
  hideFlatTireOverlay();
}