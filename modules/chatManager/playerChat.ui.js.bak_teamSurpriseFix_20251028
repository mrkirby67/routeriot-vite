// ============================================================================
// FILE: modules/chatManager/playerChat.ui.js
// PURPOSE: Builds and renders the player chat UI components
// ============================================================================

import { isShieldActive, getShieldTimeRemaining } from '../teamSurpriseManager.js';
import { showShieldHudTimer, hideShieldHudTimer, showShieldTimer, hideShieldTimer } from '../playerUI/overlays.js';
import { escapeHtml } from '../utils.js';
import { extractSurpriseCount, formatShieldDuration } from './playerChat.utils.js';
// ============================================================================
// 🧩 UI STATE + ELEMENT HELPERS
// ============================================================================
const teamSurprisesPanelState = {
  teamName: null,
  section: null,
  inventoryList: null,
  outgoingList: null,
  shieldChip: null,
  shieldTickerId: null
};

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
export function renderTeamInventory(byTeam = {}) {
  const list = teamSurprisesPanelState.inventoryList;
  if (!list) return;

  const entries = Object.entries(byTeam);
  if (!entries.length) {
    list.innerHTML = '<li class="team-surprises-empty">No surprise data yet.</li>';
    return;
  }

  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const rows = entries.map(([teamName, counts = {}]) => {
    const flat = extractSurpriseCount(counts, 'flatTire', 'FLAT_TIRE');
    const bug = extractSurpriseCount(counts, 'bugSplat', 'BUG_SPLAT');
    const shield = extractSurpriseCount(counts, 'superShieldWax', 'wildCard', 'WILD_CARD');
    const highlight = teamName === teamSurprisesPanelState.teamName ? ' is-current-team' : '';
    return `
      <li class="team-surprises-row${highlight}">
        <span class="team-name">${escapeHtml(teamName)}</span>
        <span class="team-count" data-type="flatTire" title="Flat Tire">🚗 ${flat}</span>
        <span class="team-count" data-type="bugSplat" title="Bug Splat">🐞 ${bug}</span>
        <span class="team-count" data-type="shield" title="Super Shield Wax">🛡️ ${shield}</span>
      </li>
    `;
  }).join('');

  list.innerHTML = rows;
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

// ============================================================================
// 🧩 SHIELD STATUS + TICKER
// ============================================================================
function updateShieldChip() {
  const { shieldChip, teamName } = teamSurprisesPanelState;
  if (!shieldChip || !teamName) return;

  const active = isShieldActive(teamName);
  const remainingMs = Math.max(0, getShieldTimeRemaining(teamName));
  if (active && remainingMs > 0) {
    const seconds = Math.ceil(remainingMs / 1000);
    shieldChip.classList.add('is-active');
    shieldChip.textContent = `🛡️ Shield active — ${formatShieldDuration(seconds)}`;
    showShieldTimer(teamName, remainingMs);
  } else {
    shieldChip.classList.remove('is-active');
    shieldChip.textContent = '🛡️ Shield inactive';
    hideShieldTimer();
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
    renderInventory(byTeam = {}) {
      renderTeamInventory(byTeam);
    },
    renderOutgoing(entries = []) {
      renderOutgoingList(entries);
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