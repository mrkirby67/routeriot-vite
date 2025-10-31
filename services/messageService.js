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

/**
 * @file Data layer for handling chat messages.
 * This service is responsible for sending and receiving messages via Firestore,
 * without any direct DOM manipulation.
 */

import { collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../modules/config.js";

const messagesCollectionRef = collection(db, "messages");

/**
 * Sends a chat message.
 * Supports both legacy (fromTeam, toTeam, text) and new (teamId, text) signatures.
 */
export async function sendMessage(arg1, arg2, arg3) {
  const fromTeam = typeof arg1 === "string" ? arg1.trim() : "";
  let toTeam = "";
  let text = "";

  if (typeof arg3 === "undefined") {
    text = typeof arg2 === "string" ? arg2 : "";
  } else {
    toTeam = typeof arg2 === "string" ? arg2.trim() : "";
    text = typeof arg3 === "string" ? arg3 : "";
  }

  if (!fromTeam || !text) return;

  await addDoc(messagesCollectionRef, {
    fromTeam,
    toTeam: toTeam || null,
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

/**
 * Placeholder listener for compatibility with legacy bridge code.
 * The legacy UI logic falls back when no concrete implementation exists.
 */
export function listenForMyMessages() {
  console.warn("listenForMyMessages is not yet implemented in services/messageService.js");
  return () => {};
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
