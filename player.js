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
// Supports Firestore Timestamp, {seconds,nanoseconds}, numbers, remainingMs
// ============================================================================
function getEndTimestampMs(data) {
  if (!data) return null;

  // endTime present
  if (data.endTime) {
    if (typeof data.endTime.toMillis === 'function') {
      return data.endTime.toMillis();
    }
    if (typeof data.endTime === 'number') {
      return data.endTime;
    }
    if (typeof data.endTime.seconds === 'number') {
      return data.endTime.seconds * 1000 + ((data.endTime.nanoseconds || 0) / 1_000_000);
    }
  }

  // startTime + durationMinutes
  if (data.startTime && data.durationMinutes) {
    if (typeof data.startTime.toMillis === 'function') {
      return data.startTime.toMillis() + data.durationMinutes * 60 * 1000;
    }
    if (typeof data.startTime.seconds === 'number') {
      return (data.startTime.seconds * 1000) + data.durationMinutes * 60 * 1000;
    }
  }

  // remainingMs (right after resume)
  if (typeof data.remainingMs === 'number') {
    return Date.now() + data.remainingMs;
  }

  return null;
}

// ============================================================================
// 🕹️ HANDLE GAME STATE UPDATES (Now includes duration + startTime sync)
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

      const endTimestamp = getEndTimestampMs(state);
      if (endTimestamp) {
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

      // Show frozen time if we have it
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

// Keep inline timer (#time-remaining) in sync with overlay updatePlayerTimer()
function setInlineTimer(text) {
  const el = document.getElementById('time-remaining');
  if (el) el.textContent = text;
  updatePlayerTimer(text); // floating bottom-right
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
  const now = Date.now();
  const remaining = window._currentEndTime - now;
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