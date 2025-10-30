// components/ChatLog/ChatLog.js

/**
 * @file Renders the chat log UI.
 * This component is responsible for displaying messages in the DOM.
 */

/**
 * Renders a list of messages to the chat log container.
 * @param {Array<Object>} messages - The messages to render.
 */
export function renderMessages(messages) {
  const chatLogContainer = document.getElementById("chat-log"); // Assuming this exists
  if (!chatLogContainer) return;

  chatLogContainer.innerHTML = ""; // Clear existing messages
  messages.forEach(msg => {
    const msgElement = document.createElement("div");
    msgElement.textContent = `[${msg.teamId}]: ${msg.text}`;
    chatLogContainer.appendChild(msgElement);
  });
}
