// ============================================================================
// CONTROL PAGE SCRIPT (Orchestrator Only) ✅ FINAL VERSION
// Modular structure with controlUI, controlActions, controlStatus
// Includes synced countdown timer (same as player.js)
// Auto-clears all Firestore data (chat, scores, statuses, zones) on load
// ─ but only if the game is NOT currently active
// ============================================================================
import {
  GameControlsComponent, initializeGameControlsLogic
} from './components/GameControls/GameControls.js';
import {
  BugStrikeControlComponent, initializeBugStrikeControl
} from './components/BugStrikeControl/BugStrikeControl.js';
import {
  FlatTireControlComponent, initializeFlatTireControl
} from './components/FlatTireControl/FlatTireControl.js';
import {
  RacerManagementComponent, initializeRacerManagementLogic
} from './components/RacerManagement/RacerManagement.js';
import {
  ZoneManagementComponent, initializeZoneManagementLogic
} from './components/ZoneManagement/ZoneManagement.js';
import {
  ScoreboardComponent, initializeScoreboardListener
} from './components/Scoreboard/Scoreboard.js';
import {
  GameChallengesComponent, initializeGameChallengesLogic
} from './components/GameChallenges/GameChallenges.js';
import {
  BroadcastComponent, initializeBroadcastLogic
} from './components/Broadcast/Broadcast.js';
import { TeamLinksComponent } from './components/TeamLinks/TeamLinks.js';

// 🧩 NEW: Zone Questions (Modular System)
import {
  ZoneQuestionsComponent,
  initializeZoneQuestionsUI
} from './components/ZoneQuestions/ZoneQuestions.js';

import { listenToAllMessages } from './modules/chatManager.js';
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';
import { wireGameControls } from './modules/controlUI.js';
import { watchLiveGameStatus, clearAllChatAndScores } from './modules/controlStatus.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { showFlashMessage, startCountdownTimer, clearElapsedTimer } from './modules/gameUI.js';
import { db } from './modules/config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GAME_STATE_REF = doc(db, "game", "gameState");
const controlCleanups = [];

function registerCleanup(fn, label = 'anonymous') {
  if (typeof fn !== 'function') return;
  controlCleanups.push({ fn, label });
  console.info(`🗂️ [control] registered cleanup → ${label}`);
}

function teardownControlListeners(reason = 'manual') {
  if (!controlCleanups.length) return;
  console.info(`🧹 [control] running ${controlCleanups.length} cleanup handler(s) (${reason})`);
  while (controlCleanups.length) {
    const { fn, label } = controlCleanups.pop();
    try {
      fn(reason);
      console.info(`🧼 [control] cleanup completed for ${label}`);
    } catch (err) {
      console.warn(`⚠️ [control] cleanup failed for ${label}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// 🧠 MAIN INITIALIZATION
// ---------------------------------------------------------------------------
async function main() {
  teardownControlListeners('reinitialize');
  renderAllSections();

  registerCleanup(initializeScoreboardListener() || null, 'scoreboard');
  registerCleanup(initializeGameControlsLogic() || null, 'gameControls');
  registerCleanup(initializeRacerManagementLogic() || null, 'racerManagement');
  registerCleanup(initializeGameChallengesLogic() || null, 'gameChallenges');
  registerCleanup(initializeBroadcastLogic() || null, 'broadcast');
  registerCleanup(initializeBugStrikeControl() || null, 'bugStrikeControl');

  const flatTireCleanup = await initializeFlatTireControl();
  registerCleanup(flatTireCleanup, 'flatTireControl');

  const chatCleanup = await listenToAllMessages();
  registerCleanup(chatCleanup, 'communications');

  try {
    await loadGoogleMapsApi();
    const zoneMgmtCleanup = await initializeZoneManagementLogic(true);
    registerCleanup(zoneMgmtCleanup, 'zoneManagement');
  } catch (err) {
    console.error('❌ Google Maps API load failed:', err);
    showFlashMessage('Map failed to load. Check API key.', '#c62828', 3000);
  }

  // 🧩 Initialize the Zone Questions module after Firestore is ready
  try {
    const zoneQuestionsCleanup = await initializeZoneQuestionsUI();
    registerCleanup(zoneQuestionsCleanup, 'zoneQuestions');
    console.log('✅ Zone Questions initialized.');
  } catch (err) {
    console.error('⚠️ Zone Questions init failed:', err);
    showFlashMessage('⚠️ Failed to load Zone Questions.', '#ff9800', 3000);
  }

  // 🔌 Wire control buttons
  wireGameControls();

  // 🧭 Watch status updates (standard UI elements)
  registerCleanup(watchLiveGameStatus(), 'liveGameStatus');

  // ⏱️ Synced countdown display
  registerCleanup(listenForGameStatus((state) => handleControlTimer(state)), 'controlTimer');
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

  // Core control panels
  safeSetHTML('game-controls-container', GameControlsComponent());
  safeSetHTML('scoreboard-container', ScoreboardComponent());
  safeSetHTML('bugstrike-control-container', BugStrikeControlComponent());
  safeSetHTML('flat-tire-control-container', FlatTireControlComponent());
  safeSetHTML('team-links-container', TeamLinksComponent());
  safeSetHTML('racer-management-container', RacerManagementComponent());
  safeSetHTML('zone-management-container', ZoneManagementComponent());
  safeSetHTML('game-challenges-container', GameChallengesComponent());
  safeSetHTML('broadcast-container', BroadcastComponent());

  // 🧩 Zone Questions UI panel
  safeSetHTML('zone-questions-container', ZoneQuestionsComponent());
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
// 🚀 ENTRY POINT (Auto-clears only if no active game)
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🧭 Checking current game state before initialization...');
    const snap = await getDoc(GAME_STATE_REF);
    const data = snap.exists() ? snap.data() : {};
    const status = data.status || 'waiting';

    if (status === 'active') {
      console.log('⚠️ Active game detected. Skipping cleanup.');
      showFlashMessage(
        '⚠️ Active game detected — skipping auto-clean to preserve data.',
        '#ff9800',
        4000
      );
    } else {
      console.log('🧹 Performing initial cleanup before control panel loads...');
      await clearAllChatAndScores();
      showFlashMessage('🧼 Control panel cleaned. Fresh start ready!', '#2196f3', 3000);
    }
  } catch (err) {
    console.error('⚠️ Initial cleanup check failed:', err);
    showFlashMessage('⚠️ Cleanup check failed. Proceeding without wipe.', '#c62828', 3000);
  }

  // After check (and optional cleanup), start the app
  main();
});

window.addEventListener('beforeunload', () => teardownControlListeners('page-unload'), { once: true });
