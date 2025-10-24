// ============================================================================
// STATE SYNC – racer registry + SpeedBump snapshots
// ============================================================================
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../../../modules/config.js';
import { subscribeSpeedBumps } from '../../../modules/speedBump/index.js';

export function syncTeams(controller) {
  const racersRef = collection(db, 'racers');
  return onSnapshot(racersRef, snap => {
    const teams = [];
    snap.forEach(d => { const t = d.data()?.team; if (t && t !== '-') teams.push(t.trim()); });
    controller.activeTeams = teams.sort();
    controller.renderTeamTable();
  });
}

export function syncBumps(controller) {
  return subscribeSpeedBumps(() => controller.renderRows());
}