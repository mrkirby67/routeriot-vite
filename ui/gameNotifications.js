// === AICP UI HEADER ===
// ============================================================================
// FILE: ui/gameNotifications.js
// PURPOSE: Displays UI notifications and alerts to the user.
// DEPENDS_ON: none
// USED_BY: features/game-state/gameStateController.js, components/GameControls/GameControls.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.1
// ============================================================================
// === END AICP UI HEADER ===

// ----------------------------------------------------------------------------
// ⚡ Flash Banner
// ----------------------------------------------------------------------------
/**
 * Displays a quick flash-style banner for transient messages.
 * @param {string} message - Text to display.
 * @param {number} [timeout=3000] - Time in ms before disappearing.
 */

export function showFlashMessage(message = '', timeout = 3000) {
  const div = document.createElement('div');
  div.className = 'flash-banner';
  div.textContent = message;
  Object.assign(div.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#333',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '6px',
    zIndex: '9999',
    fontFamily: 'sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    opacity: '0',
    transition: 'opacity 0.3s ease-in-out',
  });
  document.body.appendChild(div);
  // fade in
  requestAnimationFrame(() => (div.style.opacity = '1'));
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, timeout);
}

// ----------------------------------------------------------------------------
// ⏳ Countdown Banner
// ----------------------------------------------------------------------------
/**
 * Displays a countdown banner (e.g., for cooldowns or pauses).
 * @param {string} label - The label to display before the countdown.
 * @param {number} seconds - Countdown duration in seconds.
 */

export function showCountdownBanner(label, seconds) {
  const banner = document.createElement('div');
  banner.className = 'countdown-banner';
  Object.assign(banner.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#222',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '6px',
    zIndex: '9999',
    fontFamily: 'sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  });
  document.body.appendChild(banner);

  let remaining = seconds;
  const tick = () => {
    banner.textContent = `${label}: ${remaining}s`;
    if (remaining <= 0) return banner.remove();
    remaining--;
    setTimeout(tick, 1000);
  };
  tick();
}

// ----------------------------------------------------------------------------
// ✅ Success / ❌ Error / ℹ️ Info
// ----------------------------------------------------------------------------
/**
 * Shows a success notification (green banner + log).
 * @param {string} message - The message to display.
 */

export function showSuccess(message) {
  showFlashMessage(`✅ ${message}`, 3000);
  console.log(`SUCCESS: ${message}`);
}

/**
 * Shows an error notification (red banner + log).
 * @param {string} message - The message to display.
 */

export function showError(message) {
  showFlashMessage(`❌ ${message}`, 4000);
  console.error(`ERROR: ${message}`);
}

/**
 * Shows an informational notification (blue banner + log).
 * @param {string} message - The message to display.
 */

export function showInfo(message) {
  showFlashMessage(`ℹ️ ${message}`, 3000);
  console.log(`INFO: ${message}`);
}

// === AICP UI FOOTER ===
// ai_origin: ui/gameNotifications.js
// ai_role: Presentation Layer
// aicp_category: ui
// aicp_version: 3.1
// codex_phase: tier4_ui_injection
// export_bridge: components
// exports: showFlashMessage, showCountdownBanner, showSuccess, showError, showInfo
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier4_ui_injection
// review_status: aligned
// status: stable
// sync_state: aligned
// === END AICP UI FOOTER ===
