// ============================================================================
// REVERSALS – handle Instant Karma collisions
// ============================================================================
import { broadcastEvent } from '../zonesFirestore.js';
import { startWildCard, clearWildCard, startCooldown as startGuardCooldown } from '../teamSurpriseManager.js';
import { showWreckedOverlay } from '../playerUI/overlays.js';
import { applySpeedBump, notify } from './interactions.js';
import { REVERSAL_DELAY_MS, WILD_CARD_DURATION_MS } from './core.js';
import { sendPrivateMessage } from '../chatManager/messageService.js';

export function handleReversal(priorAttacker, priorVictim, newAttacker, challenge) {
  console.log(`💥 Reversal: ${newAttacker} attacked ${priorAttacker} mid-Speed-Bump`);
  showWreckedOverlay(priorAttacker, priorVictim, newAttacker);
  broadcastEvent('Game Master', `💥 Instant Karma! ${newAttacker} hit ${priorAttacker} — both wrecked!`, false);

  setTimeout(() => {
    clearWildCard(priorVictim);
    notify();
    startWildCard(priorAttacker, 'speedBump', WILD_CARD_DURATION_MS);
    startGuardCooldown(priorAttacker);
    startGuardCooldown(priorVictim);

    applySpeedBump(priorAttacker, { by: newAttacker, challenge, startedAt: Date.now() });
    sendPrivateMessage(priorAttacker, '🚧 You hit your own bump!');
    sendPrivateMessage(priorVictim, '🛞 You’re free!');
    sendPrivateMessage(newAttacker, '😈 Instant Karma delivered!');
  }, REVERSAL_DELAY_MS);
}