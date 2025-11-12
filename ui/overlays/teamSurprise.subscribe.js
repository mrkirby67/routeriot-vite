// Subscribe to Team Surprise overlay events via eventBus
import { on } from '/core/eventBus.js';
import { showTeamSurpriseOverlay, hideTeamSurpriseOverlay } from '/ui/overlays/teamSurpriseOverlay.js';

on('ui:overlay:show', (evt) => {
  if (evt?.id === 'team-surprise') {
    console.debug('[ui] showing team surprise overlay', evt.data);
    showTeamSurpriseOverlay?.(evt.data);
  }
});

on('ui:overlay:hide', (evt) => {
  if (evt?.id === 'team-surprise') {
    console.debug('[ui] hiding team surprise overlay');
    hideTeamSurpriseOverlay?.();
  }
});
