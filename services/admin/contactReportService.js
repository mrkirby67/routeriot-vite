// ============================================================================
// FILE: services/admin/contactReportService.js
// PURPOSE: Read-only Firestore contact dump (teams + racers) for admin/debug use
// LAYER: services/admin
// NOTES: No game logic changes. Intended for tooling + dev-only routes.
// ============================================================================

import { db } from '../../core/config.js';
import {
  collection,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const COLLECTION_RACERS = 'racers';
const COLLECTION_TEAMS = 'teams';

const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeTeam = (value) => trim(value).toLowerCase();

function extractContactFields(data = {}) {
  const phone = trim(data.phone || data.cell || data.mobile || '');
  const email = trim(data.email || data.emailAddress || '');
  return {
    phone: phone || null,
    email: email || null
  };
}

async function fetchCollectionDocs(name) {
  const snap = await getDocs(collection(db, name));
  const docs = [];
  snap.forEach((docSnap) => {
    docs.push({ id: docSnap.id, ...(docSnap.data() || {}) });
  });
  return docs;
}

/**
 * Flatten all known contact records (teams + racers).
 * - racers: canonical per-player contact, keyed by team.
 * - teams: team-level contact (if present) included as separate rows.
 */
export async function fetchAllTeamContacts() {
  const [teams, racers] = await Promise.all([
    fetchCollectionDocs(COLLECTION_TEAMS),
    fetchCollectionDocs(COLLECTION_RACERS)
  ]);

  const teamLookup = new Map();
  teams.forEach((team) => {
    const teamName = trim(team.name || team.teamName || team.id);
    const normalized = normalizeTeam(teamName);
    if (!normalized) return;
    const contact = extractContactFields(team);
    teamLookup.set(normalized, {
      teamId: team.id,
      teamName,
      ...contact
    });
  });

  const results = [];

  teams.forEach((team) => {
    const teamName = trim(team.name || team.teamName || team.id);
    const normalized = normalizeTeam(teamName);
    if (!normalized) return;
    const contact = extractContactFields(team);
    if (contact.phone || contact.email) {
      results.push({
        source: 'teams',
        teamId: team.id,
        teamName,
        playerId: null,
        playerName: null,
        phone: contact.phone,
        email: contact.email
      });
    }
  });

  racers.forEach((racer) => {
    const playerName = trim(racer.displayName || racer.name || racer.nickname || racer.playerName || racer.id);
    const teamName = trim(racer.team || '');
    const normalizedTeam = normalizeTeam(teamName);
    const fallbackTeam = teamLookup.get(normalizedTeam);
    const contact = extractContactFields(racer);

    results.push({
      source: 'racers',
      teamId: fallbackTeam?.teamId || normalizedTeam || null,
      teamName: teamName || fallbackTeam?.teamName || '(unassigned)',
      playerId: racer.id || racer.playerId || null,
      playerName: playerName || null,
      phone: contact.phone || fallbackTeam?.phone || null,
      email: contact.email || fallbackTeam?.email || null
    });
  });

  return results;
}

export default {
  fetchAllTeamContacts
};
