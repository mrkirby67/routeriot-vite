// ============================================================================
// CONTROL PAGE SCRIPT (Merged Final)
// Renders and manages all host controls for Route Riot
// ============================================================================

// ---------------------------------------------------------------------------
// IMPORTS
// ---------------------------------------------------------------------------
import { GameControlsComponent, initializeGameControlsLogic } from './components/GameControls/GameControls.js';
import { RacerManagementComponent, initializeRacerManagementLogic } from './components/RacerManagement/RacerManagement.js';
import { ZoneManagementComponent, initializeZoneManagementLogic } from './components/ZoneManagement/ZoneManagement.js';
import { ScoreboardComponent, initializeScoreboardListener } from './components/Scoreboard/Scoreboard.js';
import { GameChallengesComponent, initializeGameChallengesLogic } from './components/GameChallenges/GameChallenges.js';
import { BroadcastComponent, initializeBroadcastLogic } from './components/Broadcast/Broadcast.js';
import { TeamLinksComponent } from './components/TeamLinks/TeamLinks.js';

import { listenToAllMessages } from './modules/chatManager.js';
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';
import { setGameStatus, releaseZones, listenForGameStatus } from './modules/gameStateManager.js';
import { showCountdownBanner, showFlashMessage } from './modules/gameCountdown.js';

// ---------------------------------------------------------------------------
// MAIN INITIALIZATION
// ---------------------------------------------------------------------------
async function main() {
  // 1️⃣ Render all static sections
  safeSetHTML('game-controls-container', GameControlsComponent());
  safeSetHTML('scoreboard-container', ScoreboardComponent());
  safeSetHTML('team-links-container', TeamLinksComponent());
  safeSetHTML('racer-management-container', RacerManagementComponent());
  safeSetHTML('zone-management-container', ZoneManagementComponent());
  safeSetHTML('game-challenges-container', GameChallengesComponent());
  safeSetHTML('broadcast-container', BroadcastComponent());

  // 2️⃣ Initialize logic modules
  initializeScoreboardListener();
  initializeGameControlsLogic();
  initializeRacerManagementLogic();
  initializeGameChallengesLogic();
  initializeBroadcastLogic();
  listenToAllMessages();

  // 3️⃣ Load Google Maps then activate zone management
  try {
    await loadGoogleMapsApi();
    initializeZoneManagementLogic(true);
  } catch (err) {
    console.error('❌ Google Maps API load failed:', err);
    showFlashMessage('Map Error', '#c62828', 2500);
  }

  // 4️⃣ Wire admin buttons + live state listener
  wireGameControls();
  watchLiveGameStatus();
}

// ---------------------------------------------------------------------------
// 🎮 CONTROL BUTTONS (Start, Release, End, Reset)
// ---------------------------------------------------------------------------
function wireGameControls() {
  const startBtn = document.getElementById('start-game-btn');
  const releaseBtn = document.getElementById('release-zones-btn');
  const endBtn = document.getElementById('end-game-btn');
  const resetBtn = document.getElementById('reset-game-btn');

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try {
        await setGameStatus('active', true);
        showCountdownBanner({ parent: document.body });
        showFlashMessage('✅ Game Started!', '#2e7d32', 3000);
      } catch (e) {
        console.error('Error starting game:', e);
        showFlashMessage('Start failed', '#c62828', 2500);
      }
    });
  }

  if (releaseBtn) {
    releaseBtn.addEventListener('click', async () => {
      try {
        await releaseZones();
        showFlashMessage('Zones Released!', '#1976d2', 3000);
      } catch (e) {
        console.error('Error releasing zones:', e);
        showFlashMessage('Zone release failed', '#c62828', 2500);
      }
    });
  }

  if (endBtn) {
    endBtn.addEventListener('click', async () => {
      try {
        await setGameStatus('ended');
        showFlashMessage('🏁 Game Ended!', '#c62828', 4000);
      } catch (e) {
        console.error('Error ending game:', e);
        showFlashMessage('End failed', '#c62828', 2500);
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset game state to waiting?')) {
        try {
          await setGameStatus('waiting', false);
          showFlashMessage('🔄 Game Reset.', '#757575', 2500);
        } catch (e) {
          console.error('Error resetting game:', e);
          showFlashMessage('Reset failed', '#c62828', 2500);
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 🔁 LIVE GAME STATE UPDATES (Host Dashboard)
// ---------------------------------------------------------------------------
function watchLiveGameStatus() {
  listenForGameStatus((state) => {
    const { status, zonesReleased } = state;
    console.log('🎯 Live game state update:', state);

    const statusEl = document.getElementById('live-game-status');
    const zonesEl  = document.getElementById('live-zones-status');

    if (statusEl) statusEl.textContent = (status || 'waiting').toUpperCase();
    if (zonesEl)  zonesEl.textContent  = zonesReleased ? 'Unlocked' : 'Locked';

    switch (status) {
      case 'active':
        if (zonesReleased) {
          showFlashMessage('Zones are LIVE!', '#2e7d32');
        }
        break;
      case 'ended':
        showFlashMessage('Game Over!', '#7b1fa2');
        break;
      case 'waiting':
      default:
        showFlashMessage('Waiting to start...', '#616161');
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// 🧩 HELPERS
// ---------------------------------------------------------------------------
function safeSetHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
  else console.warn(`⚠️ Missing container: ${id}`);
}

// ---------------------------------------------------------------------------
// 🧠 ENTRY POINT
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', main);