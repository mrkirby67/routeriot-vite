// ============================================================================
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// AUTHOR: James Kirby / Route Riot Project
// sanitized metadata line
// AICP_VERSION: 1.0
// ============================================================================

import ChatServiceV2, { normalizeDoc } from "../../services/ChatServiceV2.js";
import { ensureChatEventListeners, registerChatSendHandler, pushChatMessages } from "./playerChat.bridge.js";

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
    const candidate =
      (typeof window.currentPlayerTeam === 'string' && window.currentPlayerTeam.trim()) ||
      (window.localStorage && window.localStorage.getItem('teamName'));
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return 'Unknown Team';
}

function ensureNormalizedMessage(message) {
  if (!message || typeof message !== 'object') return null;

  const hasNormalizedShape =
    typeof message.sender === 'string' &&
    typeof message.recipient === 'string' &&
    Object.prototype.hasOwnProperty.call(message, 'timestampMs');
  if (hasNormalizedShape) return message;

  try {
    const docLike = {
      id: message.id || `local-${Date.now()}`,
      data: () => message
    };
    return normalizeDoc(docLike);
  } catch (err) {
    console.warn('Failed to normalize chat payload:', err);
    return null;
  }
}

export function initializeChat() {
  teamId = determineTeamId();

  ensureChatEventListeners();

  messageBuffer.length = 0;
  messageIds.clear();
  pushChatMessages([]);

  unsubscribeMessages?.();
  unsubscribeMessages = ChatServiceV2.listenForTeam(teamId, (incomingBatch) => {
    const batch = Array.isArray(incomingBatch) ? incomingBatch : [incomingBatch];
    let didAppend = false;

    batch.forEach((incoming) => {
      const normalized = ensureNormalizedMessage(incoming);
      if (!normalized) return;

      const teamKey = normalizeKey(teamId);
      const senderKey = normalizeKey(normalized.sender || normalized.fromTeam);
      const recipientKey = normalizeKey(normalized.recipient || normalized.toTeam);

      const involved =
        !teamKey ||
        senderKey === teamKey ||
        recipientKey === teamKey ||
        recipientKey === 'all';

      if (!involved) return;
      if (normalized.id && messageIds.has(normalized.id)) return;
      if (normalized.id) messageIds.add(normalized.id);

      messageBuffer.push(normalized);
      didAppend = true;
    });

    if (didAppend) {
      pushChatMessages([...messageBuffer]);
    }
  });
}

export function handleSendMessage(text, recipient = 'ALL') {
  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText) return;

  const cleanRecipient = typeof recipient === 'string' && recipient.trim()
    ? recipient.trim()
    : 'ALL';


  if (!teamId) {
    console.warn('Cannot send message without an identified team.');
    return;
  }

  ChatServiceV2.send({
    fromTeam: teamId,
    toTeam: cleanRecipient,
    text: cleanText,
    kind: cleanRecipient.toUpperCase() === 'ALL' ? 'broadcast' : 'chat'
  });
}

registerChatSendHandler(handleSendMessage);

export function teardownChat(reason = 'manual') {
  unsubscribeMessages?.(reason);
  unsubscribeMessages = null;
  messageBuffer.length = 0;
  messageIds.clear();
}
