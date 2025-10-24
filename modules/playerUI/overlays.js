// ============================================================================
// FILE: modules/playerUI/overlays.js
// PURPOSE: Pause/Game Over overlays + confetti animation
// ============================================================================

import { generateMiniMap } from '../zonesMap.js';
import { escapeHtml } from '../utils.js';

function $(id) {
  return document.getElementById(id);
}

export function showPausedOverlay() {
  if ($('paused-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'paused-overlay';
  overlay.innerHTML = `
    <div class="paused-message">
      ⏸️ Paused<br><small>Wait for host to resume...</small>
    </div>`;
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.85)', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontSize: '2.5rem', fontWeight: 'bold', zIndex: '5000',
    opacity: '0', transition: 'opacity 0.6s ease-in-out'
  });
  const styleTag = document.createElement('style');
  styleTag.textContent = `@keyframes pulse {0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.1);opacity:0.85;}}`;
  document.head.appendChild(styleTag);
  const msg = overlay.querySelector('.paused-message');
  if (msg) {
    msg.style.textAlign = 'center';
    msg.style.animation = 'pulse 1.5s infinite';
  }
  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));
}

export function hidePausedOverlay() {
  const overlay = $('paused-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 600);
  }
}

let speedBumpCountdownInterval = null;
let flatTireCountdownInterval = null;
let flatTireAutoReleaseTriggered = false;

