// ============================================================================
// FILE: modules/chatManager/playerChat.ui.js
// PURPOSE: Builds and renders the player chat UI components
// ============================================================================

import { isShieldActive, getShieldTimeRemaining } from '../teamSurpriseManager.js';
import { showShieldHudTimer, hideShieldHudTimer, showShieldTimer, hideShieldTimer } from '../playerUI/overlays.js';
import { ensureTeamSurprisesSection } from './playerChat.section.js';
import {
  renderTeamInventory as renderTeamInventoryView,
  renderMyInventory as renderMyInventoryView
} from './playerChat.renderers.js';
// ============================================================================
// 🧩 UI STATE + ELEMENT HELPERS
// ============================================================================
const teamSurprisesPanelState = {
  teamName: null,
  section: null,
  inventoryList: null,
  shieldChip: null,
  shieldTickerId: null,
  outgoingEntries: [],
  onRelease: null,
  availableCounts: {
    flatTire: 0,
    bugSplat: 0,
    superShieldWax: 0,
    speedBump: 0
  }
};

export function renderTeamInventory(byTeam = {}, options = {}) {
  renderTeamInventoryView(teamSurprisesPanelState, byTeam, options);
}

function renderMyInventory(counts = {}) {
  renderMyInventoryView(teamSurprisesPanelState, counts);
}

// ============================================================================
// 🧩 SHIELD STATUS + TICKER
// ============================================================================
function updateShieldChip() {
  const { teamName } = teamSurprisesPanelState;
  if (!teamName) return;

  const active = isShieldActive(teamName);
  const remainingMs = Math.max(0, getShieldTimeRemaining(teamName));

  // New UI: Add/remove a class on the body for the border
  document.body.classList.toggle('shield-active', active && remainingMs > 0);

  // New UI: Add/remove a status line in the Game Info section
  const gameStatusEl = document.getElementById('game-status');
  let shieldStatusEl = document.getElementById('shield-status-display');

  if (active && remainingMs > 0) {
    if (!shieldStatusEl) {
      shieldStatusEl = document.createElement('p');
      shieldStatusEl.id = 'shield-status-display';
      gameStatusEl?.parentElement?.insertAdjacentElement('afterend', shieldStatusEl);
    }
    const seconds = Math.ceil(remainingMs / 1000);
    shieldStatusEl.innerHTML = `<strong>Shield Active:</strong> <span id="shield-timer-value">${seconds}s</span>`;
  } else {
    shieldStatusEl?.remove();
  }

  // Old UI logic (for the chip in the surprises panel) can be simplified or removed if not needed
  const { shieldChip } = teamSurprisesPanelState;
  if (shieldChip) {
      if (active && remainingMs > 0) {
        shieldChip.classList.add('is-active');
        shieldChip.textContent = `🛡️ Shield Active`;
      } else {
        shieldChip.classList.remove('is-active');
        shieldChip.textContent = '🛡️ Shield Inactive';
      }
  }
}

function stopShieldTicker() {
  if (teamSurprisesPanelState.shieldTickerId) {
    clearInterval(teamSurprisesPanelState.shieldTickerId);
    teamSurprisesPanelState.shieldTickerId = null;
  }
}

function startShieldTicker() {
  stopShieldTicker();
  updateShieldChip();
  const { teamName } = teamSurprisesPanelState;
  if (!teamName || !isShieldActive(teamName)) return;
  teamSurprisesPanelState.shieldTickerId = window.setInterval(() => {
    if (!teamSurprisesPanelState.teamName) {
      stopShieldTicker();
      return;
    }
    if (!isShieldActive(teamSurprisesPanelState.teamName)) {
      stopShieldTicker();
      updateShieldChip();
      return;
    }
    updateShieldChip();
  }, 1000);
}

// ============================================================================
// 🧩 INITIALIZER
// ============================================================================
export function initializeTeamSurprisesPanel(teamName) {
  const section = ensureTeamSurprisesSection();
  if (!section) return null;

  const inventoryList = section.querySelector('#team-surprise-inventory');
  const shieldChip = section.querySelector('[data-role="shield-status"]');

  teamSurprisesPanelState.teamName = teamName;
  teamSurprisesPanelState.section = section;
  teamSurprisesPanelState.inventoryList = inventoryList;
  teamSurprisesPanelState.shieldChip = shieldChip;

  return {
    renderInventory(byTeam = {}, options = {}) {
      renderTeamInventory(byTeam, options);
    },
    setOutgoingAssignments(entries = [], options = {}) {
      teamSurprisesPanelState.outgoingEntries = Array.isArray(entries) ? entries : [];
      teamSurprisesPanelState.onRelease = typeof options.onRelease === 'function' ? options.onRelease : null;
    },
    renderPlayerInventory(counts = {}) {
      renderMyInventory(counts);
    },
    refreshShieldStatus() {
      startShieldTicker();
    },
    teardown() {
      stopShieldTicker();
      hideShieldTimer();
      teamSurprisesPanelState.teamName = null;
      teamSurprisesPanelState.section = null;
      teamSurprisesPanelState.inventoryList = null;
      teamSurprisesPanelState.shieldChip = null;
      teamSurprisesPanelState.outgoingEntries = [];
      teamSurprisesPanelState.onRelease = null;
    }
  };
}
