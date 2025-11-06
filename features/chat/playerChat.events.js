// ============================================================================
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// AUTHOR: James Kirby / Route Riot Project
// sanitized metadata line
// AICP_VERSION: 1.0
// ============================================================================

import { triggerChatSend, registerChatAttachHandler } from './playerChat.bridge.js';

let listenersAttached = false;

export function attachChatEventListeners() {
  if (listenersAttached) return;

  const sendButton = document.getElementById('send-chat-button');
  const chatInput = document.getElementById('chat-input');
  const recipientInput = document.getElementById('chat-recipient');

  const triggerSend = () => {
    if (!chatInput) return;
    const text = chatInput.value;
    const recipient = recipientInput?.value?.trim() || 'ALL';
    triggerChatSend(text, recipient);
    chatInput.value = '';
  };

  if (sendButton && chatInput) {
    sendButton.addEventListener('click', triggerSend);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        triggerSend();
      }
    });
  }

  listenersAttached = true;
}

registerChatAttachHandler(attachChatEventListeners);
