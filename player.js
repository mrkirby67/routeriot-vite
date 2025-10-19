// ============================================================================
// File: player.js
// Purpose: Player-side entry point with true pause/resume + synced countdown
// ============================================================================
import { allTeams } from './data.js';
import { db } from './modules/config.js';
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { initializeZones } from './modules/zones.js';
import {
  initializePlayerUI,
  updatePlayerTimer,
  showPausedOverlay,
  hidePausedOverlay,
  showGameOverOverlay
} from './modules/playerUI.js';
import { initializePlayerScoreboard } from './modules/scoreboardManager.js';
import { showFlashMessage } from './modules/gameUI.js';

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================
export async function initializePlayerPage() {
  console.log('🚀 Initializing player page...');

  // 1️⃣ Identify the team
  const params = new URLSearchParams(window.location.search);
  const currentTeamName =
    params.get('teamName')?.trim() ||
    params.get('team')?.trim() ||
    localStorage.getItem('teamName') ||
    null;

  if (!currentTeamName) {
    alert('No team assigned. Please use your official team link.');
    console.error('❌ Missing team name.');
    return;
  }

  localStorage.setItem('teamName', currentTeamName);

  // 2️⃣ Validate team exists
  const team = allTeams.find(t => t.name === currentTeamName);
  if (!team) {
    alert(`Team "${currentTeamName}" not found in data.js`);
    console.error('❌ Invalid team:', currentTeamName);
    return;
  }

  // 3️⃣ Initialize core UI + modules
  try {
    initializePlayerUI(team, currentTeamName);
    setupPlayerChat(currentTeamName);
    initializeZones(currentTeamName);
    initializePlayerScoreboard();
  } catch (err) {
    console.error('🔥 Error during module initialization:', err);
    alert('Error initializing player modules. Check console.');
    return;
  }

  // 4️⃣ First paint: show waiting (we’ll override below if active)
  showWaitingBanner();
  setInlineTimer('--:--:--'); // make sure inline timer shows something

  // 5️⃣ If game is active NOW, start the timer immediately (don’t wait for snapshot)
  try {
    const gameDoc = await getDoc(doc(db, 'game', 'gameState'));
    const gameData = gameDoc.exists() ? gameDoc.data() : null;

    if (gameData?.status === 'active') {
      removeWaitingBanner();
      const endTimestamp = getEndTimestampMs(gameData);
      if (endTimestamp) {
        startPlayerTimer(endTimestamp);
        showFlashMessage('🏁 Game in Progress!', '#2e7d32', 1200);
      } else {
        console.warn('⚠️ Active game but no valid end time yet.', gameData);
      }
    }
  } catch (err) {
    console.error('⚠️ Could not fetch initial game state:', err);
  }

  // 6️⃣ Live game state (pause/resume/finish + future resyncs)
  listenForGameStatus((state) => handleLiveGameState(state));

  console.log('✅ Player initialized for team:', currentTeamName);
}

// ============================================================================
// 🧠 Helper: get end timestamp (ms) from a gameState object
// ============================================================================
function getEndTimestampMs(data) {
  if (!data) return null;

  // endTime (handle Timestamp, object, or number)
  if (data.endTime) {
    const endTime = data.endTime;
    if (typeof endTime.toMillis === 'function') {
      return endTime.toMillis();
    } else if (endTime.seconds) {
      return endTime.seconds * 1000 + Math.floor((endTime.nanoseconds || 0) / 1e6);
    } else if (typeof endTime === 'number') {
      return endTime;
    }
  }

  // startTime + durationMinutes
  if (data.startTime && data.durationMinutes) {
    const st = data.startTime;
    if (typeof st.toMillis === 'function') {
      return st.toMillis() + data.durationMinutes * 60 * 1000;
    } else if (st.seconds) {
      return st.seconds * 1000 + data.durationMinutes * 60 * 1000;
    }
  }

  // remainingMs (resume)
  if (typeof data.remainingMs === 'number') {
    return Date.now() + data.remainingMs;
  }

  return null;
}

// ============================================================================
// 🕹️ HANDLE GAME STATE UPDATES
// ============================================================================
let lastRemainingMs = null;
let playerTimerInterval = null;
let pausedAt = null;

