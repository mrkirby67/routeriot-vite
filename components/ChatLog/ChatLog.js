// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ChatLog/ChatLog.js
// PURPOSE: Renders the chat log UI.
// DEPENDS_ON: none
// USED_BY: features/chat/playerChat.state.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

// components/ChatLog/ChatLog.js

/*
 * @file Renders the chat log UI.
 * This component is responsible for displaying messages in the DOM.
 */

/*
 * Renders a list of messages to the chat log container.
 * @param {Array<Object>} messages - The messages to render.
 */
export function renderMessages(messages = []) {
  const chatLogContainer =
    document.getElementById("chat-log") ||
    document.getElementById("team-chat-log");
  if (!chatLogContainer) return;

  const items = Array.isArray(messages) ? [...messages] : [];
  items.sort((a, b) => {
    const aTs = typeof a.timestampMs === 'number'
      ? a.timestampMs
      : (typeof a.timestamp === 'number' ? a.timestamp : 0);
    const bTs = typeof b.timestampMs === 'number'
      ? b.timestampMs
      : (typeof b.timestamp === 'number' ? b.timestamp : 0);
    return aTs - bTs;
  });

  chatLogContainer.innerHTML = "";

  items.forEach((msg) => {
    const sender = msg.sender || msg.fromTeam || msg.teamId || 'Unknown';
    const recipient = msg.recipient && msg.recipient.toUpperCase() !== 'ALL'
      ? ` → ${msg.recipient}`
      : '';
    const text = typeof msg.text === 'string' ? msg.text : '';
    const timestampMs = typeof msg.timestampMs === 'number'
      ? msg.timestampMs
      : (typeof msg.timestamp === 'number' ? msg.timestamp : Date.now());
    const timeLabel = new Date(timestampMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const msgElement = document.createElement("div");
    msgElement.className = "chat-message";
    msgElement.textContent = `[${timeLabel}] ${sender}${recipient}: ${text}`;
    chatLogContainer.appendChild(msgElement);
  });

  chatLogContainer.scrollTop = chatLogContainer.scrollHeight;
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ChatLog/ChatLog.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: renderMessages
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
