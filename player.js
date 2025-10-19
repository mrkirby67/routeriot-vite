// --- IMPORTS ---
import { allTeams } from './data.js';
import { db } from './modules/config.js';
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { initializeZones } from './modules/zones.js';
import { initializePlayerUI } from './modules/playerUI.js';
import { initializePlayerScoreboard } from './modules/scoreboardManager.js';

// --- MAIN INITIALIZATION ---
export async function initializePlayerPage() {
  console.log('🚀 Initializing player page...');

  // 1️⃣ Identify the team from URL or cache
  const params = new URLSearchParams(window.location.search);
  const currentTeamName =
    params.get('team')?.trim() ||
    params.get('teamName')?.trim() || // Legacy link compatibility
    localStorage.getItem('teamName') ||
    null;

  if (!currentTeamName) {
    alert('No team assigned. Please use your official team link.');
    console.error('❌ Missing team name in URL or localStorage.');
    return;
  }
  localStorage.setItem('teamName', currentTeamName);

  // 2️⃣ Validate the team exists in data.js
  const team = allTeams.find(t => t.name === currentTeamName);
  if (!team) {
    alert(`Team "${currentTeamName}" not found in data.js`);
    console.error('❌ Invalid team:', currentTeamName);
    return;
  }

  // 3️⃣ Fetch the initial game state to show a "waiting" banner immediately
  try {
    const gameDoc = await getDoc(doc(db, 'game', 'gameState'));
    const gameData = gameDoc.exists() ? gameDoc.data() : {};
    if (gameData.status !== 'active') {
      const waitingBanner = document.createElement('div');
      waitingBanner.id = 'waiting-banner';
      waitingBanner.textContent = '⏳ Waiting for the game to start...';
      waitingBanner.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%;
        background: #333; color: white; text-align: center;
        padding: 12px; font-weight: bold; z-index: 2000;
      `;
      document.body.appendChild(waitingBanner);
    }
  } catch (err) {
    console.error('⚠️ Could not fetch initial game state:', err);
  }

  // 5️⃣ Initialize all other UI and logic modules
  try {
    initializePlayerUI(team, currentTeamName);
    setupPlayerChat(currentTeamName);
    initializeZones(currentTeamName);
    initializePlayerScoreboard();
    
    // Start the real-time listener, which will remove the banner when the game starts
    listenForGameStatus((state) => {
      if (state.status === 'active' && document.getElementById('waiting-banner')) {
        document.getElementById('waiting-banner')?.remove();
      }
    });
  } catch (err) {
    console.error('🔥 Error during initialization:', err);
    alert('Error initializing player. Check console for details.');
  }

  console.log('✅ Player initialization complete.');
}

