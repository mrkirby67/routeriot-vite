// ============================================================================
// PLAYER PAGE INITIALIZER (Final Stable + Diagnostic Build)
// ============================================================================

import { db } from './modules/config.js';
import { allTeams } from './data.js';
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { initializePlayerUI } from './modules/playerUI.js';
import { initializeZones } from './modules/zones.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// MAIN INITIALIZER
// ---------------------------------------------------------------------------
export async function initializePlayerPage() {
  console.log('🚀 Initializing player page...');

  // 1️⃣ Identify the team from URL or cache
  const params = new URLSearchParams(window.location.search);
  const currentTeamName =
    params.get('team')?.trim() ||
    params.get('teamName')?.trim() || // ✅ Legacy link compatibility
    localStorage.getItem('teamName') ||
    null;

  console.log('🧾 Detected team param:', currentTeamName);

  if (!currentTeamName) {
    alert('No team assigned. Please use your official team link.');
    console.error('❌ Missing team name in URL or localStorage.');
    return;
  }

  // Store for refresh resilience
  localStorage.setItem('teamName', currentTeamName);

  // 2️⃣ Validate the team exists in data.js
  const team = allTeams.find(t => t.name === currentTeamName);
  if (!team) {
    alert(`Team "${currentTeamName}" not found in data.js`);
    console.error('❌ Invalid team:', currentTeamName);
    return;
  }

  console.log('✅ Found team data:', team);

  // 3️⃣ Fetch the latest game state
  let gameData = {};
  try {
    const gameDoc = await getDoc(doc(db, 'game', 'gameState'));
    gameData = gameDoc.exists() ? gameDoc.data() : {};
    console.log('🎮 Game state snapshot:', gameData);
  } catch (err) {
    console.error('⚠️ Could not fetch game state:', err);
  }

  const gameStatus = gameData.status || 'waiting';
  const isActive = gameStatus === 'active';
  const zonesReleased = !!gameData.zonesReleased;

  // 4️⃣ Display “waiting” banner if game not started
  let waitingBanner = null;
  if (!isActive) {
    waitingBanner = document.createElement('div');
    waitingBanner.id = 'waiting-banner';
    waitingBanner.textContent = '⏳ Waiting for the game to start...';
    waitingBanner.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%;
      background: #333; color: white; text-align: center;
      padding: 12px; font-weight: bold; z-index: 2000;
    `;
    document.body.appendChild(waitingBanner);
  }

  // 5️⃣ Initialize UI, Chat, and Zones
  try {
    console.log('🎨 Initializing Player UI...');
    initializePlayerUI(team, currentTeamName);

    console.log('💬 Setting up chat...');
    setupPlayerChat(currentTeamName);

    console.log('🗺️ Initializing zones...');
    initializeZones?.(currentTeamName);

    console.log('📡 Starting real-time game state listener...');
    listenForGameStatus((state) => {
      console.log('🛰️ Game state update received:', state);

      // Remove waiting banner automatically when game starts
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