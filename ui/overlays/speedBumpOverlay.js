// === AICP UI HEADER ===
// ============================================================================
// FILE: ui/overlays/speedBumpOverlay.js
// PURPOSE: Renders the player-side Speed Bump overlay with live Team Surprise state.
// DEPENDS_ON: ./speedBumpOverlay.css
// USED_BY: features/team-surprise/teamSurprise.bridge.js
// AUTHOR: Route Riot – Speed Bump Refresh
// CREATED: 2025-10-31
// AICP_VERSION: 3.2
// ============================================================================
// === END AICP UI HEADER ===

import './speedBumpOverlay.css';
import { showOverlay, hideOverlay } from '../../modules/playerUI/overlays/baseOverlays.js';
import {
  ensureSpeedBumpEffectSubscription,
  markSpeedBumpChallengeComplete,
  sendSpeedBumpChirp
} from '../../features/team-surprise/teamSurpriseController.js';
import { onActiveEffectsChange } from '../../features/team-surprise/teamSurpriseState.js';
import { getRandomTaunt } from '../../modules/messages/taunts.js';
import { getRandomSpeedBumpFlavor } from '../../features/team-surprise/speedBumpFlavor.js';

let activeTeamName = null;
let unsubscribeEffects = null;
let unsubscribeState = null;
let countdownTimer = null;
let latestEffect = null;
const flavorCache = new Map();
let chirpCooldownModulePromise = null;

function resolveTeamName(candidate) {
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  if (typeof window !== 'undefined') {
    const fromWindow = window.currentPlayerTeam || window.localStorage?.getItem?.('teamName');
    if (typeof fromWindow === 'string' && fromWindow.trim()) {
      return fromWindow.trim();
    }
  }
  return '';
}

