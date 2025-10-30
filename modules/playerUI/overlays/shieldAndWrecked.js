// ============================================================================
// SHIELD & WRECKED OVERLAYS
// ============================================================================
import { escapeHtml } from '../../utils.js';

let shieldHudIntervalId = null;
let shieldHudEndAt = 0;

let floatingShieldOverlay = null;
let floatingShieldIntervalId = null;
let floatingShieldEndAt = 0;
let floatingShieldTeam = null;

export function showShieldHudTimer(ms = 0) {
  if (typeof document === 'undefined') return;
  const duration = Math.max(0, Number(ms) || 0);

  hideShieldHudTimer(); // Clear any existing timer

  if (duration <= 0) {
    return;
  }

  const timerDisplay = document.getElementById('timer-display');
  if (!timerDisplay?.parentElement) return;

  const container = timerDisplay.parentElement.parentElement;
  if (!container) return;

  const p = document.createElement('p');
  p.id = 'shield-timer-display';
  p.innerHTML = `<strong>Shield Active:</strong> <span id="shield-timer-value"></span>`;
  container.appendChild(p);

  const valueSpan = document.getElementById('shield-timer-value');
  shieldHudEndAt = Date.now() + duration;

  const updateTimer = () => {
    const remaining = Math.max(0, shieldHudEndAt - Date.now());
    if (remaining <= 0) {
      hideShieldHudTimer();
      return;
    }
    if (valueSpan) {
      valueSpan.textContent = `${Math.ceil(remaining / 1000)}s`;
    }
  };

  if (shieldHudIntervalId) {
    clearInterval(shieldHudIntervalId);
  }

  updateTimer();
  shieldHudIntervalId = setInterval(updateTimer, 500);
}

export function hideShieldHudTimer() {
  if (shieldHudIntervalId) {
    clearInterval(shieldHudIntervalId);
    shieldHudIntervalId = null;
  }
  shieldHudEndAt = 0;
  if (typeof document !== 'undefined') {
    document.getElementById('shield-timer-display')?.remove();
  }
}

function updateFloatingShieldOverlay(teamName, remainingMs) {
  if (typeof document === 'undefined') return;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  if (!floatingShieldOverlay) {
    floatingShieldOverlay = document.createElement('div');
    floatingShieldOverlay.className = 'shield-timer-overlay';
    floatingShieldOverlay.style.cssText =
      'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(9,55,38,0.9);color:#fff;padding:8px 16px;border-radius:999px;font-weight:600;z-index:9500;';
    document.body.appendChild(floatingShieldOverlay);
  }
  floatingShieldOverlay.dataset.team = teamName || '';
  floatingShieldOverlay.textContent = `🛡 ${teamName} Shield Wax – ${seconds}s remaining`;
}

export function showShieldTimer(teamName, msRemaining = 0) {
  // This floating overlay is disabled per user request.
}

export function hideShieldTimer() {
  // This floating overlay is disabled per user request.
}

export function showWreckedOverlay(attacker, victim, karma) {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector('.wrecked-overlay');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'wrecked-overlay';
  Object.assign(el.style, {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5,5,5,0.85)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
    textAlign: 'center',
    gap: '10px'
  });

  let counter = 10;
  el.innerHTML = `
    <h1 style="font-size:3rem;margin:0;">💥 WRECKED!</h1>
    <p>Team ${escapeHtml(attacker || '?')} and ${escapeHtml(victim || '?')} need to keep both hands on the wheel!</p>
    <p>Instant Karma hit ${escapeHtml(karma || '?')}!</p>
    <p>Countdown: <span id="wrecked-count">${counter}</span>s</p>
  `;

  document.body.appendChild(el);

  const intervalId = setInterval(() => {
    counter -= 1;
    const span = document.getElementById('wrecked-count');
    if (span) span.textContent = String(Math.max(counter, 0));
    if (counter <= 0) {
      clearInterval(intervalId);
      el.remove();
    }
  }, 1000);
}
