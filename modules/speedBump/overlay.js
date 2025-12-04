// === AICP MODULE HEADER ===
// ============================================================================
// FILE: modules/speedBump/overlay.js
// PURPOSE: Legacy player-side Speed Bump overlay renderer
// LAYER: modules (legacy overlay)
// DEPENDS_ON: modules/speedBump/interactions.js, teamSurpriseManager, utils
// AUTHOR: Route Riot – Speed Bump
// CREATED: 2025-01-01
// AICP_VERSION: 1.0
// ============================================================================
// === END AICP MODULE HEADER ===

// ============================================================================
// FILE: modules/speedBump/overlay.js
// PURPOSE: Player-side Speed Bump overlay backed by Firestore assignments
// ============================================================================

import { subscribeSpeedBumpAssignments } from './interactions.js';
import { isShieldActive } from '../teamSurpriseManager.js';
import { escapeHtml } from '../utils.js';
import ChatServiceV2 from '../../services/ChatServiceV2.js';

let overlayEl = null;
let countdownId = null;
let unsubscribe = null;

export function initSpeedBumpOverlay(teamName) {
  if (!teamName) return;
  if (typeof unsubscribe === 'function') {
    try { unsubscribe(); } catch {}
    unsubscribe = null;
  }
  unsubscribe = subscribeSpeedBumpAssignments(teamName, (data) => {
    if (!data || data.active === false) {
      hideOverlay();
      return;
    }
    if (isShieldActive(teamName)) {
      toast(`✨ Your shiny wax protected you from ${escapeHtml(data.attacker || 'Unknown team')}!`);
      hideOverlay();
      return;
    }
    renderOverlay(data);
  });
}

export function disposeSpeedBumpOverlay() {
  if (typeof unsubscribe === 'function') {
    try { unsubscribe(); } catch {}
  }
  unsubscribe = null;
  hideOverlay();
}

function renderOverlay({ attacker, contactInfo, task, expiresAt }) {
  hideOverlay();

  overlayEl = document.createElement('div');
  overlayEl.id = 'speedbump-overlay';
  overlayEl.className = 'speedbump-overlay';
  overlayEl.innerHTML = `
    <div class="speedbump-overlay__content">
      <h2>🚧 Speed Bump!</h2>
      <p>From <b>${escapeHtml(attacker || 'Unknown')}</b></p>
      <p>${escapeHtml(task || 'Complete your task!')}<br>
         Send proof to <b>${escapeHtml(contactInfo || '(no contact)')}</b></p>
      <div class="speedbump-overlay__countdown">⏱️ <span data-remaining>--s</span></div>
      <button data-chirp>📣 I’m done!</button>
    </div>`;

  document.body.appendChild(overlayEl);
  overlayEl.querySelector('[data-chirp]')
    ?.addEventListener('click', () => chirp(attacker), { once: true });

  startCountdown(expiresAt);
}

function normalizeExpiresAt(expiresAt) {
  if (!expiresAt) return null;
  if (typeof expiresAt === 'number') return expiresAt;
  if (typeof expiresAt.toMillis === 'function') return expiresAt.toMillis();
  if (expiresAt.seconds != null) {
    return expiresAt.seconds * 1000 + Math.floor((expiresAt.nanoseconds || 0) / 1e6);
  }
  return null;
}

function startCountdown(expiresAt) {
  const targetMs = normalizeExpiresAt(expiresAt);
  if (!Number.isFinite(targetMs)) {
    if (overlayEl) {
      const spanEl = overlayEl.querySelector('[data-remaining]');
      if (spanEl) spanEl.textContent = '--s';
    }
    return;
  }

  const remainingEl = () => overlayEl?.querySelector('[data-remaining]');

  function tick() {
    const el = remainingEl();
    if (!el) {
      hideOverlay();
      return;
    }
    const secs = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    el.textContent = `${secs}s`;
    if (secs <= 0) {
      hideOverlay();
    }
  }

  tick();
  countdownId = window.setInterval(tick, 1000);
}

function chirp(attacker) {
  const message = '✅ We completed your Speed Bump task!';
  if (window.chatManager?.sendPopupMessage) {
    window.chatManager.sendPopupMessage(attacker, message);
  } else if (window.chatManager?.sendPrivateSystemMessage) {
    window.chatManager.sendPrivateSystemMessage(attacker, message);
  }
  hideOverlay();
}

function hideOverlay() {
  if (overlayEl) {
    overlayEl.remove();
  }
  overlayEl = null;
  if (countdownId) {
    clearInterval(countdownId);
    countdownId = null;
  }
}

function toast(msg) {
  if (!msg) return;
  const el = document.createElement('div');
  el.className = 'toast-shield';
  el.textContent = msg;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 3000);
}
