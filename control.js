// ============================================================================
// CONTROL PAGE SCRIPT (FINALIZED MODULAR BUILD)
// Emails sent on “Racers Take Your Marks” instead of Start
// ============================================================================

// ---------------------------------------------------------------------------
// 🔧 IMPORTS
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
import { showCountdownBanner, showFlashMessage } from './modules/gameUI.js';
import { emailAllTeams } from './modules/emailTeams.js';
import { allTeams } from './data.js';

// ---------------------------------------------------------------------------
// 🧠 MAIN INITIALIZATION
// ---------------------------------------------------------------------------
async function main() {
  renderAllSections();
  initializeScoreboardListener();
  initializeGameControlsLogic();
  initializeRacerManagementLogic();
  initializeGameChallengesLogic();
  initializeBroadcastLogic();
  listenToAllMessages();

  try {
    await loadGoogleMapsApi();
    initializeZoneManagementLogic(true);
  } catch (err) {
    console.error('❌ Google Maps API load failed:', err);
    showFlashMessage('Map failed to load. Check API key.', '#c62828', 3000);
  }

  wireGameControls();
  watchLiveGameStatus();
}

// ---------------------------------------------------------------------------
// 🕹️ RENDER COMPONENTS
// ---------------------------------------------------------------------------
function renderAllSections() {
  safeSetHTML('game-controls-container', GameControlsComponent());
  safeSetHTML('scoreboard-container', ScoreboardComponent());
  safeSetHTML('team-links-container', TeamLinksComponent());
  safeSetHTML('racer-management-container', RacerManagementComponent());
  safeSetHTML('zone-management-container', ZoneManagementComponent());
  safeSetHTML('game-challenges-container', GameChallengesComponent());
  safeSetHTML('broadcast-container', BroadcastComponent());
}

// ---------------------------------------------------------------------------
// 🎮 CONTROL BUTTONS
// ---------------------------------------------------------------------------
function wireGameControls() {
  const startBtn    = document.getElementById('start-game-btn');
  const releaseBtn  = document.getElementById('release-zones-btn');
  const endBtn      = document.getElementById('end-game-btn');
  const resetBtn    = document.getElementById('reset-game-btn');
  const marksBtn    = document.getElementById('take-marks-btn'); // 🏁 NEW BUTTON

  // 🏁 RACERS TAKE YOUR MARKS — opens Gmail compose popups
  if (marksBtn) {
    marksBtn.addEventListener('click', () => {
      try {
        const rulesBox  = document.getElementById('rules-textarea');
        const rulesText = rulesBox ? rulesBox.value.trim() : '';

        const activeTeams = allTeams.reduce((acc, t) => {
          acc[t.name] = [
            { email: `${t.name.toLowerCase().replace(/\s+/g, '')}@example.com` }
          ];
          return acc;
        }, {});

        emailAllTeams(rulesText, activeTeams);
        showFlashMessage('📧 Team emails opened in Gmail!', '#1565c0', 3000);
      } catch (err) {
        console.error('Email send error:', err);
        showFlashMessage('Could not open Gmail windows.', '#c62828', 3000);
      }
    });
  }

  // ▶️ START GAME
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try {
        await setGameStatus('active', true);
        showCountdownBanner({ parent: document.body });
        showFlashMessage('✅ Game Started!', '#2e7d32', 3000);
      } catch (e) {
        console.error('Error starting game:', e);
        showFlashMessage('Start failed.', '#c62828', 2500);
      }
    });
  }

  // 🌍 RELEASE ZONES
  if (releaseBtn) {
    releaseBtn.addEventListener('click', async () => {
      try {
        await releaseZones();
        showFlashMessage('Zones Released!', '#1976d2', 3000);
      } catch (e) {
        console.error('Error releasing zones:', e);
        showFlashMessage('Zone release failed.', '#c62828', 2500);
      }
    });
  }

  // 🏁 END GAME
  if (endBtn) {
    endBtn.addEventListener('click', async () => {
      try {
        await setGameStatus('ended');
        showFlashMessage('🏁 Game Ended!', '#c62828', 4000);
      } catch (e) {
        console.error('Error ending game:', e);
        showFlashMessage('End failed.', '#c62828', 2500);
      }
    });
  }

  // 🔄 RESET
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset game state to WAITING?')) {
        try {
          await setGameStatus('waiting', false);
          showFlashMessage('🔄 Game Reset.', '#757575', 2500);
        } catch (e) {
          console.error('Error resetting game:', e);
          showFlashMessage('Reset failed.', '#c62828', 2500);
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 🔁 LIVE GAME STATE UPDATES
// ---------------------------------------------------------------------------
function watchLiveGameStatus() {
  listenForGameStatus((state) => {
    const { status = 'waiting', zonesReleased = false } = state;
    console.log('🎯 Live game state update:', state);

    const statusEl = document.getElementById('live-game-status');
    const zonesEl  = document.getElementById('live-zones-status');

    if (statusEl) statusEl.textContent = status.toUpperCase();
    if (zonesEl)  zonesEl.textContent  = zonesReleased ? 'Unlocked' : 'Locked';

    switch (status) {
      case 'active':
        if (zonesReleased) showFlashMessage('Zones are LIVE!', '#2e7d32');
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
// 🚀 ENTRY POINT
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', main);