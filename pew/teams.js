// ============================================================================
// Pew Pursuit team data helpers.
// Connects exclusively to teams_pew collection.
// ============================================================================

import { db } from '/core/config.js';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { PEW_COLLECTIONS } from './config.js';

const teamsCollectionRef = collection(db, PEW_COLLECTIONS.teams);

export function watchTeams(callback) {
  return onSnapshot(
    teamsCollectionRef,
    (snapshot) => {
      const teams = snapshot.docs.map((teamDoc) => ({
        id: teamDoc.id,
        ...teamDoc.data(),
      }));
      callback?.(teams);
    },
    (error) => {
      console.error('❌ Pew Pursuit teams listener failed.', error);
    },
  );
}

export async function fetchTeamsOnce() {
  const snapshot = await getDocs(teamsCollectionRef);
  return snapshot.docs.map((teamDoc) => ({
    id: teamDoc.id,
    ...teamDoc.data(),
  }));
}

export async function upsertTeam(teamId, partial) {
  if (!teamId) throw new Error('Team ID required for Pew Pursuit upsert.');
  const ref = doc(db, PEW_COLLECTIONS.teams, teamId);
  await setDoc(ref, partial, { merge: true });
}

export async function markTeamCheckIn(teamId, isOnline) {
  if (!teamId) return;
  const ref = doc(db, PEW_COLLECTIONS.teams, teamId);
  await updateDoc(ref, {
    isOnline: Boolean(isOnline),
    lastSeen: Date.now(),
  });
}

// TODO: expose admin utilities for seeding bracket + roster CSV ingest.
