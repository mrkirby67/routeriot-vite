import { initializeGameStateIfNeeded, listenToGameState } from './state.js';
import { watchTeams } from './teams.js';
import {
  watchZones,
  startZoneProximityWatcher,
  recordZoneVisit,
} from './zones.js';
import { calculateScoreboard } from './scoreboard.js';
import {
  qs,
  renderScoreboardTable,
  renderZoneTable,
  renderTimerDisplay,
  renderGameStatus,
  setTeamHeadline,
} from './ui.js';
import {
  initQuestionUi,
  showQuestion,
  hideQuestion,
} from './questions.js';

let teams = [];
let zones = [];
let gameState = null;
let stopGpsWatcher = null;
const unsubscribes = [];
const teamName = getTeamFromQuery();

document.addEventListener('DOMContentLoaded', () => {
  bootstrapPlayerPage().catch((error) => {
    console.error('❌ Pew Pursuit player bootstrap failed.', error);
  });
});

async function bootstrapPlayerPage() {
  setTeamHeadline(qs('#pew-player-team-name'), teamName);
  initQuestionUi({
    container: qs('#pew-question'),
    titleNode: qs('#pew-question-title'),
    questionNode: qs('#pew-question-body'),
    actionsNode: qs('#pew-question-actions'),
    dismissButton: qs('#pew-question-dismiss'),
    submitButton: qs('#pew-question-submit'),
    onSubmit: async ({ zone }) => {
      if (!zone) return;
      await recordZoneVisit(teamName, zone.id, { source: 'question-submit' });
      hideQuestion();
    },
  });

  await initializeGameStateIfNeeded();

  unsubscribes.push(
    listenToGameState((snapshot) => {
      gameState = snapshot;
      renderTimerDisplay(qs('#pew-player-timer'), snapshot);
      renderGameStatus(qs('#pew-player-status'), snapshot.status);
      redrawScoreboard();
      refreshZones();
    }),
  );

  unsubscribes.push(
    watchTeams((teamList) => {
      teams = teamList;
      redrawScoreboard();
    }),
  );

  unsubscribes.push(
    watchZones((zoneList) => {
      zones = zoneList;
      refreshZones();
      restartGpsWatcher();
    }),
  );

  window.addEventListener('beforeunload', () => {
    unsubscribes.forEach((fn) => fn?.());
    stopGpsWatcher?.();
  });
}

function redrawScoreboard() {
  if (!gameState) {
    renderScoreboardTable(qs('#pew-player-scoreboard'), []);
    return;
  }
  const entries = calculateScoreboard({
    teams,
    zones,
    gameState,
  });
  renderScoreboardTable(qs('#pew-player-scoreboard'), entries);
}

function refreshZones() {
  renderZoneTable(qs('#pew-player-zones'), zones, {
    activeTeam: teamName,
    visitedMap: gameState?.visited || {},
    onVisitClick: (zone) => {
      console.log('📍 Pew Pursuit manual visit attempt.', zone);
      showQuestion(zone);
    },
  });
}

function restartGpsWatcher() {
  stopGpsWatcher?.();
  if (!zones.length) return;
  stopGpsWatcher = startZoneProximityWatcher(zones, {
    onEnterZone: (zone) => {
      console.log('🛰️ Pew Pursuit zone proximity reached.', zone);
      showQuestion(zone);
    },
    onExitZone: (zone) => {
      console.log('🚶 Pew Pursuit zone exited.', zone);
      hideQuestion();
    },
  });
}

function getTeamFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('team') || 'Unknown Team';
}

// TODO: Add device battery + GPS permission prompts for player UX.
