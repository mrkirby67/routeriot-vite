// ============================================================================
// CONTROL PAGE SCRIPT (Orchestrator Only)
// Modular structure with controlUI, controlActions, controlStatus
// Now includes synced countdown timer (same as player.js)
// ============================================================================
import {
  GameControlsComponent, initializeGameControlsLogic
} from './components/GameControls/GameControls.js';
import { RacerManagementComponent, initializeRacerManagementLogic } from './components/RacerManagement/RacerManagement.js';
import { ZoneManagementComponent, initializeZoneManagementLogic } from './components/ZoneManagement/ZoneManagement.js';
import { ScoreboardComponent, initializeScoreboardListener } from './components/Scoreboard/Scoreboard.js';
import { GameChallengesComponent, initializeGameChallengesLogic } from './components/GameChallenges/GameChallenges.js';
import { BroadcastComponent, initializeBroadcastLogic } from './components/Broadcast/Broadcast.js';
import { TeamLinksComponent } from './components/TeamLinks/TeamLinks.js';

import { listenToAllMessages } from './modules/chatManager.js';
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';
import { wireGameControls } from './modules/controlUI.js';
import { watchLiveGameStatus } from './modules/controlStatus.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { showFlashMessage, startCountdownTimer, clearElapsedTimer } from './modules/gameUI.js';

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

  // 🔌 Wire control buttons
  wireGameControls();

  // 🧭 Watch status updates (standard UI elements)
  watchLiveGameStatus();

  // ⏱️ NEW: Synced countdown display
  listenForGameStatus((state) => handleControlTimer(state));
}

// ---------------------------------------------------------------------------
// ⏱️ HANDLE CONTROL TIMER DISPLAY (matches player.js logic)
// ---------------------------------------------------------------------------
function handleControlTimer(state) {
  const { status, startTime, endTime, durationMinutes, remainingMs } = state || {};
  const timerEl = document.getElementById('control-timer-display');
  if (!timerEl) return;

  switch (status) {
    case 'waiting':
      timerEl.textContent = '--:--';
      clearElapsedTimer?.();
      break;

    case 'active': {
      let endTimestamp = null;
      if (endTime?.toMillis) {
        endTimestamp = endTime.toMillis();
      } else if (startTime?.toMillis && durationMinutes) {
        endTimestamp = startTime.toMillis() + durationMinutes * 60 * 1000;
      } else if (remainingMs) {
        endTimestamp = Date.now() + remainingMs;
      }

      if (endTimestamp) {
        startCountdownTimer(endTimestamp, '#control-timer-display');
      }
      break;
    }

    case 'paused':
      clearElapsedTimer?.();
      timerEl.textContent = '⏸️ PAUSED';
      break;

    case 'finished':
    case 'ended':
      clearElapsedTimer?.();
      timerEl.textContent = '00:00';
      break;

    default:
      timerEl.textContent = '--:--';
  }
}

// ---------------------------------------------------------------------------
// 🖼️ RENDER COMPONENTS (adds timer container)
// ---------------------------------------------------------------------------
function renderAllSections() {
  // Timer placeholder at top of page
  const existingTimer = document.getElementById('control-timer-container');
  if (!existingTimer) {
    const timerDiv = document.createElement('div');
    timerDiv.id = 'control-timer-container';
    timerDiv.style.cssText = `
      text-align:center;
      font-family:monospace;
      font-size:1.8rem;
      font-weight:bold;
      margin:10px auto;
      padding:8px 0;
      color:#00e676;
    `;
    timerDiv.innerHTML = `<span id="control-timer-display">--:--</span>`;
    document.body.prepend(timerDiv);
  }

  safeSetHTML('game-controls-container', GameControlsComponent());
  safeSetHTML('scoreboard-container', ScoreboardComponent());
  safeSetHTML('team-links-container', TeamLinksComponent());
  safeSetHTML('racer-management-container', RacerManagementComponent());
  safeSetHTML('zone-management-container', ZoneManagementComponent());
  safeSetHTML('game-challenges-container', GameChallengesComponent());
  safeSetHTML('broadcast-container', BroadcastComponent());
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