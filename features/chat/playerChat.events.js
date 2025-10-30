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
