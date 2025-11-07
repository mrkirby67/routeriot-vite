// ============================================================================
// Bug Strike Bridge
// Decouples event listeners from controller logic (mirrors chat bridge pattern)
// ============================================================================

let strikeHandler = null;
let attachHandler = null;
let attachRequested = false;

export function registerBugStrikeHandler(handler) {
  strikeHandler = typeof handler === 'function' ? handler : null;
}

export function triggerBugStrike(targetTeam) {
  if (typeof strikeHandler !== 'function') {
    return Promise.reject(new Error('Bug Strike handler not ready.'));
  }
  return strikeHandler(targetTeam);
}

export function registerBugStrikeAttachHandler(handler) {
  attachHandler = typeof handler === 'function' ? handler : null;
  if (attachRequested && attachHandler) {
    attachRequested = false;
    attachHandler();
  }
}

export function ensureBugStrikeEventListeners() {
  if (typeof attachHandler === 'function') {
    attachHandler();
    return;
  }

  attachRequested = true;

  import('./bugStrike.events.js').catch((err) => {
    console.warn('⚠️ Failed to load bugStrike events module:', err);
    attachRequested = false;
  });
}
