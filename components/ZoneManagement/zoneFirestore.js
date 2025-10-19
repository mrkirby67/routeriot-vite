// ============================================================================
// File: components/ZoneManagement/zoneFirestore.js
// Purpose: Central Firestore utilities for Zone Management
// ============================================================================

import { db } from '../../modules/config.js';
import {
  doc,
  setDoc,
  addDoc,
  getDocs,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Reusable reference for the Zones collection
export const zonesCollection = collection(db, "zones");

/**
 * Updates or merges a single zone's data in Firestore.
 * @param {string} zoneId - The zone document ID.
 * @param {Object} data - The fields to update.
 */
export async function updateZoneField(zoneId, data) {
  return setDoc(doc(db, "zones", zoneId), data, { merge: true });
}