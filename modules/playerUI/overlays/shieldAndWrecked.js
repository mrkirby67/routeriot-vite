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
  if (duration <= 0) {
    hideShieldHudTimer();
    return;
  }

  const id = 'shield-hud';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText =
      'position:fixed;top:8px;right:8px;padding:6px 10px;background:#0b5;color:#fff;border-radius:6px;font-weight:600;z-index:9999;';
    document.body.appendChild(el);
  }

  shieldHudEndAt = Date.now() + duration;
  el.textContent = `🛡 Shield Wax: ${Math.ceil(duration / 1000)}s`;

  if (shieldHudIntervalId) {
    clearInterval(shieldHudIntervalId);
    shieldHudIntervalId = null;
  }

  shieldHudIntervalId = setInterval(() => {
    const remaining = Math.max(0, shieldHudEndAt - Date.now());
    if (remaining <= 0) {
      hideShieldHudTimer();
      return;
    }
    const hudEl = document.getElementById(id);
    if (!hudEl) {
      hideShieldHudTimer();
      return;
    }
    hudEl.textContent = `🛡 Shield Wax: ${Math.ceil(remaining / 1000)}s`;
  }, 500);
}

export function hideShieldHudTimer() {
  if (shieldHudIntervalId) {
    clearInterval(shieldHudIntervalId);
    shieldHudIntervalId = null;
  }
  shieldHudEndAt = 0;
  if (typeof document !== 'undefined') {
    document.getElementById('shield-hud')?.remove();
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
  if (typeof document === 'undefined' || !teamName) return;
  const duration = Math.max(0, Number(msRemaining) || 0);
  if (duration <= 0) {
    hideShieldTimer();
    return;
  }

  floatingShieldTeam = teamName;
  floatingShieldEndAt = Date.now() + duration;
  updateFloatingShieldOverlay(teamName, duration);

  if (floatingShieldIntervalId) {
    clearInterval(floatingShieldIntervalId);
    floatingShieldIntervalId = null;
  }

  floatingShieldIntervalId = setInterval(() => {
    const remaining = Math.max(0, floatingShieldEndAt - Date.now());
    if (remaining <= 0 || !floatingShieldTeam) {
      hideShieldTimer();
      return;
    }
    updateFloatingShieldOverlay(floatingShieldTeam, remaining);
  }, 1000);
}

export function hideShieldTimer() {
  if (floatingShieldIntervalId) {
    clearInterval(floatingShieldIntervalId);
    floatingShieldIntervalId = null;
  }
  floatingShieldTeam = null;
  floatingShieldEndAt = 0;
  if (floatingShieldOverlay) {
    floatingShieldOverlay.remove();
    floatingShieldOverlay = null;
  }
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
