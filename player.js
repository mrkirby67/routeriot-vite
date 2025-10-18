// --- IMPORTS ---
import { allTeams } from './data.js';
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { initializeZones } from './modules/zones.js';
import { initializePlayerUI } from './modules/playerUI.js';
import { initializePlayerScoreboard } from './modules/scoreboardManager.js';

// --- MAIN INITIALIZATION (now exported) ---
export async function initializePlayerPage() {
  const params = new URLSearchParams(window.location.search);
  const teamName = params.get('teamName') || localStorage.getItem('teamName');

  if (!teamName) {
    document.body.innerHTML = `<h1>Error: No team assigned. Please use a valid team link.</h1>`;
    return;
  }
  localStorage.setItem('teamName', teamName);

  const team = allTeams.find(t => t.name === teamName) || {};

  // Initialize all parts of the UI and logic
  initializePlayerUI(team, teamName);
  setupPlayerChat(teamName);
  initializeZones(teamName);
  listenForGameStatus(teamName);
  initializePlayerScoreboard();
}

// The DOMContentLoaded listener is now handled by the Vite build process.
// We just need to make sure the main function is exported.

