// ============================================================================
// Pew Pursuit scoreboard math scaffolding.
// Focuses on visited zone counts + placeholder scoring modes.
// ============================================================================

import {
  SCORING_MODES,
  resolveScoringMode,
  ensureVisitedMap,
} from './config.js';

export function calculateScoreboard({ teams = [], zones = [], gameState }) {
  const visited = ensureVisitedMap(gameState?.visited);
  const scoringMode = resolveScoringMode(gameState?.scoringMode);
  const totalZones = zones.length || 1;

  const entries = teams.map((team) => {
    const teamName = team.name || team.id || 'Unnamed Team';
    const teamVisits = visited[teamName] || [];
    const visitedCount = teamVisits.length;
    const completionRatio = visitedCount / totalZones;

    return {
      teamName,
      score: computeScore(scoringMode, {
        visitedCount,
        totalZones,
        teamVisits,
      }),
      visitedCount,
      completionRatio: Number.isFinite(completionRatio) ? completionRatio : 0,
      lastCheckpoint: teamVisits.at(-1) || null,
    };
  });

  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.visitedCount !== a.visitedCount) return b.visitedCount - a.visitedCount;
    return (a.teamName || '').localeCompare(b.teamName || '');
  });

  return entries;
}

function computeScore(mode, context) {
  switch (mode) {
    case SCORING_MODES.FIRST_TO_FINISH:
      return context.visitedCount >= context.totalZones ? context.totalZones : context.visitedCount;
    case SCORING_MODES.TIME_BASED:
      // TODO: Incorporate timestamps to reward earlier completions.
      return context.visitedCount;
    case SCORING_MODES.POINT_BY_VISIT:
    default:
      return context.visitedCount;
  }
}

export function formatScoreboardRow(entry, index) {
  return {
    rank: index + 1,
    ...entry,
  };
}

// TODO: once scoring is final, add helpers for streak bonuses + per-zone multipliers.
