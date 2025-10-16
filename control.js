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
import TeamLinksComponent from './components/TeamLinks/TeamLinks.js';

// Module Imports
import { listenToAllMessages } from './modules/chatManager.js';
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';


// =================================================================
// MAIN APPLICATION STARTUP
// =================================================================
async function main() {
    // 1. Render all static HTML components
    document.getElementById('game-controls-container').innerHTML = GameControlsComponent();
    document.getElementById('scoreboard-container').innerHTML = ScoreboardComponent();
    document.getElementById('team-links-container').innerHTML = TeamLinksComponent();
    document.getElementById('racer-management-container').innerHTML = RacerManagementComponent();
    document.getElementById('zone-management-container').innerHTML = ZoneManagementComponent();
    document.getElementById('game-challenges-container').innerHTML = GameChallengesComponent();
    document.getElementById('broadcast-container').innerHTML = BroadcastComponent();
    
    // 2. Initialize logic for all components
    initializeScoreboardListener();
    initializeGameControlsLogic();
    initializeRacerManagementLogic();
    initializeGameChallengesLogic();
    initializeBroadcastLogic();
    listenToAllMessages();

    // 3. Load Google Maps API last and then initialize the map-dependent component
    try {
        await loadGoogleMapsApi();
        initializeZoneManagementLogic(true); // Pass true to signal that maps are ready
    } catch (error) {
        console.error("CRITICAL ERROR: Could not load Google Maps API.", error);
    }
}

// Run the main function when the page loads
document.addEventListener('DOMContentLoaded', main);

