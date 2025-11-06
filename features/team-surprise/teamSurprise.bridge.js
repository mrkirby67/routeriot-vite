// ============================================================================
// Bridge module for Team Surprise controller ↔︎ event coordination.
// Mirrors the chat bridge to avoid circular dependencies between controller,
// events, types, and UI layers.
// ============================================================================

let triggerHandler = null;
let attachHandler = null;
let attachRequested = false;

export function registerSurpriseTriggerHandler(handler) {
  triggerHandler = typeof handler === 'function' ? handler : null;
}

export function triggerSurpriseEvent(detail) {
  if (typeof triggerHandler === 'function') {
    return triggerHandler(detail);
  }
  return undefined;
}

export function registerSurpriseAttachHandler(handler) {
  attachHandler = typeof handler === 'function' ? handler : null;

  if (attachRequested && attachHandler) {
    attachRequested = false;
    attachHandler();
  }
}

export function ensureSurpriseEventListeners() {
  if (typeof attachHandler === 'function') {
    attachHandler();
    return;
  }

  attachRequested = true;

  import('./teamSurpriseEvents.js').catch((err) => {
    console.warn('Failed to load teamSurpriseEvents module:', err);
    attachRequested = false;
  });
}
