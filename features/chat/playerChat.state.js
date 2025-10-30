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
