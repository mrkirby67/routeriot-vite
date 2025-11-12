import { emit } from '/core/eventBus.js';

export function notifyOpponentList(teams = []) {
  emit('playerPage:opponentList', Array.isArray(teams) ? [...teams] : []);
}
