// ============================================================================
// FILE: modules/chatManager/playerChat.ui.js
// PURPOSE: Builds and renders the player chat UI components
// ============================================================================

import { isShieldActive, getShieldTimeRemaining, SurpriseTypes } from '../teamSurpriseManager.js';
import { showShieldHudTimer, hideShieldHudTimer, showShieldTimer, hideShieldTimer } from '../playerUI/overlays.js';
import { escapeHtml } from '../utils.js';
import { formatShieldDuration } from './playerChat.utils.js';
import { sendSurprise } from './playerChat.surprises.js';
import { sendSpeedBumpFromPlayer } from '../speedBumpPlayer.js';
// ============================================================================
// 🧩 UI STATE + ELEMENT HELPERS
// ============================================================================
const teamSurprisesPanelState = {
  teamName: null,
  section: null,
  inventoryList: null,
  outgoingList: null,
  shieldChip: null,
  shieldTickerId: null,
  availableCounts: {
    flatTire: 0,
    bugSplat: 0,
    superShieldWax: 0,
    speedBump: 0
  }
};

function escapeAttribute(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================================
// 🧩 DOM CONSTRUCTION — Ensure main section exists
// ============================================================================
export function ensureTeamSurprisesSection() {
  const scoreboard = document.getElementById('scoreboard-container');
  if (!scoreboard) return null;

  let section = document.getElementById('team-surprises-section');
  if (!section) {
    section = document.createElement('section');
    section.id = 'team-surprises-section';
    section.className = 'control-section team-surprises-section';
    section.innerHTML = `
      <div class="team-surprises-header">
        <h2>🎉 Team Surprises</h2>
        <span class="team-surprises-shield" data-role="shield-status">🛡️ Shield inactive</span>
      </div>
      <div class="team-surprises-columns">
        <div class="team-surprises-self">
          <h3>Your Inventory</h3>
          <div id="team-surprises-body" class="team-surprises-myteam">
            <p class="team-surprises-placeholder">Loading your wild cards…</p>
          </div>
        </div>
        <div class="team-surprises-inventory">
          <h3>All Teams</h3>
          <ul id="team-surprise-inventory" class="team-surprises-list"></ul>
        </div>
      </div>
      <div class="team-surprises-outgoing" data-role="outgoing-speedbumps">
        <h3>Outgoing Speed Bumps</h3>
        <ul id="outgoing-speedbump-list" class="team-surprises-list"></ul>
      </div>
    `;
    scoreboard.insertAdjacentElement('afterend', section);
  }

  // Ensure placement stays directly after scoreboard
  if (section.previousElementSibling !== scoreboard) {
    scoreboard.insertAdjacentElement('afterend', section);
  }

  const inventoryList = section.querySelector('#team-surprise-inventory');
  const outgoingList = section.querySelector('#outgoing-speedbump-list');
  const myBody = section.querySelector('#team-surprises-body');

  if (inventoryList && !inventoryList.innerHTML.trim()) {
    inventoryList.innerHTML = '<li class="team-surprises-empty">No surprise data yet.</li>';
  }
  if (outgoingList && !outgoingList.innerHTML.trim()) {
    outgoingList.innerHTML = '<li class="team-surprises-empty">No active Speed Bumps.</li>';
  }
  if (myBody && !myBody.innerHTML.trim()) {
    myBody.innerHTML = '<p class="team-surprises-placeholder">Loading your wild cards…</p>';
  }

  return section;
}

// ============================================================================
// 🧩 RENDERING HELPERS
// ============================================================================
export function renderTeamInventory(byTeam = {}, options = {}) {
  const list = teamSurprisesPanelState.inventoryList;
  if (!list) return;

  const {
    available = teamSurprisesPanelState.availableCounts || {},
    teamNames = []
  } = options || {};

  const flatAvailable = Number(available.flatTire) || 0;
  const bugAvailable = Number(available.bugSplat) || 0;
  const speedAvailable = Number(available.speedBump) || 0;

  const knownTeams = Array.from(new Set(teamNames));

  const currentPlayerTeam = teamSurprisesPanelState.teamName;
  const listedTeams = knownTeams
    .filter((teamName) => teamName && teamName !== currentPlayerTeam)
    .sort((a, b) => a.localeCompare(b));

  if (!listedTeams.length) {
    list.innerHTML = '<li class="team-surprises-empty">No teams available for surprises.</li>';
    return;
  }

  const rows = listedTeams.map((teamName) => {
    const safeTeam = escapeHtml(teamName);
    const attributeTeam = escapeAttribute(teamName);

    return `
      <li class="team-surprises-row" data-team="${attributeTeam}">
        <span class="team-name">${safeTeam}</span>
        <div class="team-surprises-actions">
          <button
            type="button"
            class="team-btn team-btn--flat"
            data-role="send-flat"
            data-target="${attributeTeam}"
            ${flatAvailable > 0 ? '' : 'disabled'}
          >
            🚗 Send Flat Tire
          </button>
          <button
            type="button"
            class="team-btn team-btn--bug"
            data-role="send-bug"
            data-target="${attributeTeam}"
            ${bugAvailable > 0 ? '' : 'disabled'}
          >
            🐞 Send Bug Splat
          </button>
          <button
            type="button"
            class="team-btn team-btn--speed"
            data-role="send-speed"
            data-target="${attributeTeam}"
            ${speedAvailable > 0 ? '' : 'disabled'}
          >
            🚧 Send Speed Bump
          </button>
        </div>
      </li>
    `;
  }).join('');

  list.innerHTML = rows;
  attachSendHandlers({ flatAvailable, bugAvailable, speedAvailable });
}

export function renderOutgoingList(entries = []) {
  const list = teamSurprisesPanelState.outgoingList;
  if (!list) return;

  if (!Array.isArray(entries) || !entries.length) {
    list.innerHTML = '<li class="team-surprises-empty">No active Speed Bumps.</li>';
    return;
  }

  const rows = entries.map(({ toTeam, remainingMs }) => {
    const seconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
    const label = seconds > 0 ? `${seconds}s remaining` : 'Awaiting release';
    return `
      <li class="team-surprises-row">
        <span class="team-name">${escapeHtml(toTeam)}</span>
        <span class="team-count countdown">⏳ ${label}</span>
      </li>
    `;
  }).join('');

  list.innerHTML = rows;
}

function renderMyInventory(counts = {}) {
  const section = teamSurprisesPanelState.section || ensureTeamSurprisesSection();
  if (!section) return;

  const body = section.querySelector('#team-surprises-body');
  if (!body) return;

  const {
    flatTire = 0,
    bugSplat = 0,
    superShieldWax = 0,
    speedBump = 0
  } = counts || {};

  teamSurprisesPanelState.availableCounts = { flatTire, bugSplat, superShieldWax, speedBump };

  body.dataset.flatAvailable = String(flatTire);
  body.dataset.bugAvailable = String(bugSplat);
  body.dataset.shieldAvailable = String(superShieldWax);
  body.dataset.speedAvailable = String(speedBump);

  const shieldButtonDisabled = superShieldWax > 0 ? '' : 'disabled';
  const shieldButton = `
    <button
      type="button"
      class="team-surprise-btn"
      data-action="use-surprise"
      data-surprise="wildCard"
      data-team="${escapeAttribute(teamSurprisesPanelState.teamName || '')}"
      ${shieldButtonDisabled}
    >
      Activate Shield
    </button>
  `;

  body.innerHTML = `
    <div class="team-surprises-row is-player">
      <strong>🚗 Flat Tire</strong>
      <span class="team-count" data-type="flatTire">${flatTire}</span>
    </div>
    <div class="team-surprises-row is-player">
      <strong>🐞 Bug Splat</strong>
      <span class="team-count" data-type="bugSplat">${bugSplat}</span>
    </div>
    <div class="team-surprises-row is-player">
      <strong>🛡️ Super Shield Wax</strong>
      <span class="team-count" data-type="shield">${superShieldWax}</span>
      ${shieldButton}
    </div>
    <div class="team-surprises-row is-player">
      <strong>🚧 Speed Bump</strong>
      <span class="team-count" data-type="speedBump" data-my-speedbump>${speedBump}</span>
    </div>
    <p class="team-surprises-note">
      Use the buttons beside opposing teams to deploy offensive surprises.
    </p>
  `;

  attachSendHandlers({ flatAvailable: flatTire, bugAvailable: bugSplat, speedAvailable: speedBump });
}

function updateSendButtonAvailability({
  flatAvailable = 0,
  bugAvailable = 0,
  speedAvailable = 0
} = {}) {
  const section = teamSurprisesPanelState.section || ensureTeamSurprisesSection();
  if (!section) return;

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
    toggle(button, Number(flatAvailable) || 0);
  });
  section.querySelectorAll('[data-role="send-bug"]').forEach((button) => {
    toggle(button, Number(bugAvailable) || 0);
  });
  section.querySelectorAll('[data-role="send-speed"]').forEach((button) => {
    toggle(button, Number(speedAvailable) || 0);
  });
}

