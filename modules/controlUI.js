// ============================================================================
// MODULE: controlUI.js
// Purpose: Wire up UI buttons and trigger controlActions
// ============================================================================

import { showCountdownBanner, showFlashMessage } from './gameUI.js';
import { pauseGame, resumeGame, releaseZones } from './gameStateManager.js';
import { clearAllScores, safelyEndGameAndResetZones, resetFullGameState } from './controlActions.js';
import { db } from './config.js';
import {
  doc, getDoc, updateDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GAME_STATE_REF = doc(db, "game", "gameState");
const DEFAULT_DURATION_MIN = 30;

export function wireGameControls() {
  const startBtn   = document.getElementById('start-btn');
  const pauseBtn   = document.getElementById('pause-btn');
  const releaseBtn = document.getElementById('release-zones-btn');
  const endBtn     = document.getElementById('end-btn');
  const resetBtn   = document.getElementById('reset-game-btn');
  const clearBtn   = document.getElementById('clear-scores-btn');

  // 🏁 START GAME
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try {
        await clearAllScores(true);

        const snap = await getDoc(GAME_STATE_REF);
        const existing = snap.exists() ? snap.data() : {};

        const update = {
          status: 'active',
          zonesReleased: true,
          updatedAt: serverTimestamp(),
        };
        if (!existing.startTime) update.startTime = serverTimestamp();
        if (!existing.durationMinutes) update.durationMinutes = DEFAULT_DURATION_MIN;

        await updateDoc(GAME_STATE_REF, update);
        await addDoc(collection(db, "communications"), {
          teamName: "Game Master",
          message: "🏁 A new game has begun! Scores cleared and zones live.",
          isBroadcast: true,
          timestamp: serverTimestamp(),
        });

        showCountdownBanner({ parent: document.body });
        showFlashMessage('✅ Game Started! Scores cleared.', '#2e7d32', 3000);
      } catch (e) {
        console.error('Error starting game:', e);
        showFlashMessage('Start failed.', '#c62828', 2500);
      }
    });
  }

  // ⏸️ / ▶️ TOGGLE PAUSE-RESUME
  if (pauseBtn) {
    pauseBtn.addEventListener('click', async () => {
      try {
        const snap = await getDoc(GAME_STATE_REF);
        const data = snap.exists() ? snap.data() : {};
        const isPaused = data.status === 'paused';

        if (isPaused) {
          await resumeGame();
          pauseBtn.textContent = 'Pause Game';
          showFlashMessage('▶️ Game Resumed!', '#2e7d32', 2500);
        } else {
          await pauseGame();
          pauseBtn.textContent = 'Resume Game';
          showFlashMessage('⏸️ Game Paused!', '#ff9800', 2500);
        }
      } catch (e) {
        console.error('Pause/Resume error:', e);
        showFlashMessage('Pause/Resume failed.', '#c62828', 2500);
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
        pauseBtn.textContent = 'Pause Game';
      } catch (e) {
        console.error('Error ending game:', e);
        showFlashMessage('End failed.', '#c62828', 2500);
      }
    });
  }

  // 🔄 RESET GAME STATE
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset game state to WAITING and clear all scores/locations?')) {
        await resetFullGameState();
        pauseBtn.textContent = 'Pause Game';
        showFlashMessage('🔄 Game fully reset.', '#757575', 3000);
      }
    });
  }

  // 🧹 CLEAR SCORES
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('Clear all team scores and locations manually?')) {
        await clearAllScores(false);
        showFlashMessage('🧹 Scores and locations cleared.', '#1565c0', 3000);
      }
    });
  }
}