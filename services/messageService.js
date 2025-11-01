// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/messageService.js
// PURPOSE: Data layer for handling chat messages.
// DEPENDS_ON: https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../modules/config.js
// USED_BY: features/chat/playerChat.state.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP SERVICE HEADER ===

/*
 * @file Data layer for handling chat messages.
 * This service is responsible for sending and receiving messages via Firestore,
 * without any direct DOM manipulation.
 */

import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../modules/config.js";

const conversationsCollectionRef = collection(db, "conversations");

function normalizeName(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeKey(value) {
  const base = normalizeName(value);
  return base.toLowerCase();
}

function toMillis(timestamp) {
  if (!timestamp) return Date.now();
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (timestamp.seconds != null) {
    const millis = timestamp.seconds * 1000;
    const nanos = Math.floor((timestamp.nanoseconds || 0) / 1e6);
    return millis + nanos;
  }
  return Date.now();
}

function appendMessageToElement(element, message) {
  if (!element) return;
  const entry = document.createElement('div');
  entry.className = 'chat-message';

  const timestampMs = toMillis(message.timestamp);
  const timeLabel = new Date(timestampMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const senderLabel = message.sender || message.fromTeam || 'Unknown';
  const recipientLabel = message.recipient || 'ALL';
  const direction =
    recipientLabel && recipientLabel.toUpperCase() !== 'ALL'
      ? `${senderLabel} → ${recipientLabel}`
      : senderLabel;

  entry.textContent = `[${timeLabel}] ${direction}: ${message.text || ''}`;
  element.appendChild(entry);
  element.scrollTop = element.scrollHeight;
}

/*
 * Sends a chat message from one player to another.
 * @param {string} sender - Name or team ID of sender
 * @param {string} recipient - Name or team ID of recipient
 * @param {string} text - Message text
 */
export async function sendMessage(sender, recipient, text) {
  // Support legacy signature: sendMessage(sender, text)
  let actualSender = sender;
  let actualRecipient = recipient;
  let actualText = text;

  if (typeof actualText === 'undefined') {
    actualText = actualRecipient;
    actualRecipient = 'ALL';
  }

  const cleanText = typeof actualText === 'string' ? actualText.trim() : '';
  if (!cleanText) {
    console.warn("Empty message ignored.");
    return null;
  }

  const payload = {
    sender: normalizeName(actualSender, 'Unknown'),
    recipient: normalizeName(actualRecipient, 'ALL'),
    text: cleanText,
    timestamp: serverTimestamp()
  };

  try {
    const docRef = await addDoc(conversationsCollectionRef, payload);
    console.info("💬 Message sent:", docRef.id, cleanText);
    return docRef.id;
  } catch (err) {
    console.error("❌ Failed to send message:", err);
    return null;
  }
}

/*
 * Subscribes to all conversation documents and returns the full list on updates.
 */
export function onNewMessage(callback) {
  if (typeof callback !== 'function') {
    console.warn('onNewMessage requires a callback function.');
    return () => {};
  }

  const q = query(conversationsCollectionRef, orderBy("timestamp", "asc"));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        timestampMs: toMillis(data.timestamp)
      };
    });
    callback(messages);
  }, (error) => {
    console.error('❌ Failed to listen for conversations:', error);
  });
}

/*
 * Streams messages relevant to a specific team and optionally renders them.
 * @param {string} teamName - Team identifier to filter messages.
 * @param {HTMLElement|function} target - Element to render into or callback to invoke per message.
 * @returns {import("firebase/firestore").Unsubscribe} Unsubscribe function.
 */
export function listenForMyMessages(teamName, target) {
  const normalizedTeam = normalizeName(teamName);
  const normalizedKey = normalizeKey(teamName);
  if (!normalizedTeam) {
    console.warn('listenForMyMessages called without a valid team name.');
    return () => {};
  }

  const elementTarget =
    typeof Element !== 'undefined' && target instanceof Element ? target : null;
  const callbackTarget = typeof target === 'function' ? target : null;

  if (elementTarget) {
    elementTarget.innerHTML = '';
  }

  const seenIds = new Set();
  const q = query(conversationsCollectionRef, orderBy("timestamp", "asc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return;
      if (seenIds.has(change.doc.id)) return;

      const data = change.doc.data();
      const message = {
        id: change.doc.id,
        ...data,
        timestampMs: toMillis(data.timestamp)
      };

      const senderKey = normalizeKey(message.sender);
      const recipientKey = normalizeKey(message.recipient);
      const involvesTeam =
        senderKey === normalizedKey ||
        recipientKey === normalizedKey ||
        recipientKey === 'all';

      if (!involvesTeam) return;

      seenIds.add(message.id);
      console.info("📩 Message received:", message);

      if (callbackTarget) {
        try {
          callbackTarget(message);
        } catch (err) {
          console.error('❌ Message callback failed:', err);
        }
      } else if (elementTarget) {
        appendMessageToElement(elementTarget, message);
      }
    });
  }, (error) => {
    console.error('❌ Failed to listen for conversations:', error);
  });

  return unsubscribe;
}

// === AICP SERVICE FOOTER ===
// ai_origin: services/messageService.js
// ai_role: Data Layer
// aicp_category: service
// aicp_version: 3.0
// codex_phase: tier1_services_injection
// export_bridge: features/*
// exports: sendMessage, onNewMessage, listenForMyMessages
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier1_services_injection
// review_status: complete
// status: stable
// sync_state: aligned
// === END AICP SERVICE FOOTER ===
