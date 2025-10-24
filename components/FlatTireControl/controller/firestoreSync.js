// ============================================================================
// FIRESTORE SYNC for Flat Tire Control
// ============================================================================
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../../../modules/config.js';

export function subscribeToRacers(controller) {
  try {
    const racersRef = collection(db, 'racers');
    return onSnapshot(racersRef, snapshot => {
      const teams = [];
      snapshot.forEach(doc => {
        const t = doc.data();
        if (t.team && t.team !== '-') teams.push(t.team.trim());
      });
      controller.handleTeamRegistry(teams);
    });
  } catch (err) {
    console.warn('⚠️ Racer subscription failed:', err);
    controller.handleTeamRegistry([]);
    return () => {};
  }
}

export function applyConfig(controller, config) {
  if (!config?.zones) return;
  controller.config = config;
  controller.ignoreConfigInput = true;

  ['north', 'south', 'east', 'west'].forEach(k => {
    const zone = config.zones[k];
    const input = controller.dom.zoneInputs.get(k);
    if (input) input.value = zone.gps || '';
  });

  if (controller.dom.autoIntervalInput)
    controller.dom.autoIntervalInput.value = config.autoIntervalMinutes;

  controller.ignoreConfigInput = false;
}