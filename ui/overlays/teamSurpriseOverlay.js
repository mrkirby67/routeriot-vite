let currentOverlay = null;
let hideTimer = null;

function formatMessage(type, seconds) {
  switch (type) {
    case 'flat-tire':
      return `They are still waiting for roadside assistance... (${seconds}s left)`;
    case 'speed-bump':
      return `They are still recovering from their orbital launch... (${seconds}s left)`;
    case 'bug-strike':
    case 'bugStrike':
      return `They are still scraping bug guts off their windshield... (${seconds}s left)`;
    default:
      return `This team is still cooling down... (${seconds}s left)`;
  }
}

export function showTeamSurpriseOverlay({ type, remainingMs } = {}) {
  const durationMs = Number.isFinite(Number(remainingMs))
    ? Math.max(0, Number(remainingMs))
    : 3_000;
  const seconds = Math.ceil((durationMs || 3_000) / 1000);
  const message = formatMessage(type, seconds);

  hideTeamSurpriseOverlay();

  const overlay = document.createElement('div');
  overlay.className = 'surprise-cooldown-overlay';
  overlay.innerHTML = `
    <div class="surprise-cooldown-content">
      <p>${message}</p>
    </div>
  `;

  document.body.appendChild(overlay);
  currentOverlay = overlay;

  hideTimer = window.setTimeout(() => hideTeamSurpriseOverlay(), Math.max(durationMs, 3_000));
}

export function hideTeamSurpriseOverlay() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
}
