// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/chat/playerChat.state.js
// PURPOSE: Main controller for the player chat feature.
// DEPENDS_ON: services/messageService.js, components/ChatLog/ChatLog.js, features/chat/playerChat.events.js
// USED_BY: features/chat/playerChat.events.js, features/player-page/playerPageController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

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

// === AICP FEATURE FOOTER ===
// ai_origin: features/chat/playerChat.state.js
// ai_role: Logic Layer
// aicp_category: feature
// aicp_version: 3.0
// codex_phase: tier2_features_injection
// depends_on: services/*
// export_bridge: components/*
// exports: initializeChat, handleSendMessage
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