function attachSendHandlers({
  flatAvailable = Number(teamSurprisesPanelState.availableCounts?.flatTire) || 0,
  bugAvailable = Number(teamSurprisesPanelState.availableCounts?.bugSplat) || 0,
  speedAvailable = Number(teamSurprisesPanelState.availableCounts?.speedBump) || 0
} = {}) {
  const section = teamSurprisesPanelState.section || ensureTeamSurprisesSection();
  if (!section) return;

  const fromTeam = teamSurprisesPanelState.teamName;
  if (!fromTeam) return;

  updateSendButtonAvailability({ flatAvailable, bugAvailable, speedAvailable });

  const handleSendClick = (button, surpriseType) => async (event) => {
    event.preventDefault();
    if (!button || button.dataset.loading === 'true') return;

    const targetTeam = String(button.dataset.target || '').trim();
    if (!targetTeam || targetTeam === fromTeam) {
      return;
    }

    const availableCounts = teamSurprisesPanelState.availableCounts || {};
    const remaining = surpriseType === SurpriseTypes.FLAT_TIRE
      ? Number(availableCounts.flatTire) || 0
      : Number(availableCounts.bugSplat) || 0;

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

      const updatedCounts = teamSurprisesPanelState.availableCounts || {};
      if (surpriseType === SurpriseTypes.FLAT_TIRE) {
        const next = Math.max(0, remaining - 1);
        updatedCounts.flatTire = next;
      } else if (surpriseType === SurpriseTypes.BUG_SPLAT) {
        const next = Math.max(0, remaining - 1);
        updatedCounts.bugSplat = next;
      }
      teamSurprisesPanelState.availableCounts = updatedCounts;
      updateSendButtonAvailability({
        flatAvailable: updatedCounts.flatTire,
        bugAvailable: updatedCounts.bugSplat,
        speedAvailable: updatedCounts.speedBump
      });
    } catch (err) {
      console.error('❌ Surprise dispatch failed:', err);
      button.textContent = err?.message || 'Failed';
      button.dataset.error = 'true';
    } finally {
      window.setTimeout(() => {
        button.textContent = originalLabel;
        delete button.dataset.loading;
        delete button.dataset.error;
        const latestCounts = teamSurprisesPanelState.availableCounts || {};
        updateSendButtonAvailability({
          flatAvailable: latestCounts.flatTire,
          bugAvailable: latestCounts.bugSplat,
          speedAvailable: latestCounts.speedBump
        });
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

    const availableCounts = teamSurprisesPanelState.availableCounts || {};
    const remaining = Number(availableCounts.speedBump) || 0;

    if (remaining <= 0) {
      alert('⚠️ You have no Speed Bumps available.');
      updateSendButtonAvailability({
        flatAvailable: availableCounts.flatTire,
        bugAvailable: availableCounts.bugSplat,
        speedAvailable: remaining
      });
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
    } finally {
      window.setTimeout(() => {
        const latestCounts = teamSurprisesPanelState.availableCounts || {};
        button.textContent = originalLabel;
        delete button.dataset.loading;
        button.disabled = (Number(latestCounts.speedBump) || 0) <= 0;
        updateSendButtonAvailability({
          flatAvailable: latestCounts.flatTire,
          bugAvailable: latestCounts.bugSplat,
          speedAvailable: latestCounts.speedBump
        });
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
  const outgoingList = section.querySelector('#outgoing-speedbump-list');
  const shieldChip = section.querySelector('[data-role="shield-status"]');

  teamSurprisesPanelState.teamName = teamName;
  teamSurprisesPanelState.section = section;
  teamSurprisesPanelState.inventoryList = inventoryList;
  teamSurprisesPanelState.outgoingList = outgoingList;
  teamSurprisesPanelState.shieldChip = shieldChip;

  return {
    renderInventory(byTeam = {}, options = {}) {
      renderTeamInventory(byTeam, options);
    },
    renderOutgoing(entries = []) {
      renderOutgoingList(entries);
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
      teamSurprisesPanelState.outgoingList = null;
      teamSurprisesPanelState.shieldChip = null;
    }
  };
}
