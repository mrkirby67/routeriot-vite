// ============================================================================
// CONTROL PAGE SCRIPT (FINALIZED MODULAR BUILD - SAFE START/END)
// Emails sent on “Racers Take Your Marks” instead of Start
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
import { setGameStatus, releaseZones, listenForGameStatus } from './modules/gameStateManager.js';
import { showCountdownBanner, showFlashMessage } from './modules/gameUI.js';
import { emailAllTeams } from './modules/emailTeams.js';
import { allTeams } from './data.js';

// 👉 We also need some direct Firestore ops for safe start/end & zone reset
import {
  doc, getDoc, updateDoc, serverTimestamp,
  collection, getDocs, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './modules/config.js';

// ---------------------------------------------------------------------------
// ⚙️ CONSTANTS
// ---------------------------------------------------------------------------
const GAME_STATE_REF = doc(db, "game", "gameState");
const DEFAULT_DURATION_MIN = 30; // used if no explicit duration is stored

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
  const startBtn   = document.getElementById('start-game-btn');
  const releaseBtn = document.getElementById('release-zones-btn');
  const endBtn     = document.getElementById('end-game-btn');
  const resetBtn   = document.getElementById('reset-game-btn');
  const marksBtn   = document.getElementById('take-marks-btn'); // 🏁 NEW BUTTON

  // 🏁 RACERS TAKE YOUR MARKS — opens Gmail compose popups
  if (marksBtn) {
    marksBtn.addEventListener('click', () => {
      try {
        const rulesBox  = document.getElementById('rules-textarea');
        const rulesText = rulesBox ? rulesBox.value.trim() : '';

        // If you have active team selection elsewhere, plug that in here.
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

  // ▶️ START GAME (SAFE: do not overwrite startTime if it already exists)
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try {
        const snap = await getDoc(GAME_STATE_REF);
        const existing = snap.exists() ? snap.data() : {};
        const update = {
          status: 'active',
          zonesReleased: true, // you can toggle this if you want “Release” separate
          updatedAt: serverTimestamp(),
        };

        // Only set startTime once
        if (!existing.startTime) {
          update.startTime = serverTimestamp();
        }

        // Store duration once so all players compute the same end time
        if (!existing.durationMinutes) {
          update.durationMinutes = DEFAULT_DURATION_MIN;
        }

        await updateDoc(GAME_STATE_REF, update);

        showCountdownBanner({ parent: document.body });
        showFlashMessage('✅ Game Started!', '#2e7d32', 3000);
      } catch (e) {
        console.error('Error starting game:', e);
        // Fallback to setGameStatus if doc was missing
        try {
          await setDoc(GAME_STATE_REF, {
            status: 'active',
            zonesReleased: true,
            startTime: serverTimestamp(),
            durationMinutes: DEFAULT_DURATION_MIN,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          showCountdownBanner({ parent: document.body });
          showFlashMessage('✅ Game Started!', '#2e7d32', 3000);
        } catch (err2) {
          console.error('Start fallback failed:', err2);
          showFlashMessage('Start failed.', '#c62828', 2500);
        }
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

  // 🏁 END GAME — also resets zones & clears teamStatus locations
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

  // 🔄 RESET → back to waiting (does not wipe zones)
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Reset game state to WAITING?\n(Does NOT wipe zones)')) {
        try {
          await setDoc(GAME_STATE_REF, {
            status: 'waiting',
            zonesReleased: false,
            // keep historical start/end if you want—players only read current status
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
}

// ---------------------------------------------------------------------------
// 🔁 LIVE GAME STATE UPDATES
// ---------------------------------------------------------------------------
function watchLiveGameStatus() {
  listenForGameStatus((state) => {
    const { status = 'waiting', zonesReleased = false } = state || {};
    console.log('🎯 Live game state update:', state);

    const statusEl = document.getElementById('live-game-status');
    const zonesEl  = document.getElementById('live-zones-status');

    if (statusEl) statusEl.textContent = status.toUpperCase();
    if (zonesEl)  zonesEl.textContent  = zonesReleased ? 'Unlocked' : 'Locked';

    switch (status) {
      case 'active':
        if (zonesReleased) showFlashMessage('Zones are LIVE!', '#2e7d32');
        break;
      case 'finished':
      case 'ended':
        showFlashMessage('Game Over!', '#7b1fa2');
        break;
      case 'waiting':
      default:
        showFlashMessage('Waiting to start...', '#616161');
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// 🧹 SAFE END + RESET ZONES
// ---------------------------------------------------------------------------
async function safelyEndGameAndResetZones() {
  // 1) Mark the game finished (don’t touch startTime)
  await updateDoc(GAME_STATE_REF, {
    status: 'finished',
    updatedAt: serverTimestamp(),
    // optionally set endTime if you want a hard stop timestamp:
    // endTime: serverTimestamp(),
  });

  // 2) Reset every zone to available
  const zonesSnap = await getDocs(collection(db, "zones"));
  for (const z of zonesSnap.docs) {
    await updateDoc(doc(db, "zones", z.id), {
      status: 'Available',
      controllingTeam: '',
      lastUpdated: serverTimestamp()
    });
  }

  // 3) (Optional) Clear teamStatus last known location
  const teamStatusSnap = await getDocs(collection(db, "teamStatus"));
  for (const t of teamStatusSnap.docs) {
    await updateDoc(doc(db, "teamStatus", t.id), {
      lastKnownLocation: '',
      timestamp: serverTimestamp()
    });
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