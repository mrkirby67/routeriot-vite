// ============================================================================
// Pew Pursuit shared UI helpers.
// These functions render basic scaffolding for control + player pages.
// ============================================================================

export function qs(selector) {
  return document.querySelector(selector);
}

export function formatTimer({ startTime, endTime }) {
  if (!startTime || !endTime) return '--:--';
  const now = Date.now();
  const total = Math.max(endTime - startTime, 0);
  const elapsed = Math.max(now - startTime, 0);
  const remaining = Math.max(total - elapsed, 0);
  return formatDuration(remaining);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function renderTimerDisplay(element, state) {
  if (!element) return;
  element.textContent = formatTimer(state || {});
}

export function renderTeamList(container, teams = []) {
  if (!container) return;
  if (!teams.length) {
    container.innerHTML = '<p>No teams registered yet.</p>';
    return;
  }
  const listItems = teams
    .map(
      (team) => `
        <li class="team-row ${team.isOnline ? 'online' : 'offline'}">
          <div>
            <strong>${team.name || team.id}</strong>
            <small>${team.slogan || ''}</small>
          </div>
          <span class="status-chip ${team.isOnline ? 'ready' : 'missing'}">
            ${team.isOnline ? 'Checked In' : 'Offline'}
          </span>
        </li>
      `,
    )
    .join('');
  container.innerHTML = `<ul class="team-list">${listItems}</ul>`;
}

export function renderScoreboardTable(container, entries = []) {
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = '<p>Scoreboard will populate once teams visit zones.</p>';
    return;
  }
  const rows = entries
    .map(
      (entry, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${entry.teamName}</td>
          <td>${entry.score}</td>
          <td>${entry.visitedCount}</td>
        </tr>
      `,
    )
    .join('');
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>Score</th>
          <th>Zones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function renderZoneTable(container, zones = [], options = {}) {
  if (!container) return;
  if (!zones.length) {
    container.innerHTML = '<p>No zones configured yet.</p>';
    return;
  }
  const visitedMap = options.visitedMap || {};
  const activeTeam = options.activeTeam;
  const onVisitClick = options.onVisitClick;

  const rows = zones
    .map((zone) => {
      const visits = visitedMap[activeTeam] || [];
      const isDone = activeTeam ? visits.includes(zone.id) : false;
      const buttonLabel = isDone ? 'Completed' : 'Visit Zone';
      const buttonState = isDone ? 'disabled' : '';
      return `
        <tr>
          <td>${zone.name || zone.id}</td>
          <td>${Number(zone.points || 0)}</td>
          <td>${zone.radiusMeters || 75}m</td>
          <td>
            <button data-zone="${zone.id}" ${buttonState}>
              ${buttonLabel}
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <table class="data-table pew-zone-table">
      <thead>
        <tr>
          <th>Zone</th>
          <th>Points</th>
          <th>Radius</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  if (onVisitClick) {
    container.querySelectorAll('button[data-zone]').forEach((button) => {
      button.addEventListener('click', () => {
        const zoneId = button.getAttribute('data-zone');
        const zone = zones.find((z) => z.id === zoneId);
        if (zone) onVisitClick(zone);
      });
    });
  }
}

export function setTeamHeadline(element, teamName) {
  if (!element) return;
  element.textContent = teamName ? `${teamName} – Pew Pursuit` : 'Pew Pursuit Player';
}

export function renderGameStatus(element, status) {
  if (!element) return;
  element.textContent = status || 'Not Started';
}

export function setMapPlaceholder(container) {
  if (!container) return;
  container.innerHTML = '<p>Loading Pew Pursuit map…</p>';
}

export function reflectCountdownStatus(element, state) {
  renderTimerDisplay(element, state);
}

// TODO: Add UI helpers for CTA to open zone modals + highlight map markers.