export function showSpeedBumpOverlay({
  by,
  challenge,
  countdownMs,
  proofSent,
  onProof,
  onRelease
} = {}) {
  let overlay = document.getElementById('speedbump-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'speedbump-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.9)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '18px',
      zIndex: '6000',
      padding: '24px',
      textAlign: 'center',
      fontFamily: 'Montserrat, "Segoe UI", sans-serif'
    });

    const message = document.createElement('div');
    message.id = 'speedbump-overlay-message';
    message.style.maxWidth = '520px';
    message.style.fontSize = '1.2rem';
    message.style.lineHeight = '1.6';
    overlay.appendChild(message);

    const challengeEl = document.createElement('div');
    challengeEl.id = 'speedbump-overlay-challenge';
    challengeEl.style.fontWeight = '600';
    challengeEl.style.fontSize = '1rem';
    challengeEl.style.background = 'rgba(255, 183, 77, 0.1)';
    challengeEl.style.border = '1px solid rgba(255, 183, 77, 0.35)';
    challengeEl.style.borderRadius = '10px';
    challengeEl.style.padding = '12px 16px';
    challengeEl.style.maxWidth = '520px';
    overlay.appendChild(challengeEl);

    const countdown = document.createElement('div');
    countdown.id = 'speedbump-overlay-countdown';
    countdown.style.fontSize = '1.5rem';
    countdown.style.fontWeight = '700';
    countdown.style.color = '#ffeb3b';
    overlay.appendChild(countdown);

    const buttonRow = document.createElement('div');
    buttonRow.id = 'speedbump-overlay-actions';
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '12px';
    buttonRow.style.flexWrap = 'wrap';
    buttonRow.style.justifyContent = 'center';

    const proofBtn = document.createElement('button');
    proofBtn.id = 'speedbump-proof-btn';
    proofBtn.textContent = '📸 Proof Sent';
    Object.assign(proofBtn.style, primaryButtonStyle('#66bb6a', '#0c2d10'));
    buttonRow.appendChild(proofBtn);

    const releaseBtn = document.createElement('button');
    releaseBtn.id = 'speedbump-release-btn';
    releaseBtn.textContent = '🟢 Release Me';
    Object.assign(releaseBtn.style, primaryButtonStyle('#ffb74d', '#1a1200'));
    buttonRow.appendChild(releaseBtn);

    overlay.appendChild(buttonRow);

    const note = document.createElement('div');
    note.id = 'speedbump-overlay-note';
    note.style.fontSize = '0.9rem';
    note.style.color = '#bbb';
    overlay.appendChild(note);

    document.body.appendChild(overlay);
  }

  const senderLabel = by ? `by ${by}` : 'by another team';
  const message = document.getElementById('speedbump-overlay-message');
  const challengeEl = document.getElementById('speedbump-overlay-challenge');
  const countdownEl = document.getElementById('speedbump-overlay-countdown');
  const proofBtn = document.getElementById('speedbump-proof-btn');
  const releaseBtn = document.getElementById('speedbump-release-btn');
  const note = document.getElementById('speedbump-overlay-note');

  if (message) {
    message.textContent = `🚧 You're Speed Bumped ${senderLabel}!`;
  }

  if (challengeEl) {
    challengeEl.innerHTML = `<strong>Challenge:</strong> ${challenge || 'Complete your photo challenge!'}`;
  }

  if (note) {
    note.textContent = `Send your proof photo to ${by || 'the sending team'} via text or email, then confirm below.`;
  }

  if (proofBtn) {
    proofBtn.disabled = !!proofSent;
    proofBtn.style.opacity = proofBtn.disabled ? '0.6' : '1';
    proofBtn.onclick = async () => {
      if (proofBtn.disabled) return;
      proofBtn.disabled = true;
      proofBtn.style.opacity = '0.6';
      try {
        await onProof?.();
      } catch (err) {
        console.error('Speed bump proof action failed:', err);
        proofBtn.disabled = false;
        proofBtn.style.opacity = '1';
      }
    };
  }

  if (releaseBtn) {
    const canRelease = !!proofSent && (!countdownMs || countdownMs <= 0);
    releaseBtn.disabled = !canRelease;
    releaseBtn.style.opacity = canRelease ? '1' : '0.6';
    releaseBtn.onclick = async () => {
      if (releaseBtn.disabled) return;
      releaseBtn.disabled = true;
      releaseBtn.style.opacity = '0.6';
      try {
        await onRelease?.();
      } catch (err) {
        console.error('Speed bump release failed:', err);
        releaseBtn.disabled = false;
        releaseBtn.style.opacity = canRelease ? '1' : '0.6';
      }
    };
  }

  if (speedBumpCountdownInterval) {
    clearInterval(speedBumpCountdownInterval);
    speedBumpCountdownInterval = null;
  }

  if (countdownEl) {
    if (proofSent && countdownMs && countdownMs > 0) {
      const target = Date.now() + countdownMs;
      const updateCountdown = () => {
        const remaining = Math.max(0, target - Date.now());
        countdownEl.textContent = `📸 Proof timer: ${formatMMSS(Math.ceil(remaining / 1000))}`;
        if (remaining <= 0) {
          clearInterval(speedBumpCountdownInterval);
          speedBumpCountdownInterval = null;
          countdownEl.textContent = '📸 Proof timer finished. You may self-release if not already freed.';
          if (releaseBtn) {
            releaseBtn.disabled = false;
            releaseBtn.style.opacity = '1';
          }
        }
      };
      updateCountdown();
      speedBumpCountdownInterval = setInterval(updateCountdown, 1000);
    } else if (proofSent && (!countdownMs || countdownMs <= 0)) {
      countdownEl.textContent = '📸 Proof timer finished. You may self-release if not already freed.';
    } else {
      countdownEl.textContent = '📸 Awaiting photo proof to begin the countdown.';
    }
  }

  overlay.style.display = 'flex';
}

export function hideSpeedBumpOverlay() {
  const overlay = document.getElementById('speedbump-overlay');
  if (overlay) overlay.style.display = 'none';
  if (speedBumpCountdownInterval) {
    clearInterval(speedBumpCountdownInterval);
    speedBumpCountdownInterval = null;
  }
}

function primaryButtonStyle(background, textColor) {
  return {
    padding: '10px 22px',
    borderRadius: '999px',
    border: 'none',
    background,
    color: textColor,
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'transform 0.1s ease, box-shadow 0.1s ease'
  };
}

