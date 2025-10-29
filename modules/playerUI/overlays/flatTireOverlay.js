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
        <div style="display: flex; align-items: center; justify-content: center;">
            <button id="flat-tire-checkin-btn" style="padding: 10px 20px; font-size: 1rem; margin-right: 10px;">I’m Here</button>
            <div id="flat-tire-chirp-container">
                <button id="flat-tire-chirp-btn" style="padding: 10px 20px; font-size: 1rem;">🐦 Chirp</button>
                <div id="flat-tire-chirp-edit" style="display: none; align-items: center;">
                    <input type="text" id="flat-tire-chirp-input" style="padding: 10px; font-size: 1rem; width: 250px; border: none; border-radius: 5px;">
                    <button id="flat-tire-chirp-send-btn" style="padding: 10px 20px; font-size: 1rem; margin-left: 5px;">Send</button>
                </div>
            </div>
        </div>
    </div>
  `;

  document.getElementById('flat-tire-checkin-btn')?.addEventListener('click', onCheckIn);
  
  const chirpContainer = document.getElementById('flat-tire-chirp-container');
  const chirpButton = document.getElementById('flat-tire-chirp-btn');
  const chirpEditContainer = document.getElementById('flat-tire-chirp-edit');
  const chirpInput = document.getElementById('flat-tire-chirp-input');
  const chirpSendButton = document.getElementById('flat-tire-chirp-send-btn');

  chirpButton?.addEventListener('click', () => {
    if (chirpEditContainer && chirpButton) {
        chirpEditContainer.style.display = 'flex';
        chirpButton.style.display = 'none';
    }
    if (chirpInput) {
        chirpInput.value = getRandomChirp();
        chirpInput.focus();
    }
  });

  chirpSendButton?.addEventListener('click', () => {
    const message = chirpInput.value;
    if (message) {
        onChirp(message);
    }
    if (chirpContainer) {
        chirpContainer.innerHTML = '<button style="padding: 10px 20px; font-size: 1rem;" disabled>🐦 Chirp Sent</button>';
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