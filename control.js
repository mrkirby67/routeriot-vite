// =================================================================
// IMPORTS
// =================================================================

// Component Imports & Logic
import { GameControlsComponent, initializeGameControlsLogic } from './components/GameControls/GameControls.js';
import { RacerManagementComponent, initializeRacerManagementLogic } from './components/RacerManagement/RacerManagement.js';
import { ZoneManagementComponent, initializeZoneManagementLogic } from './components/ZoneManagement/ZoneManagement.js';
import { ScoreboardComponent, initializeScoreboardListener } from './components/Scoreboard/Scoreboard.js';
import { GameChallengesComponent, initializeGameChallengesLogic } from './components/GameChallenges/GameChallenges.js';
import { BroadcastComponent, initializeBroadcastLogic } from './components/Broadcast/Broadcast.js';
import { TeamLinksComponent } from './components/TeamLinks/TeamLinks.js';

// Module Imports
import { listenToAllMessages } from './modules/chatManager.js';
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';
import { setGameStatus, releaseZones, listenForGameStatus } from './modules/gameStateManager.js';
import { showCountdownBanner, showFlashMessage } from './modules/gameCountdown.js';


// =================================================================
// MAIN APPLICATION STARTUP
// =================================================================
async function main() {
    // 1️⃣ Render all static HTML components
    document.getElementById('game-controls-container').innerHTML = GameControlsComponent();
    document.getElementById('scoreboard-container').innerHTML = ScoreboardComponent();
    document.getElementById('team-links-container').innerHTML = TeamLinksComponent();
    document.getElementById('racer-management-container').innerHTML = RacerManagementComponent();
    document.getElementById('zone-management-container').innerHTML = ZoneManagementComponent();
    document.getElementById('game-challenges-container').innerHTML = GameChallengesComponent();
    document.getElementById('broadcast-container').innerHTML = BroadcastComponent();

    // 2️⃣ Initialize logic for all components
    initializeScoreboardListener();
    initializeGameControlsLogic();
    initializeRacerManagementLogic();
    initializeGameChallengesLogic();
    initializeBroadcastLogic();
    listenToAllMessages();

    // 3️⃣ Load Google Maps API last and initialize Zone Management
    try {
        await loadGoogleMapsApi();
        initializeZoneManagementLogic(true);
    } catch (error) {
        console.error("CRITICAL ERROR: Could not load Google Maps API.", error);
    }

    // 4️⃣ Hook up game state buttons from GameControls component
    wireGameControls();
    watchLiveGameStatus();
}


// =================================================================
// 🎮 CONTROL PAGE GAME STATE ACTIONS
// =================================================================
function wireGameControls() {
    const startBtn = document.getElementById('start-game-btn');
    const releaseBtn = document.getElementById('release-zones-btn');
    const endBtn = document.getElementById('end-game-btn');
    const resetBtn = document.getElementById('reset-game-btn');

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            await setGameStatus('active', true);
            showCountdownBanner();
            showFlashMessage('Game Started!', '#2e7d32', 3000);
        });
    }

    if (releaseBtn) {
        releaseBtn.addEventListener('click', async () => {
            await releaseZones();
            showFlashMessage('Zones Released!', '#1976d2', 3000);
        });
    }

    if (endBtn) {
        endBtn.addEventListener('click', async () => {
            await setGameStatus('ended');
            showFlashMessage('Game Ended!', '#c62828', 4000);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (confirm('Reset game state to waiting?')) {
                await setGameStatus('waiting', false);
                showFlashMessage('Game Reset.', '#757575', 2500);
            }
        });
    }
}


// =================================================================
// 🔁 LISTEN TO LIVE GAME STATE (host view)
// =================================================================
function watchLiveGameStatus() {
    listenForGameStatus((state) => {
        const { status, zonesReleased } = state;
        console.log('🎯 Game state update:', state);

        const statusEl = document.getElementById('live-game-status');
        const zonesEl = document.getElementById('live-zones-status');

        if (statusEl) statusEl.textContent = status.toUpperCase();
        if (zonesEl) zonesEl.textContent = zonesReleased ? 'Unlocked' : 'Locked';

        switch (status) {
            case 'active':
                if (zonesReleased) showFlashMessage('Zones are LIVE!', '#2e7d32');
                break;
            case 'ended':
                showFlashMessage('Game Over!', '#c62828');
                break;
            case 'waiting':
                showFlashMessage('Waiting to start...', '#616161');
                break;
        }
    });
}


// =================================================================
// 🧠 MAIN ENTRY POINT
// =================================================================
document.addEventListener('DOMContentLoaded', main);