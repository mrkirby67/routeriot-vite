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

    overlay.appendChild(buttonRow);

    const chirpRow = document.createElement('div');
    chirpRow.id = 'speedbump-chirp-row';
    chirpRow.className = 'chirp-row speedbump-chirp-box';

    const chirpLabel = document.createElement('label');
    chirpLabel.setAttribute('for', 'sb-chirp-input');
    chirpLabel.textContent = '🗯 Express your opinion (1 msg/min)';
    chirpRow.appendChild(chirpLabel);

    const chirpInput = document.createElement('input');
    chirpInput.id = 'sb-chirp-input';
    chirpInput.type = 'text';
    chirpInput.maxLength = 140;
    chirpInput.placeholder = 'Roast the bumpers… or leave blank for a random zinger';
    chirpRow.appendChild(chirpInput);

    const chirpButton = document.createElement('button');
    chirpButton.id = 'sb-chirp-send';
    chirpButton.textContent = 'Send';
    chirpRow.appendChild(chirpButton);

    overlay.appendChild(chirpRow);

    const note = document.createElement('div');
    note.id = 'speedbump-overlay-note';
    note.style.fontSize = '0.9rem';
    note.style.color = '#bbb';
    overlay.appendChild(note);

    document.body.appendChild(overlay);
  }

  const cleanSender = typeof by === 'string' ? by.trim() : '';
  const senderLabel = cleanSender ? `by ${cleanSender}` : 'by another team';
  const message = document.getElementById('speedbump-overlay-message');
  const challengeEl = document.getElementById('speedbump-overlay-challenge');
  const countdownEl = document.getElementById('speedbump-overlay-countdown');
  const proofBtn = document.getElementById('speedbump-proof-btn');
  const chirpInput = document.getElementById('sb-chirp-input');
  const chirpBtn = document.getElementById('sb-chirp-send');
  const note = document.getElementById('speedbump-overlay-note');

  if (message) {
    message.textContent = `🚧 You're Speed Bumped ${senderLabel}!`;
  }

  if (challengeEl) {
    const safeChallenge = escapeHtml(challenge || 'Complete your photo challenge!');
    challengeEl.innerHTML = `<strong>Challenge:</strong> ${safeChallenge}`;
  }

  if (note) {
    const recipientLabel = escapeHtml(cleanSender || 'the sending team');
    note.innerHTML = `Send your proof photo to <strong>${recipientLabel}</strong>, then chirp them while you wait. Auto release follows the proof timer if they stall.`;
  }

  if (chirpBtn) {
    if (typeof onChirp !== 'function') {
      chirpBtn.disabled = true;
      chirpBtn.title = 'Chirp unavailable right now.';
    } else {
      chirpBtn.disabled = false;
      chirpBtn.title = '';
      chirpBtn.onclick = async () => {
        if (chirpBtn.disabled) return;
        const value = chirpInput?.value || '';
        chirpBtn.disabled = true;
        const reset = () => {
          chirpBtn.textContent = 'Send';
          chirpBtn.disabled = false;
        };
        try {
          chirpBtn.textContent = 'Sending…';
          const result = await onChirp(value);
          if (result?.ok) {
            if (chirpInput) chirpInput.value = '';
            chirpBtn.textContent = 'Sent!';
            setTimeout(reset, 1400);
          } else if (result?.reason === 'rate_limited') {
            chirpBtn.textContent = 'Too Soon';
            chirpBtn.title = 'You can chirp once per minute.';
            setTimeout(() => {
              chirpBtn.title = '';
              reset();
            }, 1600);
          } else {
            chirpBtn.textContent = 'Try Again';
            setTimeout(reset, 1400);
          }
        } catch (err) {
          console.error('❌ Speed bump chirp failed:', err);
          chirpBtn.textContent = 'Error';
          setTimeout(reset, 1400);
        }
      };
    }
  }

  if (chirpInput) {
    chirpInput.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        chirpBtn?.click();
      }
    };
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
          countdownEl.textContent = '📸 Proof timer finished. Auto release should trigger shortly.';
        }
      };
      updateCountdown();
      speedBumpCountdownInterval = setInterval(updateCountdown, 1000);
    } else if (proofSent && (!countdownMs || countdownMs <= 0)) {
      countdownEl.textContent = '📸 Proof timer finished. Auto release should trigger shortly.';
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
  overlay.classList.add('flat-tire-overlay');
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
    <p id="flat-tire-blurb" class="ft-blurb"></p>
    <div id="flat-tire-map" style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,183,77,0.35);min-height:160px;"></div>
    <div id="flat-tire-chirp-row" class="chirp-row">
      <label for="ft-chirp-input">🗯 Express your opinion (1 msg/min)</label>
      <input id="ft-chirp-input" type="text" maxlength="140" placeholder="Type a chirp… or leave blank for a random zinger" />
      <button id="ft-chirp-send">Send</button>
    </div>
    <div id="flat-tire-countdown" style="font-size:1.4rem;font-weight:700;color:#ffeb3b;text-align:center;"></div>
    <div id="flat-tire-distance" style="font-size:0.95rem;color:#b0bec5;text-align:center;"></div>
    <div id="flat-tire-actions" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
      <button id="flat-tire-checkin-btn" style="padding:10px 18px;border-radius:999px;border:none;font-weight:600;background:#64b5f6;color:#032b44;cursor:pointer;">📍 Check-In</button>
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
  depotId = '',
  gps = '',
  lat = null,
  lng = null,
  diameterMeters = 200,
  status = 'assigned',
  distanceRemainingKm = null,
  autoReleaseAtMs = null,
  assignedAtMs = null,
  assignedBy = '',
  onCheckIn,
  onManualRelease,
  onAutoRelease,
  onChirp
} = {}) {
  const overlay = ensureFlatTireOverlay();
  document.body.classList.add('overlay-active');
  const message = overlay.querySelector('#flat-tire-message');
  const blurbEl = overlay.querySelector('#flat-tire-blurb');
  const mapWrapper = overlay.querySelector('#flat-tire-map');
  const countdownEl = overlay.querySelector('#flat-tire-countdown');
  const distanceEl = overlay.querySelector('#flat-tire-distance');
  const checkInBtn = overlay.querySelector('#flat-tire-checkin-btn');
  const noteEl = overlay.querySelector('#flat-tire-note');
  const chirpInput = overlay.querySelector('#ft-chirp-input');
  const chirpBtn = overlay.querySelector('#ft-chirp-send');
  const cleanAssignedBy = typeof assignedBy === 'string' ? assignedBy.trim() : '';

  flatTireAutoReleaseTriggered = false;

  if (message) {
    const statusLabel = typeof status === 'string' ? status.toLowerCase() : '';
    const statusCopy = statusLabel.startsWith('enroute')
      ? 'Support crew is tracking your approach.'
      : 'Repair crews are rolling out. Stay put!';
    const zoneLabel = escapeHtml(zoneName);
    const assignedLabel = cleanAssignedBy
      ? `<br><em>Tagged by ${escapeHtml(cleanAssignedBy)}</em>`
      : '';
    message.innerHTML = `${statusCopy}<br><strong>Assigned Zone:</strong> ${zoneLabel}${assignedLabel}`;
  }

  if (blurbEl) {
    const depotKey = (depotId || zoneName || '').toString().toLowerCase();
    let depotBlurb = 'Ahh shoot! You got a flat—head to the repair depot shown below.';
    if (depotKey.includes('north')) {
      depotBlurb = 'Dang! You popped a tire. Slap on that donut and roll to the North Depot!';
    } else if (depotKey.includes('south')) {
      depotBlurb = 'Well butter my biscuit—you’ve got a flat! South Depot’s calling your name.';
    } else if (depotKey.includes('east')) {
      depotBlurb = 'Yikes, that rim’s singing. Glide (slowly) to the East Depot for a quick fix.';
    } else if (depotKey.includes('west')) {
      depotBlurb = 'That thump-thump ain’t the bass. West Depot’s where the rubber meets repairs.';
    }
    blurbEl.textContent = depotBlurb;
  }

  if (mapWrapper) {
    if (gps) {
      const diameterKm = Math.max(0, Number(diameterMeters) || 200) / 1000;
      mapWrapper.innerHTML = generateMiniMap({
        name: zoneName,
        gps,
        diameter: diameterKm || 0.2
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

  if (noteEl) {
    const noteTarget = escapeHtml(cleanAssignedBy || 'Game Control');
    noteEl.innerHTML = `Tow crews auto-release <strong>20 minutes</strong> after dispatch. Chirp ${noteTarget} if you need backup.`;
  }

  if (chirpBtn) {
    if (typeof onChirp !== 'function') {
      chirpBtn.disabled = true;
      chirpBtn.title = 'Chirp unavailable right now.';
    } else {
      chirpBtn.disabled = false;
      chirpBtn.title = '';
      chirpBtn.onclick = async () => {
        if (chirpBtn.disabled) return;
        const value = chirpInput?.value || '';
        chirpBtn.disabled = true;
        const reset = () => {
          chirpBtn.textContent = 'Send';
          chirpBtn.disabled = false;
        };
        try {
          chirpBtn.textContent = 'Sending…';
          const result = await onChirp(value);
          if (result?.ok) {
            if (chirpInput) chirpInput.value = '';
            chirpBtn.textContent = 'Sent!';
            setTimeout(reset, 1400);
          } else if (result?.reason === 'rate_limited') {
            chirpBtn.textContent = 'Too Soon';
            chirpBtn.title = 'You can chirp once per minute.';
            setTimeout(() => {
              chirpBtn.title = '';
              reset();
            }, 1600);
          } else {
            chirpBtn.textContent = 'Try Again';
            setTimeout(reset, 1400);
          }
        } catch (err) {
          console.error('❌ Flat Tire chirp failed:', err);
          chirpBtn.textContent = 'Error';
          setTimeout(reset, 1400);
        }
      };
    }
  }

  if (chirpInput) {
    chirpInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        chirpBtn?.click();
      }
    });
  }

  const triggerAutoRelease = () => {
    if (flatTireAutoReleaseTriggered) return;
    flatTireAutoReleaseTriggered = true;
    Promise.resolve(onAutoRelease?.()).catch(err => {
      console.error('Flat Tire auto-release failed:', err);
    });
  };

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
      countdownEl.textContent = 'Tow window complete — auto release triggered!';
      triggerAutoRelease();
      clearInterval(flatTireCountdownInterval);
      flatTireCountdownInterval = null;
      return;
    }

    countdownEl.textContent = `Auto release in ${formatMMSS(Math.ceil(remaining / 1000))}`;
  };

  updateCountdown();
  flatTireCountdownInterval = setInterval(updateCountdown, 1000);
}

