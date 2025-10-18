// ============================================================================
// PLAYER PAGE INITIALIZER (Diagnostic Hardened Build)
// ============================================================================
import { db } from './modules/config.js';
import { allTeams } from './data.js';
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { initializePlayerUI } from './modules/playerUI.js';
import { initializeZones } from './modules/zones.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function initializePlayerPage() {
  console.log('🚀 Initializing player page...');

  const params = new URLSearchParams(window.location.search);
  const currentTeamName = params.get('team')?.trim() || localStorage.getItem('teamName') || null;
  console.log('🧾 Detected team param:', currentTeamName);

  if (!currentTeamName) {
    alert('No team assigned. Please use your official team link.');
    console.error('❌ Missing team name in URL or localStorage.');
    return;
  }

  localStorage.setItem('teamName', currentTeamName);

  const team = allTeams.find(t => t.name === currentTeamName);
  if (!team) {
    alert(`Team "${currentTeamName}" not found. Please use your official link.`);
    console.error('❌ Invalid team:', currentTeamName);
    return;
  }

  console.log('✅ Found team data:', team);

  // Check current game state
  const gameDoc = await getDoc(doc(db, 'game', 'gameState'));
  const gameData = gameDoc.exists() ? gameDoc.data() : {};
  console.log('🎮 Game state snapshot:', gameData);

  const isActive = gameData.status === 'active';
  if (!isActive) {
    console.log('⏳ Game not active yet.');
    const banner = document.createElement('div');
    banner.textContent = '⏳ Waiting for the game to start...';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%;
      background: #333; color: white; text-align: center;
      padding: 12px; font-weight: bold; z-index: 2000;
    `;
    document.body.appendChild(banner);
  }

  try {
    console.log('🎨 Initializing UI...');
    initializePlayerUI(team, currentTeamName);
    console.log('💬 Initializing chat...');
    setupPlayerChat(currentTeamName);
    console.log('🗺️ Initializing zones...');
    initializeZones?.(currentTeamName);
    console.log('📡 Listening for game status...');
    listenForGameStatus();
  } catch (err) {
    console.error('🔥 Error during initialization:', err);
  }

  console.log('✅ Player initialization complete.');
}