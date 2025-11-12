import { on } from '/core/eventBus.js';
import { renderOpponentList } from '/components/OpponentList/OpponentList.js';

on('playerPage:opponentList', (payload) => {
  if (Array.isArray(payload)) {
    renderOpponentList(payload);
    return;
  }
  if (Array.isArray(payload?.teams)) {
    renderOpponentList(payload.teams);
  } else {
    renderOpponentList([]);
  }
});
