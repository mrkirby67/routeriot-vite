// ============================================================================
// FILE: modules/chatManager/playerChat.events.js
// PURPOSE: Handles player-side chat events and interactions
// ============================================================================

import { handleUseSurprise } from './playerChat.surprises.js';

const SURPRISE_ACTION_SELECTOR = '[data-action="use-surprise"]';

export function registerChatEventHandlers(teamName) {
  const normalizedTeam =
    typeof teamName === 'string' && teamName.trim()
      ? teamName.trim()
      : '';

  const clickHandler = async (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest(SURPRISE_ACTION_SELECTOR)
      : null;
    if (!trigger) return;

    event.preventDefault();

    if (trigger.dataset.loading === 'true') return;

    const surpriseType = trigger.dataset.surprise || trigger.dataset.type;
    if (!surpriseType) return;

    const targetTeam = trigger.dataset.team || normalizedTeam;
    const originalLabel = trigger.textContent;

    trigger.dataset.loading = 'true';
    trigger.disabled = true;
    trigger.textContent = 'Sending…';

    try {
      const result = await handleUseSurprise({
        teamName: normalizedTeam,
        surpriseType,
        targetTeam
      });

      if (result?.message) {
        trigger.textContent = result.message;
      } else {
        trigger.textContent = 'Sent!';
      }

      window.setTimeout(() => {
        trigger.textContent = originalLabel;
        if (!result?.keepDisabled) {
          trigger.disabled = false;
        }
      }, 1200);
    } catch (err) {
      console.error('❌ Surprise dispatch failed:', err);
      trigger.textContent = 'Failed';
      window.setTimeout(() => {
        trigger.textContent = originalLabel;
        trigger.disabled = false;
      }, 1400);
    } finally {
      delete trigger.dataset.loading;
      trigger.blur?.();
    }
  };

  document.addEventListener('click', clickHandler);

  return () => {
    document.removeEventListener('click', clickHandler);
  };
}
