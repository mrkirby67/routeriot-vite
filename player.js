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

  // 3️⃣ Show “waiting” banner until game starts
  try {
    const gameDoc = await getDoc(doc(db, 'game', 'gameState'));
    const gameData = gameDoc.exists() ? gameDoc.data() : {};
    if (gameData.status !== 'active') {
      showWaitingBanner();
    }
  } catch (err) {
    console.error('⚠️ Could not fetch initial game state:', err);
  }

  // 4️⃣ Initialize all player modules
  try {
    initializePlayerUI(team, currentTeamName);
    setupPlayerChat(currentTeamName);
    initializeZones(currentTeamName);
    initializePlayerScoreboard();

    // 🧠 Listen for real-time game state (with pause/resume)
    listenForGameStatus((state) => handleLiveGameState(state));
  } catch (err) {
    console.error('🔥 Error during initialization:', err);
    alert('Error initializing player. Check console.');
  }

  console.log('✅ Player initialized for team:', currentTeamName);
}

// ============================================================================
// 🕹️ HANDLE GAME STATE UPDATES (Now includes duration + startTime sync)
// ============================================================================
let lastRemainingMs = null;
let playerTimerInterval = null;
let pausedAt = null;

function handleLiveGameState(state) {
  const {
    status,
    startTime,
    endTime,
    remainingMs,
    durationMinutes
  } = state || {};

  switch (status) {
    // 🟡 WAITING
    case 'waiting':
      showWaitingBanner();
      hidePausedOverlay();
      updatePlayerTimer('--:--');
      pausePlayerTimer();
      break;

    // 🟢 ACTIVE
    case 'active': {
      removeWaitingBanner();
      hidePausedOverlay();

      let endTimestamp = null;

      if (endTime?.toMillis) {
        // Use Firestore Timestamp end
        endTimestamp = endTime.toMillis();
      } else if (startTime?.toMillis && durationMinutes) {
        // Compute from startTime + duration
        endTimestamp = startTime.toMillis() + durationMinutes * 60 * 1000;
      } else if (remainingMs) {
        // Fallback to remaining time
        endTimestamp = Date.now() + remainingMs;
      }

      if (endTimestamp) {
        startPlayerTimer(endTimestamp);
        showFlashMessage('🏁 Game in Progress!', '#2e7d32', 1500);
      } else {
        console.warn('⚠️ No valid end time found for timer sync.');
      }

      pausedAt = null;
      break;
    }

    // ⏸️ PAUSED
    case 'paused': {
      pausedAt = Date.now();
      lastRemainingMs = stopAndCalculateRemaining();
      showPausedOverlay();
      showFlashMessage('⏸️ Game Paused by Control', '#ff9800', 2000);
      break;
    }

    // 🏁 FINISHED / ENDED
    case 'finished':
    case 'ended':
      pausePlayerTimer();
      updatePlayerTimer('00:00');
      hidePausedOverlay();
      showGameOverOverlay();
      showFlashMessage('🏁 Game Over! Return to base.', '#c62828', 4000);
      break;

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

function updateTimerDisplay(endTimestamp) {
  const now = Date.now();
  const remaining = endTimestamp - now;

  if (remaining <= 0) {
    clearInterval(playerTimerInterval);
    updatePlayerTimer('00:00');
    showGameOverOverlay();
    return;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const display = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  updatePlayerTimer(display);
}

// ============================================================================
// 🚀 ENTRY POINT
// ============================================================================
document.addEventListener('DOMContentLoaded', initializePlayerPage);