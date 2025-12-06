// ============================================================================
// FILE: services/teams/teamRosterService.js
// PURPOSE: Shared roster loader for player page + Speed Bump overlays (read-only)
// LAYER: services/teams
// DEPENDS_ON: /core/config.js, firebase-firestore
// NOTES: Centralizes racer → team roster lookup to avoid divergent data paths.
// ============================================================================

import { db } from '/core/config.js';
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const RACERS_COLLECTION = 'racers';

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

function mapRacerToRosterEntry(racer) {
  const name = trim(
    racer?.name ||
    racer?.displayName ||
    racer?.playerName ||
    racer?.nickname ||
    ''
  );

  return {
    playerId: racer?.id || racer?.playerId || null,
    name: name || 'Unnamed Racer',
    phone: trim(racer?.cell || racer?.phone || '') || null,
    email: trim(racer?.email || '') || null,
    role: trim(racer?.role || '') || null,
    isCaptain: racer?.isCaptain === true || racer?.captain === true
  };
}

export async function getTeamRoster(gameId = 'global', teamId) {
  const team = trim(teamId);
  if (!team) return [];

  const qy = query(collection(db, RACERS_COLLECTION), where('team', '==', team));
  const snap = await getDocs(qy);
  const roster = [];
  snap.forEach((docSnap) => {
    roster.push(mapRacerToRosterEntry({ id: docSnap.id, ...(docSnap.data() || {}) }));
  });
  return roster;
}

export function subscribeTeamRoster(teamId, callback = () => {}) {
  const team = trim(teamId);
  if (!team) return () => {};

  const qy = query(collection(db, RACERS_COLLECTION), where('team', '==', team));
  const unsub = onSnapshot(qy, (snap) => {
    const roster = [];
    snap.forEach((docSnap) => {
      roster.push(mapRacerToRosterEntry({ id: docSnap.id, ...(docSnap.data() || {}) }));
    });
    callback(roster);
  });

  return unsub;
}

export default {
  getTeamRoster,
  subscribeTeamRoster
};