function handleLiveGameState(state) {
  const { status } = state || {};

  switch (status) {
    // 🟡 WAITING
    case 'waiting': {
      showWaitingBanner();
      hidePausedOverlay();
      setInlineTimer('--:--:--');
      pausePlayerTimer();
      break;
    }

    // 🟢 ACTIVE
    case 'active': {
      removeWaitingBanner();
      hidePausedOverlay();

      console.log("🧭 RAW gameState:", state);

      let endTimestamp = null;
      const { endTime, startTime, durationMinutes, remainingMs } = state;

      // 🔍 Robust handling for all timestamp shapes
      if (endTime) {
        if (typeof endTime.toMillis === 'function') {
          endTimestamp = endTime.toMillis();
        } else if (endTime.seconds) {
          endTimestamp = endTime.seconds * 1000 + Math.floor((endTime.nanoseconds || 0) / 1e6);
        } else if (typeof endTime === 'number') {
          endTimestamp = endTime;
        }
      }

      // ⏰ Fallbacks
      if (!endTimestamp && startTime?.seconds && durationMinutes) {
        endTimestamp = startTime.seconds * 1000 + durationMinutes * 60 * 1000;
      } else if (!endTimestamp && typeof remainingMs === 'number') {
        endTimestamp = Date.now() + remainingMs;
      }

      console.log("⏱️ Calculated endTimestamp:", endTimestamp);

      if (endTimestamp && !isNaN(endTimestamp)) {
        startPlayerTimer(endTimestamp);
        showFlashMessage('🏁 Game in Progress!', '#2e7d32', 1200);
      } else {
        console.warn('⚠️ No valid end time found for timer sync (active).', state);
        setInlineTimer('--:--:--');
      }

      pausedAt = null;
      break;
    }

    // ⏸️ PAUSED
    case 'paused': {
      pausedAt = Date.now();
      lastRemainingMs = stopAndCalculateRemaining();
      showPausedOverlay();
      showFlashMessage('⏸️ Game Paused by Control', '#ff9800', 1600);
      if (typeof lastRemainingMs === 'number') {
        setInlineTimer(formatHMS(lastRemainingMs));
      }
      break;
    }

    // 🏁 FINISHED / ENDED
    case 'finished':
    case 'ended': {
      pausePlayerTimer();
      setInlineTimer('00:00:00');
      hidePausedOverlay();
      showGameOverOverlay();
      showFlashMessage('🏁 Game Over! Return to base.', '#c62828', 3000);
      break;
    }

    default:
      console.warn('⚠️ Unknown status:', status);
      break;
  }
}

// ============================================================================
// 🧭 UI HELPERS
// ============================================================================
function showWaitingBanner() {
  if (document.getElementById('waiting-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'waiting-banner';
  banner.textContent = '⏳ Waiting for the game to start...';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%;
    background: #333; color: white; text-align: center;
    padding: 12px; font-weight: bold; z-index: 2000;
  `;
  document.body.appendChild(banner);
}
function removeWaitingBanner() {
  document.getElementById('waiting-banner')?.remove();
}
function setInlineTimer(text) {
  const el = document.getElementById('time-remaining');
  if (el) el.textContent = text;
  updatePlayerTimer(text);
}

// ============================================================================
// ⏱️ TIMER HANDLERS
// ============================================================================
function startPlayerTimer(endTimestamp) {
  clearInterval(playerTimerInterval);
  window._currentEndTime = endTimestamp;
  updateTimerDisplay(endTimestamp);
  playerTimerInterval = setInterval(() => {
    updateTimerDisplay(endTimestamp);
  }, 1000);
}
function pausePlayerTimer() {
  clearInterval(playerTimerInterval);
  playerTimerInterval = null;
}
function stopAndCalculateRemaining() {
  if (!window._currentEndTime) return null;
  const remaining = window._currentEndTime - Date.now();
  pausePlayerTimer();
  return remaining > 0 ? remaining : 0;
}
function formatHMS(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function updateTimerDisplay(endTimestamp) {
  const remaining = endTimestamp - Date.now();
  if (remaining <= 0) {
    clearInterval(playerTimerInterval);
    setInlineTimer('00:00:00');
    showGameOverOverlay();
    return;
  }
  setInlineTimer(formatHMS(remaining));
}

// ============================================================================
// 🚀 ENTRY POINT
// ============================================================================
document.addEventListener('DOMContentLoaded', initializePlayerPage);