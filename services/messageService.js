// ============================================================================
// FILE: services/messageService.js
// PURPOSE: Data layer for handling chat messages.
// DEPENDS_ON: firebase/firestore, ../modules/config.js
// USED_BY: features/chat/playerChat.state.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 1.0
// ============================================================================

// services/messageService.js

/**
 * @file Data layer for handling chat messages.
 * This service is responsible for sending and receiving messages via Firestore,
 * without any direct DOM manipulation.
 */

import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../modules/config.js";

const messagesCollectionRef = collection(db, "messages");

/**
 * Sends a chat message.
 * @param {string} teamId - The sender's team ID.
 * @param {string} text - The message content.
 */
export async function sendMessage(teamId, text) {
  await addDoc(messagesCollectionRef, {
    teamId,
    text,
    timestamp: new Date()
  });
}

/**
 * Listens for new messages.
 * @param {function} callback - Function to call with new messages.
 * @returns {import("firebase/firestore").Unsubscribe} Unsubscribe function.
 */
export function onNewMessage(callback) {
  const q = query(messagesCollectionRef, orderBy("timestamp", "desc"));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(messages);
  });
}

// # === AI-CONTEXT-MAP ===
// phase: tier1_services_injection
// aicp_category: service
// exports: sendMessage, onNewMessage
// linked_files: []
// status: stable
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// sync_state: aligned
// # === END ===
