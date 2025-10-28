// ============================================================================
// MODULE: flatTire_fixGPS.js
// PURPOSE: Ensure all depot zones have proper numeric GPS fields
// ============================================================================

import { db } from './config.js';
import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function normalizeTowDepots() {
  console.group('🧭 [FlatTire GPS] Depot normalization');

  let snapshot;
  try {
    snapshot = await getDocs(collection(db, 'zones'));
  } catch (err) {
    console.error('🔥 Failed to load zones for GPS normalization:', err);
    console.groupEnd();
    throw err;
  }

  let examined = 0;
  let repaired = 0;
  let missing = 0;

  for (const docSnap of snapshot.docs) {
    examined += 1;
    const data = docSnap.data() || {};
    const name = data.zoneName || docSnap.id;
    const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';

    if (!type.includes('depot')) {
      continue;
    }

    const lat = normalizeNumber(data.latitude);
    const lng = normalizeNumber(data.longitude);

    if (lat !== null && lng !== null) {
      console.log(`✅ Depot OK → ${name} (${lat}, ${lng})`);
      continue;
    }

    if (data.latitude != null && data.longitude != null) {
      const fixedLat = normalizeNumber(String(data.latitude).trim());
      const fixedLng = normalizeNumber(String(data.longitude).trim());
      if (fixedLat !== null && fixedLng !== null) {
        await updateDoc(doc(db, 'zones', docSnap.id), {
          latitude: fixedLat,
          longitude: fixedLng
        });
        repaired += 1;
        console.warn(`🛠️ Converted string GPS for depot ${name} → (${fixedLat}, ${fixedLng})`);
        continue;
      }
    }

    missing += 1;
    console.error(`❌ Depot ${name} missing valid GPS coordinates.`);
  }

  console.groupEnd();
  console.info(`📊 Depot scan complete → checked ${examined}, repaired ${repaired}, missing GPS on ${missing}.`);
  return { examined, repaired, missing };
}

// Auto-run when imported directly for quick diagnostics
normalizeTowDepots().catch((err) => {
  console.error('🔥 GPS normalization run failed:', err);
});
