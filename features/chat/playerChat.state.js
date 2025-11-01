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

/*
 * @file Main controller for the player chat feature.
 * It manages state, listens for new messages, and updates the UI.
 */

import * as messageService from "../../services/messageService.js";
import { renderMessages } from "../../components/ChatLog/ChatLog.js";
import { attachChatEventListeners } from "./playerChat.events.js";
import { initializeMessageListener } from "../../modules/messageListener.js";

let teamId = null;
let unsubscribeMessages = null;
const messageBuffer = [];
const messageIds = new Set();

function normalizeKey(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function determineTeamId() {
  if (typeof window !== 'undefined') {
    if (window.currentPlayerTeam && typeof window.currentPlayerTeam === 'string') {
      return window.currentPlayerTeam.trim();
    }
    if (window.localStorage) {
      const stored = window.localStorage.getItem('teamName');
      if (stored) return stored.trim();
    }
  }
  return 'Unknown Team';
}

/*
 * Initializes the chat feature.
 */
export function initializeChat() {
  teamId = determineTeamId();

  attachChatEventListeners();

  // Reset message buffer and UI
  messageBuffer.length = 0;
  messageIds.clear();
  renderMessages([]);

  // Reinitialize listener
  unsubscribeMessages?.();
  unsubscribeMessages = initializeMessageListener((message) => {
    if (!message) return;

    const senderKey = normalizeKey(message.sender || message.fromTeam);
    const recipientKey = normalizeKey(message.recipient);
    const targetKey = normalizeKey(teamId);

    if (
      targetKey &&
      senderKey !== targetKey &&
      recipientKey !== targetKey &&
      recipientKey !== 'all'
    ) {
      return;
    }

    if (message.id && messageIds.has(message.id)) return;
    if (message.id) messageIds.add(message.id);

    messageBuffer.push(message);
    renderMessages(messageBuffer);
  });
}

/*
 * Handles sending a message.
 * @param {string} text - The message to send.
 */
export function handleSendMessage(text, recipient = 'ALL') {
  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText) return;
  if (!teamId) {
    console.warn('Cannot send message without an identified team.');
    return;
  }

  const cleanRecipient = typeof recipient === 'string' && recipient.trim()
    ? recipient.trim()
    : 'ALL';

  messageService.sendMessage(teamId, cleanRecipient, cleanText);
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
