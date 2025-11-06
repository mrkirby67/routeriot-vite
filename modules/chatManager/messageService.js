import ChatServiceV2, {
  send as sendMessage,
  listenForTeam as listenForMyMessages,
  listenBroadcasts as listenForBroadcasts,
  listenAll,
  issueChirpTask,
  closeChirpTask,
  sendChirpResponse,
  listenChirpResponses,
  listenChirpTasks,
  setChirpGameId
} from '../../services/ChatServiceV2.js';

const CONTROL_ALIAS = 'Control';
const SYSTEM_ALIAS = 'System';

function normaliseTeam(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normaliseText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export {
  sendMessage,
  listenForMyMessages,
  listenForBroadcasts,
  listenAll,
  issueChirpTask,
  closeChirpTask,
  sendChirpResponse,
  listenChirpResponses,
  listenChirpTasks,
  setChirpGameId
};
export default ChatServiceV2;

export function sendPrivateMessage(from, to, text) {
  const sender = normaliseTeam(from, CONTROL_ALIAS);
  const recipient = normaliseTeam(to, 'ALL') || 'ALL';
  const body = normaliseText(text);
  if (!body) return Promise.resolve(null);

  return ChatServiceV2.send({
    fromTeam: sender,
    toTeam: recipient,
    text: body,
    kind: recipient.toUpperCase() === 'ALL' ? 'broadcast' : 'chat'
  });
}

export function sendTeamMessage(from, to, text) {
  return sendPrivateMessage(from, to, text);
}

export function broadcastMessage(from, text) {
  const sender = normaliseTeam(from, CONTROL_ALIAS);
  const body = normaliseText(text);
  if (!body) return Promise.resolve(null);

  return ChatServiceV2.send({
    fromTeam: sender,
    toTeam: 'ALL',
    text: body,
    kind: 'broadcast'
  });
}

export function sendPrivateSystemMessage(trigger, to = 'ALL') {
  const recipient = normaliseTeam(to, 'ALL') || 'ALL';
  const body = normaliseText(trigger);
  if (!body) return Promise.resolve(null);

  return ChatServiceV2.send({
    fromTeam: SYSTEM_ALIAS,
    toTeam: recipient,
    text: body,
    kind: 'system'
  });
}

if (typeof window !== 'undefined') {
  const existing = typeof window.chatManager === 'object' && window.chatManager !== null
    ? window.chatManager
    : {};

  window.chatManager = {
    ...existing,
    sendMessage,
    sendPrivateMessage,
    sendTeamMessage,
    broadcastMessage,
    sendPrivateSystemMessage,
    listenForMyMessages,
    listenForBroadcasts,
    listenAll,
    issueChirpTask,
    closeChirpTask,
    sendChirpResponse,
    listenChirpResponses,
    listenChirpTasks,
    setChirpGameId
  };

  console.info('🧱 Legacy chatManager bridge active');
}
