// ============================================================================
// FILE: features/chat/playerChat.events.js
// PURPOSE: Bridges UI events (like sending a message) to the chat state controller.
// DEPENDS_ON: ./playerChat.state.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 1.0
// ============================================================================

// features/chat/playerChat.events.js

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

// # === AI-CONTEXT-MAP ===
// phase: tier2_features_injection
// aicp_category: feature
// exports: attachChatEventListeners
// linked_files: []
// status: stable
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// sync_state: aligned
// # === END ===