export function hideFlatTireOverlay() {
  const overlay = document.getElementById('flat-tire-overlay');
  if (!overlay) {
    clearFlatTireOverlay();
    return;
  }
  overlay.style.opacity = '0';
  setTimeout(() => clearFlatTireOverlay(), 250);
}

function formatMMSS(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// =========================================================
// 🛞 Tire Celebration Animation
// =========================================================
export function showTireCelebration() {
  const container = document.createElement('div');
  container.classList.add('tire-celebration');
  document.body.appendChild(container);

  for (let i = 0; i < 8; i++) {
    const tire = document.createElement('div');
    tire.classList.add('tire-emoji');
    tire.textContent = '🛞';
    tire.style.left = `${Math.random() * 90}%`;
    tire.style.animationDelay = `${Math.random() * 0.6}s`;
    container.appendChild(tire);
  }

  setTimeout(() => {
    container.classList.add('fade-out');
    setTimeout(() => container.remove(), 1500);
  }, 2500);
}

// =========================================================
// 💨 Helper to remove Flat Tire overlay cleanly
// =========================================================
export function clearFlatTireOverlay() {
  const overlay = document.getElementById('flat-tire-overlay');
  if (flatTireCountdownInterval) {
    clearInterval(flatTireCountdownInterval);
    flatTireCountdownInterval = null;
  }
  if (overlay) {
    overlay.remove();
  }
  document.body.classList.remove('overlay-active');
  console.log('🧹 Flat Tire overlay cleared.');
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

let shieldTimerEl = null;
let shieldInterval = null;

export function showShieldHudTimer(msRemaining = 0) {
  const duration = Math.max(0, Number(msRemaining) || 0);
  if (duration <= 0) {
    hideShieldHudTimer();
    return;
  }

  if (!shieldTimerEl) {
    shieldTimerEl = document.createElement('div');
    shieldTimerEl.id = 'shield-hud-timer';
    shieldTimerEl.style.cssText = [
      'position:sticky',
      'top:0',
      'z-index:20',
      'background:#0b5',
      'color:#fff',
      'padding:4px 10px',
      'border-radius:6px',
      'display:inline-block',
      'margin-bottom:8px',
      'font-weight:600',
      'letter-spacing:0.4px'
    ].join(';');

    const statusEl = document.getElementById('game-status');
    if (statusEl?.parentNode) {
      statusEl.parentNode.insertBefore(shieldTimerEl, statusEl);
    } else {
      document.body.insertBefore(shieldTimerEl, document.body.firstChild);
    }
  }

  const endAt = Date.now() + duration;
  updateShieldHud(endAt);
  clearInterval(shieldInterval);
  shieldInterval = window.setInterval(() => updateShieldHud(endAt), 500);
}

export function hideShieldHudTimer() {
  if (shieldInterval) {
    clearInterval(shieldInterval);
    shieldInterval = null;
  }
  if (shieldTimerEl) {
    shieldTimerEl.remove();
    shieldTimerEl = null;
  }
}

function updateShieldHud(endAt) {
  const remaining = Math.max(0, endAt - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  if (!shieldTimerEl) return;
  shieldTimerEl.textContent = remaining > 0
    ? `🛡️ SHIELD Wax active: ${seconds}s`
    : '🛡️ SHIELD Wax expired';
  if (remaining <= 0) {
    hideShieldHudTimer();
  }
}

let floatingShieldOverlay = null;
let floatingShieldInterval = null;
let floatingShieldEndAt = 0;
let floatingShieldTeam = null;

function updateFloatingShieldOverlay(teamName, remainingMs) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  if (!floatingShieldOverlay) {
    floatingShieldOverlay = document.createElement('div');
    floatingShieldOverlay.className = 'shield-timer-overlay';
    document.body.appendChild(floatingShieldOverlay);
  }
  floatingShieldOverlay.dataset.team = teamName || '';
  floatingShieldOverlay.textContent = `🛡️ Shield Wax active – ${seconds}s remaining`;
}

export function showShieldTimer(teamName, msRemaining = 0) {
  if (!teamName) return;
  const duration = Math.max(0, Number(msRemaining) || 0);
  if (duration <= 0) {
    hideShieldTimer();
    return;
  }

  const endAt = Date.now() + duration;
  floatingShieldTeam = teamName;
  floatingShieldEndAt = endAt;
  updateFloatingShieldOverlay(teamName, duration);

  if (floatingShieldInterval) {
    clearInterval(floatingShieldInterval);
    floatingShieldInterval = null;
  }

  floatingShieldInterval = window.setInterval(() => {
    const remaining = Math.max(0, floatingShieldEndAt - Date.now());
    if (remaining <= 0 || !floatingShieldTeam) {
      hideShieldTimer();
      return;
    }
    updateFloatingShieldOverlay(floatingShieldTeam, remaining);
  }, 1000);
}

export function hideShieldTimer() {
  if (floatingShieldInterval) {
    clearInterval(floatingShieldInterval);
    floatingShieldInterval = null;
  }
  floatingShieldTeam = null;
  floatingShieldEndAt = 0;
  if (floatingShieldOverlay) {
    floatingShieldOverlay.remove();
    floatingShieldOverlay = null;
  }
}

// =========================================================
// 💥 WRECKED OVERLAY
// =========================================================
export function showWreckedOverlay(teamA, teamB, teamC) {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector('.wrecked-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'wrecked-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(5, 5, 5, 0.85)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '14px',
    textAlign: 'center',
    zIndex: '9000',
    fontFamily: 'Montserrat, "Segoe UI", sans-serif'
  });

  let counter = 10;
  overlay.innerHTML = `<h1 style="font-size:3rem;margin:0;">💥 WRECKED!</h1>
    <p>Team ${escapeHtml(teamA || '?')} needs to keep both hands on the wheel!</p>
    <p>Team ${escapeHtml(teamC || '?')} just got WRECKED — instant karma!</p>
    <p>Countdown: <span id="wrecked-count">${counter}</span>s</p>`;

  document.body.appendChild(overlay);

  const interval = window.setInterval(() => {
    counter -= 1;
    const el = document.getElementById('wrecked-count');
    if (el) el.textContent = Math.max(counter, 0);
    if (counter <= 0) {
      window.clearInterval(interval);
      overlay.remove();
    }
  }, 1000);
}
