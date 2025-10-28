// ============================================================================
// FILE: modules/chatManager/playerChat.js
// PURPOSE: Entry point for player chat UI and opponent status
// ============================================================================

import * as State from './playerChat.state.js';
import * as Events from './playerChat.events.js';
import * as UI from './playerChat.ui.js';
import * as Surprises from './playerChat.surprises.js';

// Core setup
export function setupPlayerChat(teamName) {
  console.log(`🧩 Initializing Player Chat for ${teamName}`);

  // Initialize state (Firestore listeners, team data, etc.)
  State.setupPlayerChat(teamName);

  // Register event listeners (clicks, surprise use, etc.)
  Events.registerChatEventHandlers(teamName);

  // Initialize UI (builds the panel and live shield ticker)
  UI.initializeTeamSurprisesPanel(teamName);

  console.log('✅ Player Chat modules loaded successfully');
}