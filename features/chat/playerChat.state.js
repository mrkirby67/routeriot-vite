// ============================================================================
// FILE: features/chat/playerChat.state.js
// PURPOSE: Main controller for the player chat feature.
// DEPENDS_ON: ../../services/messageService.js, ../../components/ChatLog/ChatLog.js, ./playerChat.events.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 1.0
// ============================================================================

// features/chat/playerChat.state.js

/**
 * @file Main controller for the player chat feature.
 * It manages state, listens for new messages, and updates the UI.
 */

import * as messageService from "../../services/messageService.js";
import { renderMessages } from "../../components/ChatLog/ChatLog.js";
import { attachChatEventListeners } from "./playerChat.events.js";

let teamId = "current_team_id"; // This should be dynamically set

/**
 * Initializes the chat feature.
 */
export function initializeChat() {
  attachChatEventListeners();
  messageService.onNewMessage(renderMessages);
}

/**
 * Handles sending a message.
 * @param {string} text - The message to send.
 */
export function handleSendMessage(text) {
  if (text.trim()) {
    messageService.sendMessage(teamId, text);
  }
}

// # === AI-CONTEXT-MAP ===
// phase: tier2_features_injection
// aicp_category: feature
// exports: initializeChat, handleSendMessage
// linked_files: []
// status: stable
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// sync_state: aligned
// # === END ===
