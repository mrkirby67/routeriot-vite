// Subscribe to SpeedBump overlay events via eventBus
import { on } from '/core/eventBus.js';
import { showSpeedBumpOverlay, hideSpeedBumpOverlay } from '/modules/playerUI/overlays/speedBumpOverlay.js';

function isPlayerPage() {
  if (typeof document === 'undefined') return false;
  const path = typeof window !== 'undefined' && window.location?.pathname
    ? window.location.pathname.toLowerCase()
    : '';
  if (path.includes('control')) return false;
  return true;
}

on('ui:overlay:show', (evt) => {
  if (!isPlayerPage()) return;
  if (evt?.id === 'speedbump') {
    console.debug('[ui] showing speedbump overlay', evt.data);
    showSpeedBumpOverlay?.(evt.data);
  }
});

on('ui:overlay:hide', (evt) => {
  if (!isPlayerPage()) return;
  if (evt?.id === 'speedbump') {
    console.debug('[ui] hiding speedbump overlay');
    hideSpeedBumpOverlay?.();
  }
});
