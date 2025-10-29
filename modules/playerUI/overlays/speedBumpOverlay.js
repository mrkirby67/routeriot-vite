// ============================================================================
// SPEED BUMP OVERLAY
// ============================================================================
import { escapeHtml } from '../../utils.js';
import { SPEEDBUMP_STATUS } from '../../speedBump/core.js';

function ensureOverlay() {
  let overlay = document.getElementById('speedbump-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'speedbump-overlay';
  overlay.className = 'speedbump-overlay';
  overlay.innerHTML = `
    <div class="speedbump-overlay__content">
      <h2 data-role="headline">🚧 Speed Bump!</h2>
      <p data-role="chirp" class="speedbump-overlay__chirp"></p>
      <p data-role="challenge"></p>
      <div class="speedbump-overlay__countdown">
        ⏱️ <span data-remaining>--s</span>
      </div>
      <button type="button" data-role="dismiss">OK</button>
    </div>
  `;

  const dismissBtn = overlay.querySelector('[data-role="dismiss"]');
  dismissBtn?.addEventListener('click', () => {
    overlay.classList.remove('visible');
  });

  document.body.appendChild(overlay);
  return overlay;
}

function stopOverlayTimer(overlay) {
  if (overlay?.__timer) {
    clearTimeout(overlay.__timer);
    overlay.__timer = null;
  }
}

function formatRemaining(diffMs) {
  const seconds = Math.ceil(Math.max(0, diffMs) / 1000);
  return `${seconds}s`;
}

export function onSpeedBumpUpdate(data) {
  const overlay = ensureOverlay();
  const remainingEl = overlay.querySelector('[data-remaining]');
  const headlineEl = overlay.querySelector('[data-role="headline"]');
  const challengeEl = overlay.querySelector('[data-role="challenge"]');
  const chirpEl = overlay.querySelector('[data-role="chirp"]');

  const status = typeof data?.status === 'string' ? data.status.toLowerCase() : null;
  const isActive = status === SPEEDBUMP_STATUS.active;
  const explicitlyReleased = status === SPEEDBUMP_STATUS.released || status === SPEEDBUMP_STATUS.expired;

  if (!isActive || explicitlyReleased) {
    stopOverlayTimer(overlay);
    overlay.classList.remove('visible');
    if (remainingEl) remainingEl.textContent = '--s';
    if (challengeEl) challengeEl.textContent = '';
    if (chirpEl) {
      chirpEl.textContent = '';
      chirpEl.hidden = true;
    }
    return;
  }

  const end = Number.isFinite(data?.expiresAt)
    ? data.expiresAt
    : Date.now() + (Number(data?.countdownMs) || 0);

  if (headlineEl) {
    const attackerName = (typeof data?.attacker === 'string' ? data.attacker : data?.by) || 'Control';
    const attacker = attackerName && attackerName.trim()
      ? escapeHtml(attackerName.trim())
      : 'Control';
    headlineEl.textContent = `🚧 Speed Bump by ${attacker}`;
  }

  if (challengeEl) {
    const detail = (typeof data?.details === 'string' ? data.details : data?.challenge) || '';
    const challenge = detail && detail.trim()
      ? escapeHtml(detail.trim())
      : 'Complete the challenge to continue!';
    challengeEl.textContent = challenge;
  }

  if (chirpEl) {
    const chirpText = typeof data?.chirp === 'string' ? data.chirp.trim() : '';
    if (chirpText) {
      chirpEl.textContent = `Chirp: ${escapeHtml(chirpText)}`;
      chirpEl.hidden = false;
    } else {
      chirpEl.textContent = '';
      chirpEl.hidden = true;
    }
  }

  overlay.classList.add('visible');

  const tick = () => {
    const diff = end - Date.now();
    if (remainingEl) remainingEl.textContent = formatRemaining(diff);
    if (diff <= 0) {
      overlay.classList.remove('visible');
      stopOverlayTimer(overlay);
      return;
    }
    overlay.__timer = setTimeout(tick, 500);
  };

  stopOverlayTimer(overlay);
  tick();
}

export function showSpeedBumpOverlay({ by = '', challenge = '', countdownMs = 0 } = {}) {
  onSpeedBumpUpdate({
    status: SPEEDBUMP_STATUS.active,
    by,
    challenge,
    countdownMs,
    expiresAt: Date.now() + Math.max(0, countdownMs || 0)
  });
}

export function hideSpeedBumpOverlay() {
  onSpeedBumpUpdate(null);
}
