// ============================================================================
// PLAYER PAGE INITIALIZER (Final - Safe Link + Integrated Game State & UI)
// ============================================================================
import { db } from './modules/config.js';
import { allTeams } from './data.js';
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { initializePlayerUI } from './modules/playerUI.js';
import { initializeZones } from './modules/zones.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// MAIN PLAYER INITIALIZATION
// ---------------------------------------------------------------------------
export async function initializePlayerPage() {
  // 1️⃣ Identify team from URL or cache
  const params = new URLSearchParams(window.location.search);
  const currentTeamName = params.get('team')?.trim() || null;

  // --- Validate team link ---
  if (!currentTeamName) {
    alert('No team assigned. Please use your official team link.');
    window.location.href = '/'; // Optional redirect to home
    return;
  }

  // Save to localStorage for reconnection
  localStorage.setItem('teamName', currentTeamName);

  // 2️⃣ Confirm team exists in data.js
  const team = allTeams.find(t => t.name === currentTeamName);
  if (!team) {
    alert(`Team "${currentTeamName}" not found. Please use your official link.`);
    return;
  }

  // 3️⃣ Check current game state before loading UI
  const gameDoc = await getDoc(doc(db, 'game', 'gameState'));
  const gameData = gameDoc.exists() ? gameDoc.data() : {};
  const isActive = gameData.status === 'active';

  // 4️⃣ Quiet “waiting for start” banner (only before game begins)
  if (!isActive) {
    const banner = document.createElement('div');
    banner.textContent = '⏳ Waiting for the game to start...';
    banner.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100%;
      background: #333;
      color: white;
      text-align: center;
      padding: 12px;
      font-weight: bold;
      z-index: 2000;
    `;
    document.body.appendChild(banner);
  }

  // 5️⃣ Initialize player UI + chat + zones quietly
  initializePlayerUI(team, currentTeamName);
  setupPlayerChat(currentTeamName);
  initializeZones?.(currentTeamName);

  // 6️⃣ Listen for game status updates (start triggers countdowns, etc.)
  listenForGameStatus();
}