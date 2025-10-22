// ============================================================================
// FILE: modules/chatManager/utils.js
// PURPOSE: Shared helpers for rendering chat entries
// ============================================================================

export const GAME_MASTER_NAME = 'Game Master';

export function safeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveSenderName(msg) {
  if (!msg || typeof msg !== 'object') return GAME_MASTER_NAME;
  const raw =
    (typeof msg.senderDisplay === 'string' && msg.senderDisplay.trim()) ? msg.senderDisplay.trim() :
    (typeof msg.sender === 'string' && msg.sender.trim()) ? msg.sender.trim() :
    (typeof msg.teamName === 'string' && msg.teamName.trim()) ? msg.teamName.trim() :
    null;
  return raw || GAME_MASTER_NAME;
}

export function shouldRenderRaw(msg) {
  const senderName = resolveSenderName(msg);
  return Boolean(msg?.isBroadcast && senderName === GAME_MASTER_NAME);
}
