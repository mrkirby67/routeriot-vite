import { initializeGameStateIfNeeded, listenToGameState, setGamePhase } from './state.js';
import { watchTeams } from './teams.js';
import { watchZones } from './zones.js';
import { calculateScoreboard } from './scoreboard.js';
import { initializePewMap } from './map.js';
import {
  qs,
  renderTeamList,
  renderScoreboardTable,
  renderTimerDisplay,
  renderGameStatus,
  setMapPlaceholder,
} from './ui.js';

let teams = [];
let zones = [];
let gameState = null;

const unsubscribes = [];
let mapController = null;

document.addEventListener('DOMContentLoaded', () => {
  bootstrapControlPanel().catch((error) => {
    console.error('❌ Pew Pursuit control bootstrap failed.', error);
  });
});

async function bootstrapControlPanel() {
  setMapPlaceholder(qs('#pew-map-panel'));
  bindAdminButtons();
  await initializeGameStateIfNeeded();

  const stateUnsub = listenToGameState((snapshot) => {
    gameState = snapshot;
    renderTimerDisplay(qs('#pew-timer-display'), gameState);
    renderGameStatus(qs('#pew-game-status'), snapshot.status);
    updateScoreboard();
  });
  unsubscribes.push(stateUnsub);

  const teamUnsub = watchTeams((teamList) => {
    teams = teamList;
    renderTeamList(qs('#pew-team-list'), teams);
    updateScoreboard();
  });
  unsubscribes.push(teamUnsub);

  const zonesUnsub = watchZones(async (zoneList) => {
    zones = zoneList;
    await ensureMapReady();
    mapController?.syncZones?.(zones);
    updateScoreboard();
  });
  unsubscribes.push(zonesUnsub);

  window.addEventListener('beforeunload', () => {
    unsubscribes.forEach((fn) => fn?.());
  });
}

function bindAdminButtons() {
  qs('#pew-start-btn')?.addEventListener('click', () => {
    const durationMinutes = Number(qs('#pew-duration-min').value) || 45;
    const startTime = Date.now();
    const endTime = startTime + durationMinutes * 60 * 1000;
    setGamePhase('running', { startTime, endTime });
    console.log('▶️ Pew Pursuit game started (placeholder).');
  });

  qs('#pew-pause-btn')?.addEventListener('click', () => {
    setGamePhase('paused', { pauseTime: Date.now() });
    console.log('⏸️ Pew Pursuit game paused (placeholder).');
  });

  qs('#pew-end-btn')?.addEventListener('click', () => {
    setGamePhase('ended', { endTime: Date.now() });
    console.log('⏹️ Pew Pursuit game ended (placeholder).');
  });
}

async function ensureMapReady() {
  if (mapController) return mapController;
  const container = qs('#pew-map-panel');
  if (!container) return null;
  mapController = await initializePewMap(container, {});
  return mapController;
}

function updateScoreboard() {
  if (!teams.length || !zones.length || !gameState) {
    renderScoreboardTable(qs('#pew-scoreboard'), []);
    return;
  }
  const entries = calculateScoreboard({
    teams,
    zones,
    gameState,
  });
  renderScoreboardTable(qs('#pew-scoreboard'), entries);
}

// TODO: Add admin tools for editing zones/teams within Pew Pursuit scope.
