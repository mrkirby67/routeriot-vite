// ============================================================================
// MODULE: controlUI.js (UPDATED)
// Purpose: Wire up UI buttons and trigger controlActions
// Now integrates with clearAllChatAndScores() from controlStatus.js
// ============================================================================

import { showCountdownBanner, showFlashMessage } from './gameUI.js';
import { startGame as startGameState, pauseGame, resumeGame, releaseZones, listenForGameStatus } from './gameStateManager.js';
import { safelyEndGameAndResetZones, resetFullGameState } from './controlActions.js';
import { clearAllChatAndScores } from './controlStatus.js'; // ✅ NEW IMPORT
import { db } from './config.js';
import {
  doc, getDoc, getDocs, collection
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GAME_STATE_REF = doc(db, "game", "gameState");
const DEFAULT_DURATION_MIN = 30;

let detachStatusListener = null;
let latestStatus = null;

export function wireGameControls() {
  const startBtn   = document.getElementById('start-btn');
  const pauseBtn   = document.getElementById('pause-btn');
  const releaseBtn = document.getElementById('release-zones-btn');
  const endBtn     = document.getElementById('end-btn');
  const resetBtn   = document.getElementById('reset-game-btn');
  const clearBtn   = document.getElementById('clear-scores-btn'); // 🧹 "Clear All"

  const applyButtonState = (statusValue) => {
    const status = (statusValue || '').toLowerCase();
    const isActive = status === 'active';
    const isPaused = status === 'paused';
    const inProgress = isActive || isPaused;

    if (startBtn) {
      const disableStart = inProgress;
      startBtn.disabled = disableStart;
      startBtn.setAttribute('aria-disabled', String(disableStart));
    }
    if (pauseBtn) {
      pauseBtn.disabled = !inProgress;
      pauseBtn.textContent = isPaused ? 'Resume Game' : 'Pause Game';
    }
    if (releaseBtn) {
      releaseBtn.disabled = !isActive;
    }
    if (endBtn) {
      endBtn.disabled = !inProgress;
    }
  };

  applyButtonState(latestStatus);

  detachStatusListener?.('rebind');
  detachStatusListener = listenForGameStatus((state) => {
    latestStatus = state?.status || 'waiting';
    applyButtonState(latestStatus);
  });

  // 🏁 START GAME
  if (startBtn) {
    startBtn.addEventListener('click', async (event) => {
      if (event?.defaultPrevented) {
        showCountdownBanner({ parent: document.body });
        showFlashMessage('✅ Game Started! Everything cleared and ready.', '#2e7d32', 3000);
        latestStatus = 'active';
        applyButtonState(latestStatus);
        return;
      }
      if (latestStatus === 'active' || latestStatus === 'paused') {
        showFlashMessage('Game already in progress — use Pause/Resume or End Game instead.', '#ffb300', 2800);
        return;
      }

      startBtn.disabled = true;
      startBtn.setAttribute('aria-disabled', 'true');

      try {
        await clearAllChatAndScores(); // 🧹 Clears everything before starting

        const durationMinutes = Number(document.getElementById('game-duration')?.value) || DEFAULT_DURATION_MIN;
        const racersSnap = await getDocs(collection(db, 'racers'));
        const teams = new Set();
        racersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.team && data.team !== '-') {
            teams.add(String(data.team).trim());
          }
        });

        await startGameState({
          durationMinutes,
          zonesReleased: true,
          teamNames: Array.from(teams).sort(),
          broadcast: {
            teamName: 'Game Master',
            message: '🏁 A new game has begun! Scoreboard cleared, chat wiped, and zones live.'
          }
        });

        showCountdownBanner({ parent: document.body });
        showFlashMessage('✅ Game Started! Everything cleared and ready.', '#2e7d32', 3000);
        latestStatus = 'active';
        applyButtonState(latestStatus);
      } catch (e) {
        console.error('Error starting game:', e);
        showFlashMessage('Start failed.', '#c62828', 2500);
        startBtn.disabled = false;
        startBtn.setAttribute('aria-disabled', 'false');
      }
    });
  }

  // ⏸️ / ▶️ TOGGLE PAUSE-RESUME
  if (pauseBtn) {
    pauseBtn.addEventListener('click', async () => {
      pauseBtn.disabled = true;
      try {
        const snap = await getDoc(GAME_STATE_REF);
        const data = snap.exists() ? snap.data() : {};
        const isPaused = data.status === 'paused';

        if (isPaused) {
          await resumeGame();
          latestStatus = 'active';
          showFlashMessage('▶️ Game Resumed!', '#2e7d32', 2500);
        } else {
          await pauseGame();
          latestStatus = 'paused';
          showFlashMessage('⏸️ Game Paused!', '#ff9800', 2500);
        }
        applyButtonState(latestStatus);
      } catch (e) {
        console.error('Pause/Resume error:', e);
        showFlashMessage('Pause/Resume failed.', '#c62828', 2500);
      } finally {
        pauseBtn.disabled = !(latestStatus === 'active' || latestStatus === 'paused');
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
        await safelyEndGameAndResetZones();
        showFlashMessage('🏁 Game Ended! Zones reset.', '#c62828', 4000);
        latestStatus = 'over';
        applyButtonState(latestStatus);
      } catch (e) {
        console.error('Error ending game:', e);
        showFlashMessage('End failed.', '#c62828', 2500);
      }
    });
  }

  // 🔄 RESET GAME STATE
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset game state to WAITING and clear all scoreboard data (scores + locations)?')) {
        await resetFullGameState();
        latestStatus = 'waiting';
        applyButtonState(latestStatus);
        showFlashMessage('🔄 Game fully reset.', '#757575', 3000);
      }
    });
  }

  // 🧹 CLEAR EVERYTHING (chat + scores + zones + team statuses)
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('⚠️ This will clear ALL chat, scores, zones, and team statuses. Continue?')) {
        try {
          await clearAllChatAndScores();
          showFlashMessage('🧹 All chat, scores, and team statuses cleared.', '#1565c0', 4000);
        } catch (err) {
          console.error('Error clearing data:', err);
          showFlashMessage('❌ Clear failed.', '#c62828', 2500);
        }
      }
    });
  }
}
