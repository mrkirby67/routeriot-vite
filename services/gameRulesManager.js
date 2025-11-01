// ============================================================================
// FILE: /*file_path*/
// PURPOSE: /*short_description*/
// DEPENDS_ON: /*dependencies*/
// USED_BY: /*consumers*/
// AUTHOR: James Kirby / Route Riot Project
// CREATED: /*date*/
// AICP_VERSION: 1.0
// ============================================================================

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
// === AICP-METADATA === (sanitized)
// aicp_category: sanitized placeholder
// exports: sanitized placeholder
// linked_files: sanitized placeholder
// status: sanitized placeholder
// ai_origin:
//   primary: sanitized placeholder
//   secondary: sanitized placeholder
// sync_state: sanitized placeholder
// === END ===
// // // // // // # === AI-CONTEXT-MAP === (commented out) (commented out) (commented out) (commented out) (commented out) (commented out)
// phase: // /*// /*// /*// /*// /*// /*{{phase}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// aicp_category: // /*// /*// /*// /*// /*// /*{{category}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// exports: // /*// /*// /*// /*// /*// /*{{exports}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// linked_files: // /*// /*// /*// /*// /*// /*{{linked_files}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// status: // /*// /*// /*// /*// /*// /*{{status}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// ai_origin:
// sanitized metadata line
//   secondary: // /*// /*// /*// /*// /*// /*{{secondary_ai}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// sync_state: // /*// /*// /*// /*// /*// /*{{sync_state}}*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)*/ (commented out)
// // // // // // # === END === (commented out) (commented out) (commented out) (commented out) (commented out) (commented out)
