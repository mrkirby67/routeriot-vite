// ============================================================================
// Bug Strike Events
// Captures player UI clicks (Team Surprise "Bug" buttons) and dispatches them
// through the bridge, preventing the legacy Bug Splat handler from running.
// ============================================================================

import {
  triggerBugStrike,
  registerBugStrikeAttachHandler
} from "./bugStrike.bridge.js";

const BUG_BUTTON_SELECTOR = '[data-role="send-bug"]';

let listenersAttached = false;

function attachBugStrikeEventListeners() {
  if (listenersAttached || typeof document === 'undefined') return;

  const handleClick = async (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest(BUG_BUTTON_SELECTOR)
      : null;
    if (!trigger) return;

    const targetTeam = trigger.dataset.target?.trim();
    if (!targetTeam) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    if (trigger.dataset.loading === 'true') return;

    const originalLabel = trigger.textContent;
    trigger.dataset.loading = 'true';
    trigger.disabled = true;
    trigger.textContent = 'Launching…';

    try {
      await triggerBugStrike(targetTeam);
      trigger.textContent = '🐞 Bug Strike Sent!';
    } catch (err) {
      console.error('Bug Strike failed:', err);
      const message = err?.message || 'Failed';
      trigger.textContent = message;
      trigger.dataset.error = 'true';
    } finally {
      window.setTimeout(() => {
        trigger.textContent = originalLabel;
        delete trigger.dataset.loading;
        delete trigger.dataset.error;
        trigger.disabled = false;
        trigger.blur?.();
      }, 1400);
    }
  };

  document.addEventListener('click', handleClick, true);
  listenersAttached = true;
}

registerBugStrikeAttachHandler(attachBugStrikeEventListeners);
