// ============================================================================
// PROMPT BANK – Firestore sync + local persistence
// ============================================================================
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