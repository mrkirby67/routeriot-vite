// === AICP FEATURE HEADER ===
// ============================================================================
// FILE: features/chat/playerChat.events.js
// PURPOSE: Bridges UI events (like sending a message) to the chat state controller.
// DEPENDS_ON: features/chat/playerChat.state.js
// USED_BY: features/chat/playerChat.state.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP FEATURE HEADER ===

/**
 * @file Bridges UI events (like sending a message) to the chat state controller.
 */

import { handleSendMessage } from "./playerChat.state.js";

/**
 * Attaches event listeners for the chat UI.
 */
export function attachChatEventListeners() {
  const sendButton = document.getElementById("send-chat-button");
  const chatInput = document.getElementById("chat-input");

  if (sendButton && chatInput) {
    sendButton.addEventListener("click", () => {
      handleSendMessage(chatInput.value);
      chatInput.value = ""; // Clear input
    });
  }
}

// === AICP FEATURE FOOTER ===
// ai_origin: features/chat/playerChat.events.js
// ai_role: Logic Layer
// aicp_category: feature
// aicp_version: 3.0
// codex_phase: tier2_features_injection
// depends_on: services/*
// export_bridge: components/*
// exports: attachChatEventListeners
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier2_features_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
