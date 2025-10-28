// ============================================================================
// FILE: modules/chatManager/playerChat.js
// PURPOSE: Entry point for player chat UI and opponent status
// ============================================================================

import * as State from './playerChat.state.js';
import * as Events from './playerChat.events.js';
import { initializeTeamSurprisesPanel } from './playerChat.ui.js';

// Core setup
export function setupPlayerChat(teamName) {
  const incomingName = typeof teamName === 'string' ? teamName.trim() : '';
  console.log(`🧩 Initializing Player Chat for ${incomingName || teamName}`);

  // Initialize UI (builds the panel and live shield ticker)
  const teamSurprisesController = initializeTeamSurprisesPanel(incomingName || teamName);
  if (!teamSurprisesController) {
    console.warn('⚠️ Team Surprises panel failed to initialize');
  }

  // Initialize state (Firestore listeners, team data, etc.)
  const stateHandle = State.setupPlayerChat(teamName, { ui: teamSurprisesController });
  const currentTeamName = stateHandle?.teamName || incomingName || teamName;

  // Register event listeners (clicks, surprise use, etc.)
  const detachEvents = Events.registerChatEventHandlers(currentTeamName);

  console.log('✅ Player Chat modules loaded successfully');

  return (reason = 'manual') => {
    try {
      detachEvents?.(reason);
    } catch (err) {
      console.debug('⚠️ Failed to detach chat events:', err);
    }
    try {
      stateHandle?.teardown?.(reason);
    } catch (err) {
      console.debug('⚠️ Failed to teardown chat state:', err);
    }
    try {
      teamSurprisesController?.teardown?.();
    } catch (err) {
      console.debug('⚠️ Failed to teardown surprises controller:', err);
    }
  };
}
