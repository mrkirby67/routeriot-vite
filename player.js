// ============================================================================
// PLAYER PAGE INITIALIZER (Finalized Integration)
// ============================================================================
import { db, firebaseConfig } from './modules/config.js';
import { allTeams } from './data.js';
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { startElapsedTimer, clearElapsedTimer, showCountdownBanner, showFlashMessage } from './modules/gameUI.js';
import { initializePlayerUI } from './modules/playerUI.js';
import { addPointsToTeam, updateControlledZones } from './modules/scoreboardManager.js';
import {
  doc, onSnapshot, collection, getDoc, getDocs, setDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// LOCAL STATE
// ---------------------------------------------------------------------------
let currentTeamName = null;
let zonesEnabled = false;
let countdownShown = false;
let challengeState = { zoneId: null, questionId: null, attemptsLeft: 3 };

// ---------------------------------------------------------------------------
// GAME INITIALIZATION
// ---------------------------------------------------------------------------
export async function initializePlayerPage() {
  const params = new URLSearchParams(window.location.search);
  currentTeamName = params.get('team') || localStorage.getItem('teamName') || null;
  if (!currentTeamName) {
    alert('No team assigned. Please use your official team link.');
    return;
  }
  localStorage.setItem('teamName', currentTeamName);

  // Load from local allTeams data
  const team = allTeams.find(t => t.name === currentTeamName);
  if (!team) {
    alert(`Team "${currentTeamName}" not found in data.js`);
    return;
  }

  // Initialize player UI from static + live Firestore roster
  initializePlayerUI(team, currentTeamName);

  // Setup chat & zones
  setupPlayerChat(currentTeamName);
  initializeZones(currentTeamName);

  // Watch game state
  listenForGameStatus(handleGameStateUpdate);
}

// ---------------------------------------------------------------------------
// REACT TO GAME STATE CHANGES
// ---------------------------------------------------------------------------
function handleGameStateUpdate({ status = 'waiting', zonesReleased = false, startTime = null }) {
  document.getElementById('game-status').textContent = status.toUpperCase();
  zonesEnabled = (status === 'active' && zonesReleased);

  switch (status) {
    case 'waiting':
      clearElapsedTimer();
      showFlashMessage('Waiting for host to start...', '#616161');
      break;

    case 'active':
      if (zonesEnabled && !countdownShown) {
        countdownShown = true;
        showCountdownBanner({ parent: document.body });
        showFlashMessage('The Race is ON!', '#2e7d32');
      }
      if (startTime) startElapsedTimer(startTime);
      break;

    case 'ended':
      clearElapsedTimer();
      showFlashMessage('🏁 Game Over! Return to base.', '#c62828', 4000);
      break;
  }
}