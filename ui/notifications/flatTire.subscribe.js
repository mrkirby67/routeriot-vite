import { on } from '/core/eventBus.js';
import {
  setupDomRefs,
  renderRows,
  updateZonePreview
} from '/ui/flat-tire/flatTireUI.js';

on('flatTire:update', (event) => {
  if (!event || typeof event !== 'object') return;
  const { type } = event;
  switch (type) {
    case 'setupDomRefs':
      return setupDomRefs(event.controller);
    case 'renderRows':
      return renderRows(event.controller, Boolean(event.forceFullRender));
    case 'updateZonePreview':
      return updateZonePreview(event.zoneKey, event.config, event.controller?.dom);
    default:
      return undefined;
  }
});
