// ============================================================================
// Pew Pursuit configuration + constant helpers.
// Define standalone defaults so the new game mode never leaks into Route Riot.
// ============================================================================

export const PEW_COLLECTIONS = Object.freeze({
  teams: 'teams_pew',
  zones: 'zones_pew',
  gameState: 'gameState_pew',
});

export const SCORING_MODES = Object.freeze({
  FIRST_TO_FINISH: 'first-to-finish',
  POINT_BY_VISIT: 'point-by-visit',
  TIME_BASED: 'time-based',
});

export const DEFAULT_SCORING_MODE = SCORING_MODES.POINT_BY_VISIT;

export const GAMEPLAY_DEFAULTS = Object.freeze({
  zoneRadiusMeters: 75,
  mapZoom: 15,
  mapCenter: { lat: 40.7608, lng: -111.8910 }, // Salt Lake City as neutral staging area
});

export const EMPTY_GAME_STATE = Object.freeze({
  startTime: null,
  endTime: null,
  scoringMode: DEFAULT_SCORING_MODE,
  visited: {},
});

export function getZoneRadiusMeters(customRadius) {
  if (typeof customRadius === 'number' && !Number.isNaN(customRadius) && customRadius > 0) {
    return customRadius;
  }
  return GAMEPLAY_DEFAULTS.zoneRadiusMeters;
}

export function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  return null;
}

export function ensureVisitedMap(mapLike) {
  return mapLike && typeof mapLike === 'object' ? mapLike : {};
}

export function resolveScoringMode(mode) {
  if (!mode) return DEFAULT_SCORING_MODE;
  const normalized = mode.toLowerCase();
  return Object.values(SCORING_MODES).includes(normalized) ? normalized : DEFAULT_SCORING_MODE;
}

// TODO: expose admin-editable config hooks (map center, timer presets, etc.).
