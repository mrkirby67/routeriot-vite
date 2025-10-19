// ============================================================================
// MODULE: gameUI.js
// Purpose: Provides visual feedback elements (timers, banners, messages)
// Used by both Control and Player interfaces
// ============================================================================

let timerInterval = null;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// ⏱️ COUNTDOWN TIMER (to a fixed end time)
// ---------------------------------------------------------------------------
export function startCountdownTimer(endTime) {
  const timerEl = $('player-timer');
  if (!timerEl || !endTime) return;

  clearElapsedTimer();

  const end =
    endTime?.seconds ? new Date(endTime.seconds * 1000) :
    endTime instanceof Date ? endTime :
    new Date(endTime);

  timerInterval = setInterval(() => {
    const remaining = end.getTime() - Date.now();
    if (remaining <= 0) {
      timerEl.textContent = "00:00:00";
      clearInterval(timerInterval);
      return;
    }

    const hrs  = String(Math.floor((remaining / 3600000) % 24)).padStart(2, '0');
    const mins = String(Math.floor((remaining / 60000) % 60)).padStart(2, '0');
    const secs = String(Math.floor((remaining / 1000) % 60)).padStart(2, '0');
    timerEl.textContent = `${hrs}:${mins}:${secs}`;
  }, 1000);
}

// ---------------------------------------------------------------------------
// ⏱️ ELAPSED TIMER (counting up from a start time)
// ---------------------------------------------------------------------------
export function startElapsedTimer(startTime) {
  const timerEl = $('player-timer');
  if (!timerEl || !startTime) return;

  clearElapsedTimer();

  const start =
    startTime?.seconds ? new Date(startTime.seconds * 1000) :
    startTime instanceof Date ? startTime :
    new Date(startTime);

  timerInterval = setInterval(() => {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
    const hrs  = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
    const mins = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    timerEl.textContent = `${hrs}:${mins}:${secs}`;
  }, 1000);
}

// ---------------------------------------------------------------------------
// 🧹 CLEAR TIMER DISPLAY
// ---------------------------------------------------------------------------
export function clearElapsedTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  const timerEl = $('player-timer');
  if (timerEl) timerEl.textContent = '--:--:--';
}

// ---------------------------------------------------------------------------
// ⚡ FLASH MESSAGE (top banner)
// ---------------------------------------------------------------------------
export function showFlashMessage(message, color = '#03dac6', duration = 3000) {
  const existing = document.getElementById('flash-message');
  if (existing) existing.remove();

  const flash = document.createElement('div');
  flash.id = 'flash-message';
  flash.textContent = message;
  Object.assign(flash.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    background: color,
    color: '#000',
    textAlign: 'center',
    padding: '16px',
    fontSize: '1.2em',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
    zIndex: '5000',
    transform: 'translateY(-100%)',
    transition: 'transform 0.4s ease-in-out',
    boxShadow: `0 0 12px ${color}`,
    textShadow: '0 0 6px rgba(0,0,0,0.3)',
  });

  document.body.appendChild(flash);
  setTimeout(() => (flash.style.transform = 'translateY(0)'), 100);
  setTimeout(() => {
    flash.style.transform = 'translateY(-100%)';
    setTimeout(() => flash.remove(), 500);
  }, duration);
}

// ---------------------------------------------------------------------------
// 🕹️ COUNTDOWN BANNER (3, 2, 1, GO! overlay)
// ---------------------------------------------------------------------------
export function showCountdownBanner({ parent = document.body, seconds = 3 } = {}) {
  const existing = document.getElementById('countdown-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'countdown-banner';
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '9999',
    fontSize: '18vw',
    color: '#00ff90',
    fontWeight: 'bold',
    textShadow: '0 0 30px #00ff90',
    letterSpacing: '4px',
    fontFamily: 'monospace',
    transition: 'opacity 0.5s ease',
  });

  parent.appendChild(banner);

  let count = seconds;
  const tick = () => {
    if (count > 0) {
      banner.textContent = count;
      banner.style.transform = 'scale(1.4)';
      banner.style.opacity = '0';
      setTimeout(() => {
        banner.style.transition = 'transform 0.4s, opacity 0.4s';
        banner.style.transform = 'scale(1)';
        banner.style.opacity = '1';
      }, 50);
      count--;
    } else {
      banner.textContent = 'GO!';
      banner.style.color = '#03dac6';
      banner.style.textShadow = '0 0 40px #03dac6';
      setTimeout(() => {
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 500);
      }, 900);
      clearInterval(interval);
    }
  };

  const interval = setInterval(tick, 1000);
  tick();
}

// ---------------------------------------------------------------------------
// 🕓 WAITING BANNER (for player before game start)
// ---------------------------------------------------------------------------
export function showWaitingBanner() {
  if (document.getElementById('waiting-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'waiting-banner';
  banner.textContent = '⏳ Waiting for the game to start...';
  Object.assign(banner.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    background: '#333',
    color: '#fff',
    textAlign: 'center',
    padding: '12px',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    zIndex: '3000',
  });
  document.body.appendChild(banner);
}

export function removeWaitingBanner() {
  document.getElementById('waiting-banner')?.remove();
}