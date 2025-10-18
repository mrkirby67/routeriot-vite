// ============================================================================
// CONTROL PAGE SCRIPT (FINALIZED MODULAR BUILD - SAFE START/END)
// Unified with GameControls.js (uses "scores" collection)
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
import { releaseZones, listenForGameStatus } from './modules/gameStateManager.js';
import { showCountdownBanner, showFlashMessage } from './modules/gameUI.js';
import { emailAllTeams } from './modules/emailTeams.js';
import { allTeams } from './data.js';

import {
  doc, getDoc, updateDoc, serverTimestamp,
  collection, getDocs, setDoc, addDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './modules/config.js';

// ---------------------------------------------------------------------------
// ⚙️ CONSTANTS
// ---------------------------------------------------------------------------
const GAME_STATE_REF = doc(db, "game", "gameState");
const DEFAULT_DURATION_MIN = 30;

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
  const startBtn   = document.getElementById('start-btn');
  const releaseBtn = document.getElementById('release-zones-btn');
  const endBtn     = document.getElementById('end-btn');
  const resetBtn   = document.getElementById('reset-game-btn');
  const marksBtn   = document.getElementById('send-links-btn');
  const clearBtn   = document.getElementById('clear-scores-btn'); // 🧹

  // 🏁 RACERS TAKE YOUR MARKS
  if (marksBtn) {
    marksBtn.addEventListener('click', () => {
      try {
        const rulesBox  = document.getElementById('rules-text');
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

  // ▶️ START GAME — auto clear scores first
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
      } catch (e) {
        console.error('Error ending game:', e);
        showFlashMessage('End failed.', '#c62828', 2500);
      }
    });
  }

  // 🔄 RESET GAME STATE
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset game state to WAITING?\n(Does NOT wipe zones)')) {
        try {
          await setDoc(GAME_STATE_REF, {
            status: 'waiting',
            zonesReleased: false,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          showFlashMessage('🔄 Game Reset to WAITING.', '#757575', 2500);
        } catch (e) {
          console.error('Error resetting game:', e);
          showFlashMessage('Reset failed.', '#c62828', 2500);
        }
      }
    });
  }

  // 🧹 CLEAR SCORES BUTTON
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('Clear all team scores manually?')) {
        await clearAllScores(false);
        showFlashMessage('🧹 Scores cleared.', '#1565c0', 3000);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 🔁 LIVE GAME STATE UPDATES
// ---------------------------------------------------------------------------
function watchLiveGameStatus() {
  listenForGameStatus((state) => {
    const { status = 'waiting', zonesReleased = false } = state || {};
    const statusEl = document.getElementById('live-game-status');
    const zonesEl  = document.getElementById('live-zones-status');

    if (statusEl) statusEl.textContent = status.toUpperCase();
    if (zonesEl)  zonesEl.textContent  = zonesReleased ? 'Unlocked' : 'Locked';

    switch (status) {
      case 'active':  showFlashMessage('Zones are LIVE!', '#2e7d32'); break;
      case 'finished': showFlashMessage('Game Over!', '#7b1fa2'); break;
      default: showFlashMessage('Waiting to start...', '#616161'); break;
    }
  });
}

// ---------------------------------------------------------------------------
// 🧹 SAFE END + RESET ZONES + CLEAR SCORES + BROADCAST
// ---------------------------------------------------------------------------
async function safelyEndGameAndResetZones() {
  try {
    await updateDoc(GAME_STATE_REF, {
      status: 'finished',
      updatedAt: serverTimestamp(),
    });

    // Reset all zones
    const zonesSnap = await getDocs(collection(db, "zones"));
    for (const z of zonesSnap.docs) {
      await updateDoc(doc(db, "zones", z.id), {
        status: 'Available',
        controllingTeam: '',
        lastUpdated: serverTimestamp(),
      });
    }

    // Reset all teamStatus
    const teamStatusSnap = await getDocs(collection(db, "teamStatus"));
    for (const t of teamStatusSnap.docs) {
      await updateDoc(doc(db, "teamStatus", t.id), {
        lastKnownLocation: '',
        timestamp: serverTimestamp(),
      });
    }

    // Clear scores
    await clearAllScores(true);

    // Broadcast end-of-game message
    await addDoc(collection(db, "communications"), {
      teamName: "Game Master",
      message: "🏁 The game has ended! All zones and scores reset.",
      isBroadcast: true,
      timestamp: serverTimestamp(),
    });

    console.log("✅ Game ended, zones reset, and broadcast sent.");
  } catch (e) {
    console.error("❌ Error ending game:", e);
    showFlashMessage('End/Reset failed.', '#c62828', 3000);
  }
}

// ---------------------------------------------------------------------------
// 🧮 CLEAR ALL SCORES
// ---------------------------------------------------------------------------
async function clearAllScores(autoTriggered = false) {
  try {
    const scoresSnap = await getDocs(collection(db, "scores"));
    const batch = writeBatch(db);
    scoresSnap.forEach(s => batch.delete(s.ref));
    await batch.commit();

    if (!autoTriggered) {
      await addDoc(collection(db, "communications"), {
        teamName: "Game Master",
        message: "🧹 Scores manually cleared by Control.",
        isBroadcast: true,
        timestamp: serverTimestamp(),
      });
    }
    console.log(`✅ Scores cleared (${autoTriggered ? 'auto' : 'manual'}).`);
  } catch (e) {
    console.error("❌ Error clearing scores:", e);
    showFlashMessage('Score clearing failed.', '#c62828', 3000);
  }
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