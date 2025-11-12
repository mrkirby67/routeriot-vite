// Subscribe to SpeedBump overlay events via eventBus
import { on } from '/core/eventBus.js';
import { showSpeedBumpOverlay, hideSpeedBumpOverlay } from '/modules/playerUI/overlays/speedBumpOverlay.js';

on('ui:overlay:show', (evt) => {
  if (evt?.id === 'speedbump') {
    console.debug('[ui] showing speedbump overlay', evt.data);
    showSpeedBumpOverlay?.(evt.data);
  }
});

on('ui:overlay:hide', (evt) => {
  if (evt?.id === 'speedbump') {
    console.debug('[ui] hiding speedbump overlay');
    hideSpeedBumpOverlay?.();
  }
});