function ensureFlatTireOverlay() {
  let overlay = document.getElementById('flat-tire-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'flat-tire-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.92)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: '6100',
    opacity: '0',
    transition: 'opacity 0.25s ease'
  });

  const panel = document.createElement('div');
  panel.id = 'flat-tire-panel';
  Object.assign(panel.style, {
    background: 'rgba(18,18,18,0.9)',
    borderRadius: '16px',
    border: '1px solid rgba(129, 212, 250, 0.35)',
    padding: '24px',
    maxWidth: '520px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 14px 32px rgba(0,0,0,0.45)',
    fontFamily: 'Montserrat, "Segoe UI", sans-serif'
  });

  panel.innerHTML = `
    <h2 style="margin:0;font-size:1.4rem;color:#81d4fa;">🚗 Flat Tire — Tow Time</h2>
    <p id="flat-tire-message" style="margin:0;color:#e0f7fa;font-size:1rem;line-height:1.5;"></p>
    <div id="flat-tire-map" style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,183,77,0.35);min-height:160px;"></div>
    <div id="flat-tire-countdown" style="font-size:1.4rem;font-weight:700;color:#ffeb3b;text-align:center;"></div>
    <div id="flat-tire-distance" style="font-size:0.95rem;color:#b0bec5;text-align:center;"></div>
    <div id="flat-tire-actions" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
      <button id="flat-tire-checkin-btn" style="padding:10px 18px;border-radius:999px;border:none;font-weight:600;background:#64b5f6;color:#032b44;cursor:pointer;">📍 Check-In</button>
      <button id="flat-tire-release-btn" style="padding:10px 18px;border-radius:999px;border:none;font-weight:600;background:#a5d6a7;color:#09311a;cursor:pointer;">✅ Tow Complete</button>
    </div>
    <small id="flat-tire-note" style="text-align:center;color:#90a4ae;">Tow crews auto-release 20 minutes after dispatch.</small>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));
  return overlay;
}

export function showFlatTireOverlay({
  zoneName = 'Tow Zone',
  gps = '',
  status = 'assigned',
  distanceRemainingKm = null,
  autoReleaseAtMs = null,
  assignedAtMs = null,
  onCheckIn,
  onManualRelease,
  onAutoRelease
} = {}) {
  const overlay = ensureFlatTireOverlay();
  const message = overlay.querySelector('#flat-tire-message');
  const mapWrapper = overlay.querySelector('#flat-tire-map');
  const countdownEl = overlay.querySelector('#flat-tire-countdown');
  const distanceEl = overlay.querySelector('#flat-tire-distance');
  const checkInBtn = overlay.querySelector('#flat-tire-checkin-btn');
  const releaseBtn = overlay.querySelector('#flat-tire-release-btn');

  flatTireAutoReleaseTriggered = false;

  if (message) {
    const statusCopy = status?.toLowerCase().startsWith('enroute')
      ? 'Support crew is tracking your approach.'
      : 'Repair crews are rolling out. Stay put!';
    message.innerHTML = `${statusCopy}<br><strong>Assigned Zone:</strong> ${escapeHtml(zoneName)}`;
  }

  if (mapWrapper) {
    if (gps) {
      mapWrapper.innerHTML = generateMiniMap({
        name: zoneName,
        gps,
        diameter: 0.2
      });
    } else {
      mapWrapper.innerHTML = `<div style="padding:24px;text-align:center;color:#b0bec5;">No GPS configured for this tow zone.</div>`;
    }
  }

  if (distanceEl) {
    distanceEl.textContent = typeof distanceRemainingKm === 'number'
      ? `Distance remaining: ${distanceRemainingKm.toFixed(1)} km`
      : 'Tap “Check-In” to report how far you are from the tow zone.';
  }

  if (checkInBtn) {
    checkInBtn.disabled = false;
    checkInBtn.onclick = () => {
      if (checkInBtn.disabled) return;
      checkInBtn.disabled = true;
      Promise.resolve(onCheckIn?.())
        .catch(() => {})
        .finally(() => { checkInBtn.disabled = false; });
    };
  }

  const triggerAutoRelease = () => {
    if (flatTireAutoReleaseTriggered) return;
    flatTireAutoReleaseTriggered = true;
    Promise.resolve(onAutoRelease?.()).catch(err => {
      console.error('Flat Tire auto-release failed:', err);
    });
  };

  if (releaseBtn) {
    releaseBtn.disabled = true;
    releaseBtn.onclick = () => {
      if (releaseBtn.disabled) return;
      releaseBtn.disabled = true;
      Promise.resolve(onManualRelease?.())
        .then(() => hideFlatTireOverlay())
        .catch(err => {
          console.error('Flat Tire release failed:', err);
          releaseBtn.disabled = false;
        });
    };
  }

  if (flatTireCountdownInterval) {
    clearInterval(flatTireCountdownInterval);
    flatTireCountdownInterval = null;
  }

  const fallbackAutoRelease = assignedAtMs
    ? assignedAtMs + 20 * 60_000
    : Date.now() + 20 * 60_000;
  const targetMs = autoReleaseAtMs || fallbackAutoRelease;

  const updateCountdown = () => {
    const remaining = targetMs - Date.now();
    if (!countdownEl) return;

    if (remaining <= 0) {
      countdownEl.textContent = 'Tow window complete — you may rejoin the race!';
      if (releaseBtn) releaseBtn.disabled = false;
      triggerAutoRelease();
      clearInterval(flatTireCountdownInterval);
      flatTireCountdownInterval = null;
      return;
    }

    countdownEl.textContent = `Auto release in ${formatMMSS(Math.ceil(remaining / 1000))}`;
    if (releaseBtn) releaseBtn.disabled = true;
  };

  updateCountdown();
  flatTireCountdownInterval = setInterval(updateCountdown, 1000);
}

export function hideFlatTireOverlay() {
  const overlay = document.getElementById('flat-tire-overlay');
  if (!overlay) return;
  if (flatTireCountdownInterval) {
    clearInterval(flatTireCountdownInterval);
    flatTireCountdownInterval = null;
  }
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 250);
}

function formatMMSS(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function showGameOverOverlay() {
  if ($('gameover-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'gameover-overlay';
  overlay.innerHTML = `
    <div class="finish-message">🏁 GAME OVER<br><small>Return to base!</small></div>
    <canvas id="confetti-canvas"></canvas>`;
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.9)', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontSize: '3rem', fontWeight: 'bold', zIndex: '6000',
    opacity: '0', transition: 'opacity 0.8s ease-in-out'
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));
  startConfetti();
  setTimeout(stopConfetti, 7000);
}

let confettiActive = false;
let confettiPieces = [];
let confettiAnimation;

export function startConfetti() {
  if (confettiActive) return;
  confettiActive = true;

  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    Object.assign(canvas.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '99998'
    });
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    'hsl(0, 100%, 60%)',
    'hsl(30, 100%, 60%)',
    'hsl(60, 100%, 60%)',
    'hsl(120, 100%, 60%)',
    'hsl(200, 100%, 60%)',
    'hsl(280, 100%, 70%)'
  ];

  confettiPieces = Array.from({ length: 250 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: 4 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: 1 + Math.random() * 3,
    opacity: 1,
    drift: (Math.random() - 0.5) * 1.5,
    hueShift: Math.random() * 360
  }));

  function draw() {
    if (!confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confettiPieces.forEach((p) => {
      p.hueShift = (p.hueShift + 2) % 360;
      const hueColor = `hsl(${p.hueShift}, 100%, 65%)`;

      p.opacity -= 0.002;
      if (p.opacity < 0.2) p.opacity = 1;

      ctx.fillStyle = hueColor;
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      p.y += p.speed;
      p.x += p.drift;
      if (p.y > canvas.height) p.y = -10;
      if (p.x > canvas.width) p.x = 0;
      if (p.x < 0) p.x = canvas.width;
    });

    confettiAnimation = requestAnimationFrame(draw);
  }

  draw();
  console.log('🎆 Sparkling confetti started!');
}

export function stopConfetti() {
  if (!confettiActive) return;
  confettiActive = false;

  cancelAnimationFrame(confettiAnimation);
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    canvas.style.transition = 'opacity 0.8s ease';
    canvas.style.opacity = '0';
    setTimeout(() => canvas.remove(), 1000);
  }
  console.log('✨ Confetti stopped.');
}
