// ============================================================================
// COMMS – Firestore snapshot listener + broadcast parsing
// ============================================================================

import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../config.js';
import { processedMessages, activeBumps } from './core.js';
import { applySpeedBump, applyProofSent, notify } from './interactions.js';
import { clearValidationTimer } from './timers.js';
import { clearWildCard } from '../teamSurpriseManager.js';

let commsUnsub = null;

// ----------------------------------------------------------------------------
// 🔄 Real-time Firestore listener for new communications
// ----------------------------------------------------------------------------
export function ensureCommsListener() {
  if (commsUnsub || typeof window === 'undefined') return;

  const commsQuery = query(collection(db, 'communications'), orderBy('timestamp', 'desc'));
  commsUnsub = onSnapshot(commsQuery, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type !== 'added') return;
      const id = change.doc.id;
      if (processedMessages.has(id)) return;

      processedMessages.add(id);
      const message = (change.doc.data()?.message || '').toString();
      parseBroadcast(message);
    });
  });
}

// ----------------------------------------------------------------------------
// 🧠 Broadcast message parser – applies bump/proof/release updates
// ----------------------------------------------------------------------------
export function parseBroadcast(message = '') {
  if (!message) return;

  // 🎯 New Speed Bump issued
  const speedBumpMatch = message.match(/Speed Bump:\s*([^\n]+?)\s+challenged\s+([^\n!]+)!/);
  if (speedBumpMatch) {
    const [, fromRaw, toRaw] = speedBumpMatch;
    const challenge = (message.match(/Challenge:\s*([^\n]+)/)?.[1] || '').trim();
    const email = (message.match(/Contact Email:\s*([^\n]+)/)?.[1] || '').trim();
    const phone = (message.match(/Contact Phone:\s*([^\n]+)/)?.[1] || '').trim();

    applySpeedBump(toRaw.trim(), {
      by: fromRaw.trim(),
      challenge,
      startedAt: Date.now(),
      contactEmail: email || null,
      contactPhone: phone || null
    });
    return;
  }

  // ✅ Speed Bump cleared
  const releaseMatch = message.match(/Speed Bump Cleared: ([^]+?) is/);
  if (releaseMatch) {
    const team = releaseMatch[1].trim();
    clearValidationTimer(team);
    clearWildCard(team);
    activeBumps.delete(team);
    notify();
    return;
  }

  // 📸 Proof submission
  const proofMatch = message.match(/Proof Sent: ([^|]+)\|([0-9]+)\|([0-9]+)/);
  if (proofMatch) {
    const [, team, expires, proofAt] = proofMatch;
    applyProofSent(team.trim(), Number(expires), Number(proofAt));
  }
}
