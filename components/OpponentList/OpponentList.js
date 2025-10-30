// components/OpponentList/OpponentList.js

/**
 * @file Renders and manages the list of opponent players.
 */

import * as teamService from "../../services/teamService.js";

/**
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
