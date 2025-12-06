// ============================================================================
// FILE: services/game/gameRosterService.js
// PURPOSE: Capture per-game team/player roster snapshots + attacker contact lookup
// LAYER: services/game
// DEPENDS_ON: /core/config.js, firebase-firestore
// AUTHOR: Route Riot – Game Roster Snapshot
// CREATED: 2025-11-10
// ============================================================================

import { db } from '/core/config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const GAMES_COLLECTION = 'games';
const RACERS_COLLECTION = 'racers';

function normalizeTeamId(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function trimOrNull(value) {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed || null;
}

function coercePlayerName(player) {
  return trimOrNull(
    player?.displayName ||
    player?.name ||
    player?.nickname ||
    player?.playerName
  );
}

function collectRacersByTeam(racers = []) {
  const roster = new Map();
  racers.forEach((racer) => {
    const teamName = trimOrNull(racer?.team);
    if (!teamName || teamName === '-') return;

    const teamId = normalizeTeamId(teamName);
    if (!teamId) return;

    if (!roster.has(teamId)) {
      roster.set(teamId, {
        teamId,
        teamName,
        teamCode: trimOrNull(racer?.teamCode) || undefined,
        players: []
      });
    }

    const players = roster.get(teamId).players;
    const playerEntry = {
      playerId: racer?.id || racer?.playerId || null,
      displayName: coercePlayerName(racer),
      phone: trimOrNull(racer?.cell || racer?.phone),
      email: trimOrNull(racer?.email) || null
    };

    const isCaptain =
      racer?.isCaptain === true ||
      racer?.captain === true ||
      (typeof racer?.role === 'string' && racer.role.toLowerCase() === 'captain');
    if (isCaptain) {
      playerEntry.isCaptain = true;
    }

    players.push(playerEntry);
  });

  return Array.from(roster.values());
}

async function fetchCanonicalRacers() {
  const snap = await getDocs(collection(db, RACERS_COLLECTION));
  const racers = [];
  snap.forEach((docSnap) => {
    racers.push({ id: docSnap.id, ...(docSnap.data() || {}) });
  });
  return racers;
}

export async function buildRosterSnapshotForGame(gameId = 'global') {
  const resolvedGameId = trimOrNull(gameId) || 'global';
  const racers = await fetchCanonicalRacers();
  const rosterSnapshot = collectRacersByTeam(racers);
  const gameRef = doc(db, GAMES_COLLECTION, resolvedGameId);

  await setDoc(gameRef, { rosterSnapshot }, { merge: true });
  return rosterSnapshot;
}

export async function getAttackerContactForTeam(gameId = 'global', attackerTeamIdOrCode) {
  const resolvedGameId = trimOrNull(gameId) || 'global';
  const lookup = normalizeTeamId(attackerTeamIdOrCode);
  if (!lookup) return null;

  const snap = await getDoc(doc(db, GAMES_COLLECTION, resolvedGameId));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const roster = Array.isArray(data.rosterSnapshot) ? data.rosterSnapshot : [];

  const matchedTeam = roster.find((team) => {
    return (
      normalizeTeamId(team?.teamId) === lookup ||
      normalizeTeamId(team?.teamCode) === lookup ||
      normalizeTeamId(team?.teamName) === lookup
    );
  });

  if (!matchedTeam) return null;
  const players = Array.isArray(matchedTeam.players) ? matchedTeam.players : [];

  const captain = players.find((p) => p?.isCaptain);
  const primary = captain || players[0];
  if (!primary) {
    return { name: null, phone: null, email: null };
  }

  return {
    name: coercePlayerName(primary) || matchedTeam.teamName || matchedTeam.teamId || null,
    phone: trimOrNull(primary.phone || primary.cell) || null,
    email: trimOrNull(primary.email) || null
  };
}

export default {
  buildRosterSnapshotForGame,
  getAttackerContactForTeam
};
