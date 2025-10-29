import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './config.js';

export async function verifyFirestoreSchema() {
  const required = [
    'settings/bugStrikeSettings',
    'settings/flatTireConfig',
    'settings/rules',
    'game/gameState',
    'game/activeTeams'
  ];

  for (const path of required) {
    try {
      const snap = await getDoc(doc(db, ...path.split('/')));
      console.log(`[CHECK] ${path}: ${snap.exists() ? '✅ found' : '❌ missing'}`);
    } catch (err) {
      console.error(`[CHECK] ${path}: ⚠️ error`, err);
    }
  }
}
