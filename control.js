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
  SpeedBumpControlComponent, initializeSpeedBumpControl
} from './components/SpeedBumpControl/SpeedBumpControl.js';
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
  BroadcastComponent, initializeBroadcastLogic
} from './components/Broadcast/Broadcast.js';
import {
  TeamLinksComponent,
  initializeTeamLinksLogic
} from './components/TeamLinks/TeamLinks.js';
import {
  SurpriseSelectorComponent,
  initializeSurpriseSelector
} from './components/SurpriseSelector/SurpriseSelector.js';
import { initializeWildCardsCollapsible } from './components/WildCards/WildCards.js';
import { mountControlChat, unmountControlChat } from './components/ControlChat/ControlChat.js';

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
import { showFlashMessage } from './modules/gameUI.js';
import { clearCountdownTimer, getRemainingMs, startCountdownTimer, pauseCountdownTimer } from './modules/gameTimer.js';
import { db } from '/core/config.js';
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
  registerCleanup(initializeTeamLinksLogic() || null, 'teamLinks');
  registerCleanup(initializeRacerManagementLogic() || null, 'racerManagement');
  registerCleanup(initializeBroadcastLogic() || null, 'broadcast');
  const bugStrikeCleanup = await initializeBugStrikeControl();
  registerCleanup(bugStrikeCleanup || null, 'bugStrikeControl');

  const speedBumpCleanup = await initializeSpeedBumpControl();
  registerCleanup(speedBumpCleanup, 'speedBumpControl');

  registerCleanup(initializeSurpriseSelector() || null, 'surpriseSelector');
  const wildCardsCleanup = initializeWildCardsCollapsible();
  registerCleanup(wildCardsCleanup || null, 'wildCardsCollapsible');

  const chatCleanup = await listenToAllMessages();
  registerCleanup(chatCleanup, 'communications');
  registerCleanup(() => unmountControlChat('teardown'), 'controlChat');

  let mapsAndZonesReady = false;
  try {
    await loadGoogleMapsApi();
    const zoneMgmtCleanup = await initializeZoneManagementLogic(true);
    registerCleanup(zoneMgmtCleanup, 'zoneManagement');
    mapsAndZonesReady = true;
  } catch (err) {
    console.error('❌ Google Maps API load failed:', err);
    showFlashMessage('Map failed to load. Check API key.', '#c62828', 3000);
  }

  if (mapsAndZonesReady) {
    try {
      const flatTireCleanup = await initializeFlatTireControl();
      registerCleanup(flatTireCleanup, 'flatTireControl');
    } catch (err) {
      console.error('⚠️ Flat Tire init failed:', err);
      showFlashMessage('⚠️ Flat Tire control unavailable — map data issue.', '#ff9800', 3000);
    }
  } else {
    console.warn('⚠️ Flat Tire control skipped because Maps/Zones failed to load.');
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
function getEndTimestampMs(data) {
  if (!data) return null;

  const et = data.endTime;
  if (et) {
    if (typeof et.toMillis === 'function') return et.toMillis();
    if (et.seconds) return et.seconds * 1000 + Math.floor((et.nanoseconds || 0) / 1e6);
    if (typeof et === 'number') return et;
  }

  const st = data.startTime;
  if (st && data.durationMinutes) {
    if (typeof st.toMillis === 'function') return st.toMillis() + data.durationMinutes * 60 * 1000;
    if (st.seconds) return st.seconds * 1000 + data.durationMinutes * 60 * 1000;
  }

  if (typeof data.remainingMs === 'number') return Date.now() + data.remainingMs;
  return null;
}

function handleControlTimer(state) {
  const timerEl = document.getElementById('control-timer-display');
  if (!timerEl) return;

  const { status } = state || {};

  switch (status) {
    case 'waiting':
    case 'finished':
    case 'ended':
    case 'over':
      clearCountdownTimer();
      timerEl.textContent = '00:00:00';
      break;

    case 'active': {
      const endTimestamp = getEndTimestampMs(state);
      if (endTimestamp) {
        const duration = endTimestamp - Date.now();
        startCountdownTimer(duration, (ms) => {
          timerEl.hidden = false;
          timerEl.textContent = formatCountdown(ms);
        });
      } else {
        clearCountdownTimer();
      }
      break;
    }

    case 'paused':
      pauseCountdownTimer();
      timerEl.hidden = false;
      timerEl.textContent = `⏸️ ${formatCountdown(getRemainingMs())}`;
      break;

    default:
      clearCountdownTimer();
      break;
  }
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

// ---------------------------------------------------------------------------
// 🖼️ RENDER COMPONENTS (adds timer container)
// ---------------------------------------------------------------------------
function renderAllSections() {
  // Core control panels
  safeSetHTML('game-controls-container', GameControlsComponent());
  safeSetHTML('scoreboard-container', ScoreboardComponent());
  safeSetHTML('bugstrike-control-container', BugStrikeControlComponent());
  safeSetHTML('flat-tire-control-container', FlatTireControlComponent());

  const speedbumpContainer = document.getElementById('speedbump-container');
  if (speedbumpContainer) {
    speedbumpContainer.innerHTML = SpeedBumpControlComponent();
  } else {
    console.warn('⚠️ Missing container: speedbump-container');
  }
  safeSetHTML('surprise-selector-container', SurpriseSelectorComponent());
  safeSetHTML('team-links-container', TeamLinksComponent());
  safeSetHTML('racer-management-container', RacerManagementComponent());
  safeSetHTML('zone-management-container', ZoneManagementComponent());
  safeSetHTML('broadcast-container', BroadcastComponent());

  // 🧩 Zone Questions UI panel
  safeSetHTML('zone-questions-container', ZoneQuestionsComponent());

  // 📨 Unified control chat feed
  mountControlChat('control-chat-container');
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
    if (typeof window !== 'undefined' && window.__RR_DEBUG_FIRESTORE) {
      import('./modules/firestoreIntegrity.js')
        .then(mod => mod.verifyFirestoreSchema?.())
        .catch(err => console.error('⚠️ Firestore integrity check failed:', err));
    }

    console.log('🧭 Checking current game state before initialization...');
    const snap = await getDoc(GAME_STATE_REF);
    const data = snap.exists() ? snap.data() : {};
    const status = data.status || 'waiting';

    // Removed automatic cleanup on load to preserve chat history for control panel viewing.
    // Cleanup should be triggered manually or as part of a game reset action.
  } catch (err) {
    console.error('⚠️ Initial cleanup check failed:', err);
    showFlashMessage('⚠️ Cleanup check failed. Proceeding without wipe.', '#c62828', 3000);
  }

  // After check (and optional cleanup), start the app
  main();
});

window.addEventListener('beforeunload', () => teardownControlListeners('page-unload'), { once: true });
