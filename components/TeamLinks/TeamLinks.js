// File: components/TeamLinks/TeamLinks.js
import { allTeams } from '../../data.js';
import styles from './TeamLinks.module.css';
import { escapeHtml } from '../../modules/utils.js';

/** ---------------------------------------------------------------------------
 *  Component markup
 *  ------------------------------------------------------------------------ */
export function TeamLinksComponent() {
  const tableRowsHtml = allTeams.map(team => {
    const teamUrl = `/player.html?teamName=${encodeURIComponent(team.name)}`;
    const safeTeamName = escapeHtml(team.name);
    const safeTeamUrl = escapeHtml(teamUrl);
    return `
      <tr>
        <td>${safeTeamName}</td>
        <td><a href="${safeTeamUrl}" target="_blank" rel="noopener noreferrer">${safeTeamUrl}</a></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="${styles.controlSection}">
      <h2>Team Links</h2>
      <p>Share these unique URLs with each team captain.</p>
      <table class="${styles.dataTable}" id="team-links-table">
        <thead>
          <tr>
            <th>Team Name</th>
            <th>Player Page URL</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

/** ---------------------------------------------------------------------------
 *  Initialization Logic (optional)
 *  ------------------------------------------------------------------------ */
export function initializeTeamLinksLogic() {
  // Add any interactive logic here later if you need (copy buttons, filters, etc.)
}
