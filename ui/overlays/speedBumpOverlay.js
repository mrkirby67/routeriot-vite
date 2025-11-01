// === AICP UI HEADER ===
// ============================================================================
// FILE: ui/overlays/speedBumpOverlay.js
// PURPOSE: Displays a transient overlay when a speed bump is triggered.
// DEPENDS_ON: ./speedBumpOverlay.css
// USED_BY: modules/speedBumpPlayer.js
// AUTHOR: Route Riot – Speed Bump Refresh
// CREATED: 2025-10-30
// AICP_VERSION: 3.1
// ============================================================================
// === END AICP UI HEADER ===

import './speedBumpOverlay.css';

let hideTimer = null;

function cleanupExistingOverlay() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  const existing = document.getElementById('speedbump-overlay');
  existing?.remove();
}

export function showSpeedBumpOverlay(type, context = {}) {
  cleanupExistingOverlay();

  const normalizedType =
    typeof type === 'string' && type.trim() ? type.trim().toLowerCase() : 'slowdown';
  const friendlyLabel = normalizedType === 'flat-tire' ? 'Flat Tire!' : 'Speed Bump!';
  const description =
    normalizedType === 'flat-tire' ? 'flat tire' : normalizedType.replace(/-/g, ' ');
  const teamLabel = typeof context.team === 'string' && context.team.trim()
    ? context.team.trim()
    : 'unknown team';

  const overlay = document.createElement('div');
  overlay.id = 'speedbump-overlay';
  overlay.className = 'speedbump-overlay';
  overlay.innerHTML = `
    <div class="overlay-content">
      <h2>🚧 ${friendlyLabel}</h2>
      <p>Your vehicle hit a ${description}! Slow down briefly!</p>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
  console.info(`[SpeedBump] Overlay displayed for team ${teamLabel}`);

  hideTimer = setTimeout(() => {
    overlay.classList.remove('visible');
    console.info('[SpeedBump] Cleared in 4 s');
    setTimeout(() => {
      overlay.remove();
      hideTimer = null;
    }, 250);
  }, 4_000);
}

// === AICP UI FOOTER ===
// ai_origin: ui/overlays/speedBumpOverlay.js
// ai_role: Presentation Layer
// aicp_category: ui
// aicp_version: 3.1
// codex_phase: tier4_ui_injection
// export_bridge: modules/*
// exports: showSpeedBumpOverlay
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier4_ui_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// === END AICP UI FOOTER ===
