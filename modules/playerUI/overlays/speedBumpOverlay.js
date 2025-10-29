// ============================================================================
// SPEED BUMP OVERLAY
// ============================================================================
import { escapeHtml } from '../../utils.js';
import { SPEEDBUMP_STATUS } from '../../speedBump/core.js';
import { showOverlay, hideOverlay } from './baseOverlays.js';

function ensureOverlay() {
  let overlay = document.getElementById('speedbump-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'speedbump-overlay';
  overlay.className = 'speedbump-overlay';
  overlay.style.display = 'none';
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

function getExpiresAt(entry) {
  if (!entry) return null;
  if (typeof entry.expiresAt === 'number') return entry.expiresAt;
  if (entry.expiresAt?.toMillis) return entry.expiresAt.toMillis();
  if (typeof entry.countdownMs === 'number') {
    const base = typeof entry.timestamp === 'number' ? entry.timestamp : Date.now();
    return base + entry.countdownMs;
  }
  if (typeof entry.createdAt === 'number' && typeof entry.countdownMs === 'number') {
    return entry.createdAt + entry.countdownMs;
  }
  return null;
}

function bindDismiss(button) {
  if (!button || button.dataset.bound === 'true') return;
  button.addEventListener('click', () => hideOverlay('speedbump'));
  button.dataset.bound = 'true';
}

function evaluateRemaining(entry) {
  const expiresAt = getExpiresAt(entry);
  if (!Number.isFinite(expiresAt)) return '--';
  const diff = Math.max(0, expiresAt - Date.now());
  return Math.ceil(diff / 1000);
}

export function updateSpeedBumpOverlay(assignments = []) {
  const overlay = ensureOverlay();
  const remainingEl = overlay.querySelector('[data-remaining]');
  const headlineEl = overlay.querySelector('[data-role="headline"]');
  const challengeEl = overlay.querySelector('[data-role="challenge"]');
  const chirpEl = overlay.querySelector('[data-role="chirp"]');
  const dismissBtn = overlay.querySelector('[data-role="dismiss"]');

  if (!Array.isArray(assignments) || assignments.length === 0) {
    stopOverlayTimer(overlay);
    hideOverlay('speedbump');
    if (remainingEl) remainingEl.textContent = '--s';
    if (challengeEl) challengeEl.textContent = '';
    if (chirpEl) {
      chirpEl.textContent = '';
      chirpEl.hidden = true;
    }
    return;
  }

  const active =
    assignments.find((entry) => (entry.status || '').toLowerCase() === SPEEDBUMP_STATUS.active) ||
    assignments[0];

  if (!active || (active.status && active.status !== SPEEDBUMP_STATUS.active)) {
    stopOverlayTimer(overlay);
    hideOverlay('speedbump');
    if (remainingEl) remainingEl.textContent = '--s';
    if (challengeEl) challengeEl.textContent = '';
    if (chirpEl) {
      chirpEl.textContent = '';
      chirpEl.hidden = true;
    }
    return;
  }

  const attackerName =
    (typeof active.attacker === 'string' && active.attacker.trim()) ||
    (typeof active.by === 'string' && active.by.trim()) ||
    'Unknown';
  const challengeText =
    (typeof active.details === 'string' && active.details.trim()) ||
    (typeof active.challenge === 'string' && active.challenge.trim()) ||
    (typeof active.message === 'string' && active.message.trim()) ||
    'Speed Bump incoming!';
  const chirpText = typeof active.chirp === 'string' && active.chirp.trim() ? active.chirp.trim() : '';
  const remainingSeconds = evaluateRemaining(active);

  if (headlineEl) {
    headlineEl.textContent = `🚧 Speed Bump by ${escapeHtml(attackerName)}`;
  }

  if (challengeEl) {
    challengeEl.textContent = escapeHtml(challengeText);
  }

  if (chirpEl) {
    if (chirpText) {
      chirpEl.textContent = `Chirp: ${escapeHtml(chirpText)}`;
      chirpEl.hidden = false;
    } else {
      chirpEl.textContent = '';
      chirpEl.hidden = true;
    }
  }

  if (remainingEl) {
    remainingEl.textContent = Number.isFinite(remainingSeconds) ? `${remainingSeconds}s` : '--s';
  }

  showOverlay('speedbump');
  bindDismiss(dismissBtn);

  const expiresAt = getExpiresAt(active);

  const tick = () => {
    const diff = Number.isFinite(expiresAt) ? expiresAt - Date.now() : null;
    if (!Number.isFinite(diff) || diff <= 0) {
      stopOverlayTimer(overlay);
      hideOverlay('speedbump');
      return;
    }
    if (remainingEl) remainingEl.textContent = formatRemaining(diff);
    overlay.__timer = setTimeout(tick, 1_000);
  };

  stopOverlayTimer(overlay);
  if (Number.isFinite(expiresAt)) {
    tick();
  }
}

export function showSpeedBumpOverlay({ by = '', challenge = '', countdownMs = 0 } = {}) {
  const expiresAt = Date.now() + Math.max(0, countdownMs || 0);
  updateSpeedBumpOverlay([
    {
      status: SPEEDBUMP_STATUS.active,
      attacker: by,
      challenge,
      countdownMs,
      expiresAt
    }
  ]);
}

export function hideSpeedBumpOverlay() {
  updateSpeedBumpOverlay([]);
}

export function onSpeedBumpUpdate(data) {
  if (!data) {
    updateSpeedBumpOverlay([]);
    return;
  }

  if (Array.isArray(data)) {
    updateSpeedBumpOverlay(data);
    return;
  }

  const status = typeof data.status === 'string' ? data.status : SPEEDBUMP_STATUS.active;
  updateSpeedBumpOverlay([{ ...data, status }]);
}
