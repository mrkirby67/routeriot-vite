// ============================================================================
// Bridge module for Team Surprise controller ↔︎ event coordination.
// Mirrors the chat bridge to avoid circular dependencies between controller,
// events, types, and UI layers.
// ============================================================================

let triggerHandler = null;
let attachHandler = null;
let attachRequested = false;
let speedBumpOverlayModule = null;
let overlayLoadPromise = null;

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

async function loadSpeedBumpOverlayModule() {
  if (speedBumpOverlayModule) return speedBumpOverlayModule;
  if (overlayLoadPromise) {
    return overlayLoadPromise;
  }
  overlayLoadPromise = import('../../ui/overlays/speedBumpOverlay.js')
    .then((mod) => {
      speedBumpOverlayModule = mod || {};
      return speedBumpOverlayModule;
    })
    .catch((err) => {
      console.warn('Failed to load speedBumpOverlay module:', err);
      speedBumpOverlayModule = null;
      return null;
    })
    .finally(() => {
      overlayLoadPromise = null;
    });
  return overlayLoadPromise;
}

export async function ensureSpeedBumpOverlayListeners(options = {}) {
  const moduleRef = await loadSpeedBumpOverlayModule();
  const ensureFn = moduleRef?.ensureSpeedBumpOverlayListeners;
  if (typeof ensureFn === 'function') {
    return ensureFn(options);
  }
  return () => {};
}
