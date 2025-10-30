// services/teamService.js

/**
 * @file Manages team-related data, such as fetching team information and player lists.
 */

import { getDocs } from "firebase/firestore";
import { teamsCollectionRef } from "./firestoreRefs.js";

/**
 * Fetches all teams from Firestore.
 * @returns {Promise<Array>} A list of team objects.
 */
export async function getAllTeams() {
  const snapshot = await getDocs(teamsCollectionRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
