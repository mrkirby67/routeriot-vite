// ============================================================================
// STATE SYNC – racer registry + SpeedBump snapshots
// ============================================================================
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../../../modules/config.js';
import { subscribeSpeedBumps } from '../../../modules/speedBump/index.js';

export function syncTeams(controller) {
  const racersRef = collection(db, 'racers');
  return onSnapshot(racersRef, snap => {
    const teams = new Set();
    snap.forEach(d => {
      const t = d.data()?.team;
      if (typeof t === 'string' && t.trim() && t.trim() !== '-') {
        teams.add(t.trim());
      }
    });
    controller.activeTeams = Array.from(teams).sort();
    controller.renderTeamTable();
  });
}

export function syncBumps(controller) {
  return subscribeSpeedBumps((payload = {}) => {
    if (typeof controller.handleSpeedBumpUpdate === 'function') {
      controller.handleSpeedBumpUpdate(payload);
    } else {
      controller.renderRows();
    }
  });
}
