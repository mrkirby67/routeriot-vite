import { on } from '/core/eventBus.js';
import { renderMessages } from '/components/ChatLog/ChatLog.js';

on('chat:messages', (messages) => {
  if (Array.isArray(messages)) {
    renderMessages(messages);
  } else {
    renderMessages([]);
  }
});
