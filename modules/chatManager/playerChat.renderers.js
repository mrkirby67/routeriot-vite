// ============================================================================
// FILE: modules/chatManager/playerChat.renderers.js
// PURPOSE: Renders Team Surprises inventory and outgoing lists
// ============================================================================

import { escapeHtml } from '../utils.js';
import { attachSendHandlers, updateSendButtonAvailability } from './playerChat.handlers.js';
import { SPEEDBUMP_STATUS } from '../../services/speed-bump/speedBumpService.js';

function escapeAttribute(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderTeamInventory(state, byTeam = {}, options = {}) {
  if (!state?.inventoryList) return;

  const section = state.section;
  const list = state.inventoryList;
  const {
    available = state.availableCounts || {},
    teamNames = [],
    outgoingEntries = state.outgoingEntries || [],
    onRelease = state.onRelease || null
  } = options || {};

  const flatAvailable = Number(available.flatTire) || 0;
  const bugAvailable = Number(available.bugSplat) || 0;
  const speedAvailable = Number(available.speedBump) || 0;

  const knownTeams = new Set(teamNames.filter(Boolean));
  const currentPlayerTeam = state.teamName;

  const listedTeams = Array.from(knownTeams)
    .filter((teamName) => teamName && teamName !== currentPlayerTeam)
    .sort((a, b) => a.localeCompare(b));

  if (!listedTeams.length) {
    list.innerHTML = '<li class="team-surprises-empty">No teams available for surprises.</li>';
    updateSendButtonAvailability(section, state, available);
    return;
  }

  const rows = listedTeams.map((teamName) => {
    const safeTeam = escapeHtml(teamName);
    const attributeTeam = escapeAttribute(teamName);
    const activeEntry = outgoingEntries.find((entry = {}) =>
      String(entry.victimId || '').trim().toLowerCase() === teamName.trim().toLowerCase()
    );
    const statusLabel = activeEntry
      ? `${String(activeEntry.status).toLowerCase() === SPEEDBUMP_STATUS.WAITING_RELEASE ? 'Awaiting release' : 'Active'} · ${formatCountdown(activeEntry.remainingMs)}`
      : '';
    const releaseBtn = activeEntry
      ? `
          <button
            type="button"
            class="team-btn team-btn--speed"
            data-action="release-speedbump"
            data-assignment-id="${escapeAttribute(activeEntry.id || '')}"
            data-target="${attributeTeam}"
          >
            Release Speed Bump
          </button>
        `
      : '';

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
          ${releaseBtn}
        </div>
        ${statusLabel ? `<p class="team-surprises-status">⏳ ${escapeHtml(statusLabel)}</p>` : ''}
      </li>
    `;
  }).join('');

  list.innerHTML = rows;
  attachSendHandlers({ section, state });
  updateSendButtonAvailability(section, state, available);

  if (onRelease) {
    list.querySelectorAll('[data-action="release-speedbump"]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        const assignmentId = button.dataset.assignmentId;
        const victim = button.dataset.target;
        onRelease({ assignmentId, victimId: victim });
      });
    });
  }
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms)) return '--:--';
  const clamped = Math.max(0, ms);
  const mins = Math.floor(clamped / 60000);
  const secs = Math.floor((clamped % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function renderMyInventory(state, counts = {}) {
  if (!state) return;

  const section = state.section;
  const body = section?.querySelector('#team-surprises-body');
  if (!body) return;

  const {
    flatTire = 0,
    bugSplat = 0,
    superShieldWax = 0,
    speedBump = 0
  } = counts || {};

  state.availableCounts = { flatTire, bugSplat, superShieldWax, speedBump };

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
      data-team="${escapeAttribute(state.teamName || '')}"
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

  attachSendHandlers({ section, state });
  updateSendButtonAvailability(section, state, { flatTire, bugSplat, speedBump });
}
