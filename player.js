// ============================================================================
// File: player.js
// Purpose: Player-side entry point with synced countdown + pause/resume logic
// ============================================================================
import { allTeams } from './data.js';
import { db } from './modules/config.js';
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { initializeZones } from './modules/zones.js';
import {
  initializePlayerUI,
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

  // 1️⃣ Identify team
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

  // 2️⃣ Validate team
  const team = allTeams.find(t => t.name === currentTeamName);
  if (!team) {
    alert(`Team "${currentTeamName}" not found in data.js`);
    console.error('❌ Invalid team:', currentTeamName);
    return;
  }

  // 3️⃣ Initialize UI + core modules
  try {
    initializePlayerUI(team, currentTeamName);
    setupPlayerChat(currentTeamName);
    initializeZones(currentTeamName);
    initializePlayerScoreboard();
  } catch (err) {
    console.error('🔥 Error initializing player modules:', err);
    alert('Error initializing player. Check console.');
    return;
  }

  // 4️⃣ Initial display
  showWaitingBanner();
  setInlineTimer('--:--:--');

  // 5️⃣ If game already active, start timer immediately
  try {
    const gameDoc = await getDoc(doc(db, 'game', 'gameState'));
    const gameData = gameDoc.exists() ? gameDoc.data() : null;

    if (gameData?.status === 'active') {
      removeWaitingBanner();
      const endTimestamp = getEndTimestampMs(gameData);
      if (endTimestamp) {
        startPlayerTimer(endTimestamp);
        showFlashMessage('🏁 Game in Progress!', '#2e7d32', 1200);
      }
    }
  } catch (err) {
    console.error('⚠️ Could not fetch initial game state:', err);
  }

  // 6️⃣ Live game state sync (pause/resume/end)
  listenForGameStatus((state) => handleLiveGameState(state));

  console.log('✅ Player initialized for team:', currentTeamName);
}

// ============================================================================
// 🧠 Compute end timestamp (supports Firestore Timestamp/object/number)
// ============================================================================
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

// ============================================================================
// 🕹️ Handle game state updates
// ============================================================================
let playerTimerInterval = null;
let pausedAt = null;
let lastRemainingMs = null;

function handleLiveGameState(state) {
  const { status, endTime, startTime, durationMinutes, remainingMs } = state || {};

  switch (status) {
    case 'waiting':
      showWaitingBanner();
      hidePausedOverlay();
      pausePlayerTimer();
      setInlineTimer('--:--:--');
      break;

    case 'active': {
      removeWaitingBanner();
      hidePausedOverlay();

      const endTimestamp = getEndTimestampMs({ endTime, startTime, durationMinutes, remainingMs });
      if (endTimestamp) {
        startPlayerTimer(endTimestamp);
        showFlashMessage('🏁 Game in Progress!', '#2e7d32', 1200);
      } else {
        setInlineTimer('--:--:--');
      }

      pausedAt = null;
      break;
    }

    case 'paused':
      pausedAt = Date.now();
      lastRemainingMs = stopAndCalculateRemaining();
      showPausedOverlay();
      showFlashMessage('⏸️ Game Paused by Control', '#ff9800', 1600);
      if (typeof lastRemainingMs === 'number') {
        setInlineTimer(formatHMS(lastRemainingMs));
      }
      break;

    case 'finished':
    case 'ended':
      pausePlayerTimer();
      setInlineTimer('00:00:00');
      hidePausedOverlay();
      showGameOverOverlay();
      showFlashMessage('🏁 Game Over! Return to base.', '#c62828', 3000);
      break;

    default:
      break;
  }
}

// ============================================================================
// 🧭 UI Helpers
// ============================================================================
function showWaitingBanner() {
  if (document.getElementById('waiting-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'waiting-banner';
  banner.textContent = '⏳ Waiting for the game to start...';
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    background: '#333',
    color: 'white',
    textAlign: 'center',
    padding: '12px',
    fontWeight: 'bold',
    zIndex: '2000',
  });
  document.body.appendChild(banner);
}

function removeWaitingBanner() {
  document.getElementById('waiting-banner')?.remove();
}

function setInlineTimer(text) {
  // ✅ Write ONLY to the Game Info spot
  const el = document.getElementById('timer-display'); // << matches your HTML
  if (el) el.textContent = text;
}

// ============================================================================
// ⏱️ Timer Handlers
// ============================================================================
function startPlayerTimer(endTimestamp) {
  clearInterval(playerTimerInterval);
  window._currentEndTime = endTimestamp;
  updateTimerDisplay(endTimestamp);
  playerTimerInterval = setInterval(() => updateTimerDisplay(endTimestamp), 1000);
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