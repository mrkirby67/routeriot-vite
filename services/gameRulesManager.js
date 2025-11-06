// === AICP SERVICE HEADER ===
// ============================================================================
// FILE: services/gameRulesManager.js
// PURPOSE: Persists game rule settings to Firestore and reloads them for control clients.
// DEPENDS_ON: ../modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js
// USED_BY: components/GameControls/GameControls.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP SERVICE HEADER ===

// ============================================================================
// PATCH: gameRulesManager.js — Persistent Game Rules
// ============================================================================

import { db } from '../modules/config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const rulesRef = doc(db, 'config', 'gameRules');

export async function saveRules(rules) {
  try {
    await setDoc(rulesRef, rules, { merge: true });
    console.info('✅ Rules saved successfully.');
  } catch (err) {
    console.error('❌ Failed to save rules:', err);
  }
}

export async function loadRules() {
  try {
    const snap = await getDoc(rulesRef);
    if (snap.exists()) {
      console.info('📜 Rules loaded successfully.');
      return snap.data();
    }
    console.warn('⚠️ No rules found. Returning empty defaults.');
    return {};
  } catch (err) {
    console.error('❌ Failed to load rules:', err);
    return {};
  }
}
