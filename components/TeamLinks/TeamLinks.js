// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/TeamLinks/TeamLinks.js
// PURPOSE: File: components/TeamLinks/TeamLinks.js
// DEPENDS_ON: ../../data.js, ../../modules/utils.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

// File: components/TeamLinks/TeamLinks.js
import { allTeams } from '../../data.js';
import styles from './TeamLinks.module.css';
import { escapeHtml } from '../../modules/utils.js';

/* ---------------------------------------------------------------------------
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

/* ---------------------------------------------------------------------------
 *  Initialization Logic (optional)
 *  ------------------------------------------------------------------------ */
export function initializeTeamLinksLogic() {
  // Add any interactive logic here later if you need (copy buttons, filters, etc.)
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/TeamLinks/TeamLinks.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: TeamLinksComponent, initializeTeamLinksLogic
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
