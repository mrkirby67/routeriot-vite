// ============================================================================
// PLAYER PAGE INITIALIZER (Streamlined for Integrated Game State & UI)
// ============================================================================
import { allTeams } from './data.js';
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { initializePlayerUI } from './modules/playerUI.js';
import { initializeZones } from './modules/zones.js'; // <-- assumes your zone system is modularized

// ---------------------------------------------------------------------------
// MAIN PLAYER INITIALIZATION
// ---------------------------------------------------------------------------
export async function initializePlayerPage() {
  // 1️⃣ Identify team from URL or cache
  const params = new URLSearchParams(window.location.search);
  const currentTeamName = params.get('team') || localStorage.getItem('teamName');

  if (!currentTeamName) {
    alert('No team assigned. Please use your official team link.');
    return;
  }
  localStorage.setItem('teamName', currentTeamName);

  // 2️⃣ Confirm valid team
  const team = allTeams.find(t => t.name === currentTeamName);
  if (!team) {
    alert(`Team "${currentTeamName}" not found in data.js`);
    return;
  }

  // 3️⃣ Initialize visual UI and chat
  initializePlayerUI(team, currentTeamName);
  setupPlayerChat(currentTeamName);

  // 4️⃣ Initialize interactive map/zones (if present)
  initializeZones?.(currentTeamName);

  // 5️⃣ Start listening to live game state (UI handled inside manager)
  listenForGameStatus();
}