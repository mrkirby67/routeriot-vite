// ============================================================================
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// AUTHOR: James Kirby / Route Riot Project
// sanitized metadata line
// AICP_VERSION: 1.0
// ============================================================================

import ChatServiceV2 from './ChatServiceV2.js';

// ============================================================================
// ✅ AICP HEADER: v3.0.0 | Chat Service Repair | 2025-11-05
// ============================================================================

/*
 * Send a chat message from the current team to a target team.
 * Delegates to ChatServiceV2.send() — no legacy bridge.
 * @param {string} fromTeam - the sending team name
 * @param {string} toTeam - the receiving team name
 * @param {string} text - the chat message text
 * @returns {Promise<void>}
 */

export async function sendMessage(fromTeam, toTeam, text) {
  try {
    if (!fromTeam || !toTeam || !text) {
      console.warn('⚠️ sendMessage missing parameters:', { fromTeam, toTeam, text });
      return;
    }
    await ChatServiceV2.send({
      fromTeam,
      toTeam,
      text,
      kind: 'chat'
    });
  } catch (err) {
    console.error('💥 ChatServiceV2.send failed:', err);
  }
}

/*
 * Listen for messages sent to a specific team.
 * Delegates to ChatServiceV2.listenForTeam() and passes each message to the callback.
 * @param {string} teamName - the team to listen for
 * @param {function(Object):void} callback - handler for incoming messages
 * @returns {function():void} unsubscribe function
 */

export function listenForMyMessages(teamName, callback) {
  try {
    if (!teamName || typeof callback !== 'function') {
      console.warn('⚠️ listenForMyMessages called with invalid args:', { teamName, callback });
      return () => {};
    }
    return ChatServiceV2.listenForTeam(teamName, (message) => {
      try {
        callback(message);
      } catch (cbErr) {
        console.error('💥 Message callback error:', cbErr);
      }
    });
  } catch (err) {
    console.error('💥 ChatServiceV2.listenForTeam failed:', err);
    return () => {};
  }
}

// ============================================================================
// ✅ AICP FOOTER: End of messageService.js
// ============================================================================
