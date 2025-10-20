// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestionsEditor.js
// PURPOSE: Form for creating or editing questions for a specific zone.
// ============================================================================

import styles from './ZoneQuestions.module.css';
import { db } from '../../modules/config.js';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { allTeams } from '../../data.js';
import { validateQuestionBeforeSave, parseCsv } from './ZoneQuestionsLogic.js';
import { booleanSets } from './ZoneQuestionsTypes.js';

// ============================================================================
// 🧱 Render Form
// ============================================================================
export function renderZoneQuestionEditor(zoneId, editId = null) {
  return `
    <div class="${styles.editor}">
      <h3>${editId ? '✏️ Edit' : '➕ Add'} Question for ${zoneId}</h3>

      <div class="${styles.formRow}">
        <label>Question</label>
        <input id="q-text" type="text" placeholder="Type the question..." />
      </div>

      <div class="${styles.formRow}">
        <label>Type</label>
        <select id="q-type">
          <option value="YES_NO">YES/NO</option>
          <option value="TRUE_FALSE">TRUE/FALSE</option>
          <option value="UP_DOWN">UP/DOWN</option>
          <option value="NUMBER">NUMBER</option>
          <option value="MULTIPLE_CHOICE">MULTIPLE CHOICE</option>
          <option value="OPEN">OPEN</option>
          <option value="COMPLETE">COMPLETE (chat-trigger)</option>
        </select>
      </div>

      <div class="${styles.dynamicFields}" id="dynamic-fields"></div>

      <div class="${styles.formRow}">
        <label>Points</label>
        <input id="q-points" type="number" min="0" value="10" />
      </div>

      <div class="${styles.formRow}">
        <button id="q-save" class="${styles.saveBtn}">💾 Save</button>
        <button id="q-cancel" class="${styles.cancelBtn}">Cancel</button>
        <span id="q-status" class="${styles.status}"></span>
      </div>
    </div>
  `;
}

// ============================================================================
// 🚀 Initialize Editor
// ============================================================================
export async function initializeZoneQuestionEditor(zoneId, editId) {
  const els = {
    qText: document.getElementById('q-text'),
    type: document.getElementById('q-type'),
    dyn: document.getElementById('dynamic-fields'),
    points: document.getElementById('q-points'),
    save: document.getElementById('q-save'),
    cancel: document.getElementById('q-cancel'),
    status: document.getElementById('q-status'),
  };

  wireDynamicFields(els);

  // Load existing question if editing
  if (editId) {
    const snap = await getDoc(doc(db, 'questions', editId));
    if (snap.exists()) loadIntoForm(els, snap.data());
  }

  // Handle Save
  els.save.addEventListener('click', async () => {
    const data = readForm(els, zoneId);
    const err = validateQuestionBeforeSave(data);
    if (err) {
      els.status.textContent = `❌ ${err}`;
      return;
    }

    try {
      if (editId) {
        await setDoc(
          doc(db, 'questions', editId),
          { ...data, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } else {
        await addDoc(collection(db, 'questions'), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      els.status.textContent = '✅ Saved!';
      setTimeout(() => (els.status.textContent = ''), 2500);
    } catch (e) {
      console.error('❌ Save failed:', e);
      els.status.textContent = '⚠️ Error saving question.';
    }
  });

  // Handle Cancel
  els.cancel.addEventListener('click', () => {
    document.getElementById(`zone-questions-${zoneId}`).innerHTML =
      '<p>Reload to see questions.</p>';
  });
}

// ============================================================================
// ⚙️ Dynamic Fields (Based on Question Type)
// ============================================================================
function wireDynamicFields(els) {
  const makeHtml = (t) => {
    switch (t) {
      case 'YES_NO':
      case 'TRUE_FALSE':
      case 'UP_DOWN': {
        const opts = booleanSets[t] || [];
        return `
          <label>Correct Answer</label>
          <select id="q-correct">
            ${opts.map((o) => `<option>${o}</option>`).join('')}
          </select>`;
      }
      case 'NUMBER':
        return `
          <label>Correct Number</label>
          <input id="q-num" type="number" />
          <label>Tolerance (±)</label>
          <input id="q-tol" type="number" min="0" value="0" />`;
      case 'MULTIPLE_CHOICE':
        return `
          <div id="q-mc"></div>
          <button id="q-add-mc" type="button">➕ Add Choice</button>`;
      case 'OPEN':
        return `
          <label>Accepted Answers (comma-separated)</label>
          <input id="q-accept" type="text" />
          <label>Must Include (optional)</label>
          <input id="q-inc" type="text" />`;
      case 'COMPLETE':
        return `
          <label>Trigger Phrase</label>
          <input id="q-trig" type="text" placeholder="emoji or keyword" />
          <label>Assigned Team</label>
          <select id="q-team">
            ${allTeams.map((t) => `<option>${t.name}</option>`).join('')}
          </select>
          <label><input id="q-auto" type="checkbox" checked /> Auto award points</label>`;
      default:
        return '';
    }
  };

  const update = () => {
    els.dyn.innerHTML = makeHtml(els.type.value);
    if (els.type.value === 'MULTIPLE_CHOICE') {
      const div = document.getElementById('q-mc');
      const addBtn = document.getElementById('q-add-mc');
      addBtn.addEventListener('click', () => {
        const idx = div.children.length + 1;
        div.insertAdjacentHTML(
          'beforeend',
          `<div>
            <input type="radio" name="correct" />
            <input type="text" placeholder="Choice ${idx}" />
          </div>`
        );
      });
    }
  };

  els.type.addEventListener('change', update);
  update();
}

// ============================================================================
// 🧩 Read Form Data
// ============================================================================
function readForm(els, zoneId) {
  const type = els.type.value;
  const base = {
    zoneId,
    type,
    question: els.qText.value.trim(),
    points: Number(els.points.value) || 0,
  };

  switch (type) {
    case 'YES_NO':
    case 'TRUE_FALSE':
    case 'UP_DOWN':
      base.booleanCorrect = document.getElementById('q-correct')?.value || '';
      break;
    case 'NUMBER':
      base.numberCorrect = Number(document.getElementById('q-num')?.value);
      base.numberTolerance = Number(document.getElementById('q-tol')?.value) || 0;
      break;
    case 'MULTIPLE_CHOICE': {
      const div = document.getElementById('q-mc');
      const rows = [...div.children];
      base.mcOptions = rows
        .map((r) => {
          const [radio, input] = r.querySelectorAll('input');
          return { text: input.value.trim(), correct: radio.checked };
        })
        .filter((r) => r.text);
      break;
    }
    case 'OPEN':
      base.openAccepted = parseCsv(document.getElementById('q-accept')?.value);
      base.openInclude = parseCsv(document.getElementById('q-inc')?.value);
      break;
    case 'COMPLETE':
      base.proofType = 'chat';
      base.triggerPhrase = document.getElementById('q-trig')?.value.trim();
      base.assignedTeam = document.getElementById('q-team')?.value;
      base.autoAward = document.getElementById('q-auto')?.checked || false;
      break;
  }

  return base;
}

// ============================================================================
// 🧱 Load Existing Data (Edit Mode)
// ============================================================================
function loadIntoForm(els, d) {
  document.getElementById('q-text').value = d.question || '';
  document.getElementById('q-type').value = d.type || 'YES_NO';
  document.getElementById('q-points').value = d.points ?? 10;
}