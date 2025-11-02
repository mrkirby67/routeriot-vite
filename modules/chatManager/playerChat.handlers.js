// ============================================================================
// FILE: modules/chatManager/playerChat.handlers.js
// PURPOSE: Wires surprise action buttons and updates availability states
// ============================================================================

import { SurpriseTypes } from '../teamSurpriseManager.js';
import { sendSurprise } from './playerChat.surprises.js';
import { sendSpeedBumpFromPlayer } from '../speedBumpPlayer.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function updateSendButtonAvailability(section, state, overrides = {}) {
  if (!section || !state) return;

  const counts = {
    flatTire: toNumber(overrides.flatTire ?? state.availableCounts?.flatTire),
    bugSplat: toNumber(overrides.bugSplat ?? state.availableCounts?.bugSplat),
    speedBump: toNumber(overrides.speedBump ?? state.availableCounts?.speedBump)
  };

  const toggle = (button, available) => {
    if (!button) return;
    if (button.dataset.loading === 'true') {
      button.disabled = true;
      return;
    }
    if (available <= 0) {
      button.disabled = true;
      button.dataset.outOfStock = 'true';
    } else {
      button.disabled = false;
      delete button.dataset.outOfStock;
    }
  };

  section.querySelectorAll('[data-role="send-flat"]').forEach((button) => {
    toggle(button, counts.flatTire);
  });
  section.querySelectorAll('[data-role="send-bug"]').forEach((button) => {
    toggle(button, counts.bugSplat);
  });
  section.querySelectorAll('[data-role="send-speed"]').forEach((button) => {
    toggle(button, counts.speedBump);
  });
}

export function attachSendHandlers({ section, state }) {
  if (!section || !state) return;

  const fromTeam = state.teamName;
  if (!fromTeam) return;

  updateSendButtonAvailability(section, state);

  const getCounts = () => ({
    flatTire: toNumber(state.availableCounts?.flatTire),
    bugSplat: toNumber(state.availableCounts?.bugSplat),
    speedBump: toNumber(state.availableCounts?.speedBump)
  });

  const handleSendClick = (button, surpriseType) => async (event) => {
    event.preventDefault();
    if (!button || button.dataset.loading === 'true') return;

    const targetTeam = String(button.dataset.target || '').trim();
    if (!targetTeam || targetTeam === fromTeam) {
      return;
    }

    const counts = getCounts();
    const remaining =
      surpriseType === SurpriseTypes.FLAT_TIRE
        ? counts.flatTire
        : counts.bugSplat;

    if (remaining <= 0) {
      button.disabled = true;
      button.dataset.outOfStock = 'true';
      return;
    }

    const originalLabel = button.textContent;
    button.textContent = 'Sending…';
    button.disabled = true;
    button.dataset.loading = 'true';

    try {
      const outcome = await sendSurprise(fromTeam, targetTeam, surpriseType);
      if (outcome?.message) {
        button.textContent = outcome.message;
      } else {
        button.textContent = 'Sent!';
      }

      const nextCounts = {
        ...state.availableCounts,
        flatTire:
          surpriseType === SurpriseTypes.FLAT_TIRE
            ? Math.max(0, remaining - 1)
            : counts.flatTire,
        bugSplat:
          surpriseType === SurpriseTypes.BUG_SPLAT
            ? Math.max(0, remaining - 1)
            : counts.bugSplat
      };
      state.availableCounts = nextCounts;
      updateSendButtonAvailability(section, state);
    } catch (err) {
      console.error('❌ Surprise dispatch failed:', err);
      button.textContent = err?.message || 'Failed';
      button.dataset.error = 'true';
    } finally {
      window.setTimeout(() => {
        button.textContent = originalLabel;
        delete button.dataset.loading;
        delete button.dataset.error;
        updateSendButtonAvailability(section, state);
        button.blur?.();
      }, 1400);
    }
  };

  const handleSpeedBumpClick = (button) => async (event) => {
    event.preventDefault();
    if (!button || button.dataset.loading === 'true') return;

    const targetTeam = String(button.dataset.target || '').trim();
    if (!targetTeam || targetTeam === fromTeam) {
      return;
    }

    const counts = getCounts();
    if (counts.speedBump <= 0) {
      alert('⚠️ You have no Speed Bumps available.');
      updateSendButtonAvailability(section, state, counts);
      return;
    }

    const originalLabel = button.textContent;
    button.textContent = 'Sending…';
    button.disabled = true;
    button.dataset.loading = 'true';

    try {
      await sendSpeedBumpFromPlayer(fromTeam, targetTeam);
    } catch (err) {
      console.error('❌ Speed Bump dispatch failed:', err);
      button.textContent = err?.message || 'Failed';
      button.dataset.error = 'true';
    } finally {
      window.setTimeout(() => {
        const latest = getCounts();
        button.textContent = originalLabel;
        delete button.dataset.loading;
        delete button.dataset.error;
        button.disabled = latest.speedBump <= 0;
        updateSendButtonAvailability(section, state, latest);
        button.blur?.();
      }, 1400);
    }
  };

  section.querySelectorAll('[data-role="send-flat"]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', handleSendClick(button, SurpriseTypes.FLAT_TIRE));
  });

  section.querySelectorAll('[data-role="send-bug"]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', handleSendClick(button, SurpriseTypes.BUG_SPLAT));
  });

  section.querySelectorAll('[data-role="send-speed"]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', handleSpeedBumpClick(button));
  });
}
