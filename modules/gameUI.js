// ============================================================================
// GAME UI HELPERS
// Functions for displaying visual feedback (timers, banners, messages)
// ============================================================================

let timerInterval = null;

// Simple helper for getting a DOM element by its ID
function $(id) { return document.getElementById(id); }

/**
 * Starts a count-up timer from a given Firestore timestamp.
 * @param {object} startTime - Firestore server timestamp.
 */
export function startElapsedTimer(startTime) {
  const timerEl = $('player-timer');
  if (!timerEl || !startTime) return;

  clearElapsedTimer();
  // Convert Firestore timestamp to a JavaScript Date object
  const start = new Date(startTime.seconds * 1000);

  timerInterval = setInterval(() => {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
    const hrs  = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
    const mins = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    timerEl.textContent = `${hrs}:${mins}:${secs}`;
  }, 1000);
}

/**
 * Stops and clears the elapsed timer display.
 */
export function clearElapsedTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  const timerEl = $('player-timer');
  if (timerEl) timerEl.textContent = '--:--:--';
}

/**
 * Displays a temporary "flash" message at the top of the screen.
 * @param {string} message - The text to display.
 * @param {string} color - The background color of the banner.
 * @param {number} duration - How long the message should stay on screen (in ms).
 */
export function showFlashMessage(message, color = '#2e7d32', duration = 3000) {
    const flash = document.createElement('div');
    flash.textContent = message;
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background-color: ${color};
        color: white;
        text-align: center;
        padding: 16px;
        font-size: 1.2em;
        font-weight: bold;
        z-index: 2000;
        transform: translateY(-100%);
        transition: transform 0.5s ease-in-out;
    `;
    document.body.appendChild(flash);

    // Animate in and out
    setTimeout(() => { flash.style.transform = 'translateY(0)'; }, 100);
    setTimeout(() => {
        flash.style.transform = 'translateY(-100%)';
        setTimeout(() => flash.remove(), 500);
    }, duration);
}

/**
 * Displays a 3, 2, 1, GO! countdown banner over the whole screen.
 * @param {object} config - Configuration object, e.g., { parent: document.body }.
 */
export function showCountdownBanner({ parent = document.body }) {
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); display: flex; justify-content: center;
        align-items: center; z-index: 9999; color: white; font-size: 20vw;
        font-weight: bold; text-shadow: 0 0 20px #ff0;
        -webkit-font-smoothing: antialiased;
    `;
    parent.appendChild(banner);

    let count = 3;
    const update = () => {
        if (count > 0) {
            banner.textContent = count;
            // Animation effect for each number
            banner.style.transform = 'scale(1.5)';
            banner.style.opacity = '0';
            setTimeout(() => {
                banner.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
                banner.style.transform = 'scale(1)';
                banner.style.opacity = '1';
            }, 50);
            count--;
        } else {
            banner.textContent = 'GO!';
            setTimeout(() => {
                banner.style.transition = 'opacity 0.5s ease-out';
                banner.style.opacity = '0';
                setTimeout(() => banner.remove(), 500);
            }, 1000);
            clearInterval(interval);
        }
    };
    
    const interval = setInterval(update, 1000);
    update(); // Run once immediately
}