function ensureOverlayElement() {
  let overlay = document.getElementById('speedbump-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'speedbump-overlay';
  overlay.className = 'speedbump-overlay';
  overlay.innerHTML = `
    <div class="speedbump-overlay__panel">
      <header class="speedbump-overlay__header">
        <p class="speedbump-overlay__headline">🚧 Speed Bump Active</p>
        <p class="speedbump-overlay__flavor" data-role="flavor"></p>
        <div class="speedbump-overlay__countdown" data-role="countdown">Waiting for updates…</div>
      </header>
      <section class="speedbump-overlay__card">
        <label>Attacker</label>
        <input type="text" data-field="attacker" readonly value="Unknown" />
      </section>
      <section class="speedbump-overlay__grid">
        <div class="speedbump-overlay__card">
          <label>Email</label>
          <input type="text" data-field="email" readonly value="Not provided" />
        </div>
        <div class="speedbump-overlay__card">
          <label>Phone</label>
          <input type="text" data-field="phone" readonly value="Not provided" />
        </div>
      </section>
      <section class="speedbump-overlay__challenge">
        <label>Challenge</label>
        <p data-role="challenge">Hold tight — awaiting challenge details.</p>
      </section>
      <p class="speedbump-overlay__status" data-role="status"></p>
      <div class="speedbump-overlay__actions">
        <button type="button" data-role="complete">✅ Challenge Complete</button>
        <button type="button" data-role="chirp">💬 Send Chirp</button>
      </div>
      <div class="speedbump-overlay__chirp" data-role="chirp-composer" hidden>
        <textarea data-role="chirp-input" maxlength="480" placeholder="Drop your taunt…"></textarea>
        <div class="speedbump-overlay__chirp-actions">
          <div class="speedbump-overlay__chirp-buttons">
            <button type="button" data-role="chirp-send">Send</button>
            <button type="button" data-role="chirp-cancel">Cancel</button>
          </div>
          <span class="speedbump-overlay__chirp-status" data-role="chirp-status"></span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  bindOverlayEvents(overlay);
  return overlay;
}

function stopCountdown() {
  if (countdownTimer) {
    window.clearTimeout(countdownTimer);
    countdownTimer = null;
  }
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function startCountdown(targetMs, overlay) {
  stopCountdown();
  const countdownEl = overlay.querySelector('[data-role="countdown"]');
  if (!countdownEl || !Number.isFinite(targetMs)) {
    if (countdownEl) {
      countdownEl.textContent = 'Awaiting release window…';
    }
    return;
  }

  const tick = () => {
    const remaining = targetMs - Date.now();
    if (remaining <= 0) {
      countdownEl.textContent = 'Release window unlocked — Control will free you soon.';
      return;
    }
    countdownEl.textContent = `Release window in ${formatCountdown(remaining)}`;
    countdownTimer = window.setTimeout(tick, 1000);
  };

  tick();
}

function setInputValue(input, value, fallback = 'Not provided') {
  if (!input) return;
  if (value) {
    input.value = value;
    input.classList.remove('speedbump-overlay__placeholder');
  } else {
    input.value = fallback;
    input.classList.add('speedbump-overlay__placeholder');
  }
}

function setStatusMessage(overlay, message, tone = 'info') {
  const statusEl = overlay.querySelector('[data-role="status"]');
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.dataset.tone = tone;
}

async function handleChallengeComplete(effect, overlay) {
  if (!effect || !activeTeamName) return;
  const button = overlay.querySelector('[data-role="complete"]');
  if (!button || button.dataset.state === 'pending') return;

  button.disabled = true;
  button.textContent = '⏳ Starting timer…';
  setStatusMessage(overlay, 'Starting your 5-minute proof timer…', 'info');

  try {
    await markSpeedBumpChallengeComplete(activeTeamName, {
      durationMs: effect.releaseDurationMs
    });
    button.textContent = '⏳ Release Pending';
    button.dataset.state = 'pending';
    setStatusMessage(overlay, 'Release window started. Sit tight for 5 minutes!', 'success');
  } catch (err) {
    console.warn('⚠️ Failed to mark challenge complete:', err);
    button.textContent = '✅ Challenge Complete';
    button.disabled = false;
    setStatusMessage(overlay, err?.message || 'Unable to start release timer. Try again.', 'error');
  }
}

function loadChirpCooldown() {
  if (!chirpCooldownModulePromise) {
    chirpCooldownModulePromise = import('../../modules/chirpCooldown.js');
  }
  return chirpCooldownModulePromise;
}

async function handleChirpSend(effect, overlay) {
  if (!effect || !activeTeamName) return;
  const composer = overlay.querySelector('[data-role="chirp-composer"]');
  const textarea = overlay.querySelector('[data-role="chirp-input"]');
  const statusEl = overlay.querySelector('[data-role="chirp-status"]');
  const sendBtn = overlay.querySelector('[data-role="chirp-send"]');
  if (!composer || !textarea || !sendBtn) return;

  const message = textarea.value.trim();
  if (!message) {
    statusEl.textContent = 'Message cannot be empty.';
    statusEl.dataset.tone = 'error';
    return;
  }

  sendBtn.disabled = true;
  statusEl.textContent = 'Sending…';
  statusEl.dataset.tone = 'info';

  try {
    const cooldown = await loadChirpCooldown();
    if (cooldown?.canChirp && !cooldown.canChirp(activeTeamName)) {
      const ms = cooldown.chirpRemainingMs?.(activeTeamName) ?? 0;
      const seconds = Math.ceil(ms / 1000);
      throw new Error(`Chirp on cooldown. Try again in ${seconds}s.`);
    }

    await sendSpeedBumpChirp({
      fromTeam: activeTeamName,
      toTeam: effect.attackerTeam || effect.attacker,
      text: message
    });

    cooldown?.markChirp?.(activeTeamName);
    statusEl.textContent = 'Sent!';
    statusEl.dataset.tone = 'success';
    textarea.value = '';
    window.setTimeout(() => {
      composer.hidden = true;
      statusEl.textContent = '';
    }, 1000);
  } catch (err) {
    console.warn('⚠️ Chirp failed:', err);
    statusEl.textContent = err?.message || 'Failed to send. Try again.';
    statusEl.dataset.tone = 'error';
  } finally {
    sendBtn.disabled = false;
  }
}

function toggleChirpComposer(overlay, show) {
  const composer = overlay.querySelector('[data-role="chirp-composer"]');
  const textarea = overlay.querySelector('[data-role="chirp-input"]');
  const statusEl = overlay.querySelector('[data-role="chirp-status"]');
  if (!composer || !textarea) return;
  composer.hidden = !show;
  statusEl.textContent = '';
  if (show && !textarea.value) {
    textarea.value = getRandomTaunt('speedBump');
  }
  if (show) {
    textarea.focus();
  }
}

function bindOverlayEvents(overlay) {
  if (overlay.dataset.bound === 'true') return;
  overlay.dataset.bound = 'true';

  overlay.querySelector('[data-role="complete"]')?.addEventListener('click', () => {
    if (!latestEffect || latestEffect.releaseRequestedAt) return;
    handleChallengeComplete(latestEffect, overlay);
  });

  overlay.querySelector('[data-role="chirp"]')?.addEventListener('click', () => {
    const composer = overlay.querySelector('[data-role="chirp-composer"]');
    toggleChirpComposer(overlay, composer ? composer.hidden : true);
  });

  overlay.querySelector('[data-role="chirp-cancel"]')?.addEventListener('click', () => {
    toggleChirpComposer(overlay, false);
  });

  overlay.querySelector('[data-role="chirp-send"]')?.addEventListener('click', () => {
    if (!latestEffect) return;
    handleChirpSend(latestEffect, overlay);
  });
}

function applyFlavor(effectId) {
  if (!effectId) return getRandomSpeedBumpFlavor();
  if (!flavorCache.has(effectId)) {
    flavorCache.set(effectId, getRandomSpeedBumpFlavor());
  }
  return flavorCache.get(effectId);
}

function updateOverlay(effect) {
  const overlay = effect ? ensureOverlayElement() : document.getElementById('speedbump-overlay');

  if (!effect || !overlay) {
    latestEffect = null;
    flavorCache.clear();
    stopCountdown();
    hideOverlay('speedbump');
    return;
  }

  latestEffect = effect;
  const attackerInput = overlay.querySelector('[data-field="attacker"]');
  const emailInput = overlay.querySelector('[data-field="email"]');
  const phoneInput = overlay.querySelector('[data-field="phone"]');
  const challengeEl = overlay.querySelector('[data-role="challenge"]');
  const flavorEl = overlay.querySelector('[data-role="flavor"]');
  const completeBtn = overlay.querySelector('[data-role="complete"]');

  setInputValue(attackerInput, effect.attackerTeam || effect.attacker || 'Unknown');
  setInputValue(emailInput, effect.contactInfo?.email, 'Not provided');
  setInputValue(phoneInput, effect.contactInfo?.phone, 'Not provided');
  if (challengeEl) {
    challengeEl.textContent = effect.challenge || 'Complete your surprise challenge!';
  }
  if (flavorEl) {
    flavorEl.textContent = applyFlavor(effect.id);
  }

  const countdownTarget = effect.releaseAvailableAt || effect.expiresAt;
  startCountdown(countdownTarget, overlay);

  if (completeBtn) {
    if (effect.releaseRequestedAt) {
      completeBtn.textContent = '⏳ Release Pending';
      completeBtn.disabled = true;
      completeBtn.dataset.state = 'pending';
    } else {
      completeBtn.textContent = '✅ Challenge Complete';
      completeBtn.disabled = false;
      completeBtn.dataset.state = 'ready';
    }
  }

  setStatusMessage(overlay, effect.releaseRequestedAt ? 'Release timer running. Control will free you soon.' : 'Complete the challenge, then tap Challenge Complete to start the 5-minute timer.', effect.releaseRequestedAt ? 'info' : 'muted');

  showOverlay('speedbump');
}

function teardown(reason = 'manual') {
  stopCountdown();
  latestEffect = null;
  unsubscribeEffects?.(reason);
  unsubscribeState?.();
  unsubscribeEffects = null;
  unsubscribeState = null;
  activeTeamName = null;
  hideOverlay('speedbump');
}

export function ensureSpeedBumpOverlayListeners(options = {}) {
  const teamName = resolveTeamName(options.teamName);
  if (!teamName) {
    return () => {};
  }

  if (activeTeamName === teamName && unsubscribeEffects) {
    return (reason = 'manual') => teardown(reason);
  }

  teardown('handover');
  activeTeamName = teamName;
  unsubscribeEffects = ensureSpeedBumpEffectSubscription(teamName);
  unsubscribeState = onActiveEffectsChange((effects = []) => {
    const activeEffect = effects.find((entry) => entry?.type === 'speedBump');
    updateOverlay(activeEffect || null);
  }, { team: teamName });

  return (reason = 'manual') => teardown(reason);
}

export default { ensureSpeedBumpOverlayListeners };

// === AICP UI FOOTER ===
// ai_origin: ui/overlays/speedBumpOverlay.js
// ai_role: Presentation Layer
// aicp_category: ui
// aicp_version: 3.2
// codex_phase: tier4_ui_injection
// export_bridge: features
// exports: ensureSpeedBumpOverlayListeners
// linked_files: []
// owner: RouteRiot-AICP
// phase: active
// review_status: pending_alignment
// status: beta
// sync_state: aligned
// === END AICP UI FOOTER ===
