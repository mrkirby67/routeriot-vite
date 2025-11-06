// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/OpponentList/OpponentList.js
// PURPOSE: Renders and manages the list of opponent players.
// DEPENDS_ON: services/teamService.js
// USED_BY: features/player-page/playerPageController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

// components/OpponentList/OpponentList.js

/*
 * @file Renders and manages the list of opponent players.
 */

import * as teamService from "../../services/teamService.js";

/*
 * Initializes the opponent list component.
 * Fetches team data and renders the list.
 */

export async function initializeOpponentList() {
  const teams = await teamService.getAllTeams();
  const opponentListContainer = document.getElementById("opponent-list"); // Assuming an element with this ID exists

  if (opponentListContainer) {
    // Clear previous list
    opponentListContainer.innerHTML = "";
    // Render new list
    teams.forEach(team => {
      const teamElement = document.createElement("div");
      teamElement.textContent = team.name; // Assuming team object has a 'name' property
      opponentListContainer.appendChild(teamElement);
    });
  }
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/OpponentList/OpponentList.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: initializeOpponentList
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
