// ============================================================================
// GAME COUNTDOWN MODULE
// Displays a synchronized countdown overlay: 3... 2... 1... GO!
// Works on both Player and Control pages
// ============================================================================

// ---------------------------------------------------------------------------
// 🔹 showCountdownBanner
// Creates an animated countdown overlay
// ---------------------------------------------------------------------------
export function showCountdownBanner({
  parent = document.body,
  steps = ['3', '2', '1', 'GO! 🏁'],
  onComplete = null,
  showFinal = true
} = {}) {
  // If one is already showing, remove it first
  const existing = document.getElementById('countdown-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'countdown-banner';
  banner.style.cssText = `
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 5rem;
    font-weight: 900;
    color: white;
    background: #d32f2f;
    padding: 40px 80px;
    border-radius: 20px;
    z-index: 9999;
    text-align: center;
    box-shadow: 0 0 30px rgba(0,0,0,0.5);
    text-shadow: 2px 2px 10px rgba(0,0,0,0.4);
    transition: all 0.4s ease-in-out;
  `;
  parent.appendChild(banner);

  let i = 0;
  const interval = setInterval(() => {
    banner.textContent = steps[i];
    banner.style.background = i === steps.length - 1 ? '#2e7d32' : '#d32f2f';
    banner.style.transform = 'translate(-50%, -50%) scale(1.1)';
    setTimeout(() => banner.style.transform = 'translate(-50%, -50%) scale(1)', 300);

    i++;
    if (i === steps.length) {
      clearInterval(interval);

      if (showFinal) {
        setTimeout(() => {
          banner.textContent = 'The Race is ON!';
          banner.style.background = '#1565c0';
          banner.style.transition = 'all 0.8s ease-in-out';
          setTimeout(() => banner.remove(), 1500);
        }, 700);
      } else {
        banner.remove();
      }

      if (typeof onComplete === 'function') onComplete();
    }
  }, 1000);
}

// ---------------------------------------------------------------------------
// 🔹 showFlashMessage
// Displays a quick banner (e.g., “Game Paused”, “Race Ended”)
// ---------------------------------------------------------------------------
export function showFlashMessage(text, color = '#424242', duration = 2000) {
  const msg = document.createElement('div');
  msg.className = 'flash-message';
  msg.style.cssText = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 2.5rem;
    font-weight: bold;
    background: ${color};
    color: white;
    padding: 20px 50px;
    border-radius: 15px;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.5s ease;
  `;
  msg.textContent = text;
  document.body.appendChild(msg);

  requestAnimationFrame(() => msg.style.opacity = 1);

  setTimeout(() => {
    msg.style.opacity = 0;
    setTimeout(() => msg.remove(), 500);
  }, duration);
}