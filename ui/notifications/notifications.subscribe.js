// Subscribes to eventBus notifications and renders them via ui/gameNotifications if available.
import { on } from '/core/eventBus.js';

let forward = null;

async function ensureForwarder() {
  if (forward !== null) return forward;
  try {
    // Try to use your existing UI notification helper if it exists
    // Adjust these names if your module exports differ.
    const mod = await import('/ui/gameNotifications.js');
    forward = (evt) => {
      const { kind, text, timeout } = evt || {};
      // Try common function names; fallback to a generic API if present.
      if (mod.showNotification) return mod.showNotification({ kind, text, timeout });
      if (mod.toast) return mod.toast(text, { kind, timeout });
      if (mod.flashMessage) return mod.flashMessage(text, kind, timeout);
      // Generic fallback:
      console.log('[ui:notify]', kind || 'info', text);
    };
  } catch {
    forward = (evt) => console.log('[ui:notify]', evt?.kind || 'info', evt?.text || '');
  }
  return forward;
}

on('ui:notify', async (evt) => {
  const fwd = await ensureForwarder();
  fwd(evt);
});

// Optional overlay bridge (no-op until you add listeners)
on('ui:overlay:show', (evt) => console.debug('[ui:overlay:show]', evt));
on('ui:overlay:hide', (evt) => console.debug('[ui:overlay:hide]', evt));
