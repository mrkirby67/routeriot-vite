// ============================================================================
// COMMS – Firestore listener + broadcast parsing (Unified, Corrected)
// ============================================================================

import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../config.js';

import { processedMessages } from './core.js';
import { applySpeedBump, applyProofSent, releaseSpeedBump } from './interactions.js';

// ----------------------------------------------------------------------------
// 🔄 Real-time Firestore listener for new communications
// ----------------------------------------------------------------------------
let commsUnsub = null;

export function ensureCommsListener() {
  if (commsUnsub || typeof window === 'undefined') return;

  const q = query(collection(db, 'communications'), orderBy('timestamp', 'desc'));

  commsUnsub = onSnapshot(q, snapshot => {
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
// 🧠 Broadcast Message Parser (All branches routed to *official* logic)
// ----------------------------------------------------------------------------
export function parseBroadcast(message = '') {
  if (!message) return;

  // ------------------------------------------------------------
  // 🎯 New Speed Bump Issued
  // Format: Speed Bump: TEAM_A challenged TEAM_B!
  // ------------------------------------------------------------
  const bump = message.match(/Speed Bump:\s*([^\n]+?)\s+challenged\s+([^\n!]+)!/);
  if (bump) {
    const [, fromTeam, toTeam] = bump;
    const challenge = (message.match(/Challenge:\s*([^\n]+)/)?.[1] || '').trim();
    applySpeedBump(toTeam.trim(), {
      by: fromTeam.trim(),
      challenge,
      startedAt: Date.now()
    });
    return;
  }

  // ------------------------------------------------------------
  // ✅ Speed Bump Cleared (Always use the official release logic)
  // Format: Speed Bump Cleared: TEAM_X (by Control)
  // ------------------------------------------------------------
  const clear = message.match(/Speed Bump Cleared:\s*([^(]+?)(?:\s|\(|$)/);
  if (clear) {
    const team = clear[1].trim();
    releaseSpeedBump(team, 'Broadcast');
    return;
  }

  // ------------------------------------------------------------
  // 📸 Proof Sent
  // Format: Proof Sent: TEAM|EXPIRES_AT|PROOF_AT
  // ------------------------------------------------------------
  const proof = message.match(/Proof Sent:\s*([^|]+)\|([0-9]+)\|([0-9]+)/);
  if (proof) {
    const [, team, expires, proofAt] = proof;
    applyProofSent(team.trim(), Number(expires), Number(proofAt));
    return;
  }
}