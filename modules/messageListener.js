// ============================================================================
// FILE: modules/messageListener.js
// PURPOSE: Lightweight Firestore listener for player-to-player messages
// ============================================================================

import { db } from '/core/config.js';
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

/*
 * Subscribes to the conversations feed and forwards new messages to the callback.
 * @param {(message: object) => void} onMessageReceived
 * @returns {import("firebase/firestore").Unsubscribe}
 */
export function initializeMessageListener(onMessageReceived) {
  if (typeof onMessageReceived !== 'function') {
    console.warn('initializeMessageListener expects a callback function.');
    return () => {};
  }

  const conversationsRef = collection(db, 'conversations');
  const q = query(conversationsRef, orderBy('createdAt', 'asc'));

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return;
      const data = change.doc.data();
      const message = {
        id: change.doc.id,
        ...data,
        timestampMs: toMillis(data.createdAt)
      };
      console.info('📩 Message received:', message);
      try {
        onMessageReceived(message);
      } catch (err) {
        console.error('❌ Message listener callback failed:', err);
      }
    });
  }, (error) => {
    console.error('❌ Failed to subscribe to conversations:', error);
  });
}
