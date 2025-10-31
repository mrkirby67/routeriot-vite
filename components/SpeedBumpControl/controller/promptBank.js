// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SpeedBumpControl/controller/promptBank.js
// PURPOSE: === AI-CONTEXT-MAP ===
// DEPENDS_ON: ../../../modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../../modules/speedBumpChallenges.js
// USED_BY: components/SpeedBumpControl/speedBumpControlController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { db } from '../../../modules/config.js';
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDefaultPrompts, setSpeedBumpPromptBank } from '../../../modules/speedBumpChallenges.js';

const BANK_STORAGE_KEY = 'speedBumpBank';

export async function loadBank() {
  let bank = [];
  try {
    const snap = await getDoc(doc(db, 'game', 'speedBumpBank'));
    if (snap.exists()) bank = snap.data()?.list || [];
  } catch {}
  if (!bank.length) {
    try {
      const raw = localStorage.getItem(BANK_STORAGE_KEY);
      if (raw) bank = JSON.parse(raw);
    } catch {}
  }
  if (!bank.length) bank = getDefaultPrompts();
  bank = bank.filter(x => typeof x === 'string' && x.trim());
  setSpeedBumpPromptBank(bank);
  return bank;
}

export async function saveBankToFirestore(bank) {
  await setDoc(doc(db, 'game', 'speedBumpBank'), { list: bank, updatedAt: serverTimestamp() }, { merge: true });
}

export function saveBankLocal(bank) {
  localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(bank));
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SpeedBumpControl/controller/promptBank.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: loadBank, saveBankToFirestore, saveBankLocal
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
