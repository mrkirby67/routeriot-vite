import { emit } from '/core/eventBus.js';

let sendHandler = null;
let attachHandler = null;

export function pushChatMessages(messages = []) {
  const payload = Array.isArray(messages) ? [...messages] : [];
  emit('chat:messages', payload);
}

export function registerChatSendHandler(fn) {
  if (sendHandler) {
    console.warn('Chat send handler is already registered. Overwriting.');
  }
  sendHandler = fn;
}

export function triggerChatSend(text, recipient) {
  if (sendHandler) {
    sendHandler(text, recipient);
  } else {
    console.error('No chat send handler registered. Message dropped:', { text, recipient });
  }
}

export function registerChatAttachHandler(fn) {
  if (attachHandler) {
    console.warn('Chat attach handler is already registered. Overwriting.');
  }
  attachHandler = fn;
}

export function ensureChatEventListeners() {
  if (attachHandler) {
    attachHandler();
  } else {
    console.error('No chat attach handler registered. Cannot attach listeners.');
  }
}
