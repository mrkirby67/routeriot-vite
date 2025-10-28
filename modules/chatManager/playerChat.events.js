// ============================================================================
// FILE: modules/chatManager/playerChat.events.js
// PURPOSE: Handles player-side chat events and interactions
// ============================================================================

import { sendMessage } from './messageService.js';
import { sendSpeedBumpFromPlayer, releaseSpeedBumpFromPlayer } from '../speedBumpPlayer.js';
import { handleUseSurprise } from './playerChat.surprises.js';
// AUTO-ADDED EXPORT to prevent build errors
export function registerChatEventHandlers(teamName) {
  console.log("🧩 [ADDED] registerChatEventHandlers() stub for", teamName);
  return null;
}
