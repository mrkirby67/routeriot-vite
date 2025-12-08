// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestionsEditor.js
// PURPOSE: 🧱 Render Form
// DEPENDS_ON: /core/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../data.js, components/ZoneQuestions/ZoneQuestionsLogic.js, components/ZoneQuestions/ZoneQuestionsTypes.js
// USED_BY: components/ZoneQuestions/ZoneQuestionsUI.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import styles from './ZoneQuestions.module.css';
import { db } from '/core/config.js';
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

const BASE_QUESTION_TYPES = [
  { value: 'YES_NO', label: 'YES/NO' },
  { value: 'TRUE_FALSE', label: 'TRUE/FALSE' },
  { value: 'MULTIPLE_CHOICE', label: 'MULTIPLE CHOICE' },
  { value: 'NUMBER', label: 'NUMBER' },
  { value: 'OPEN', label: 'OPEN (text answer)' },
];

const LEGACY_QUESTION_TYPES = [
  { value: 'UP_DOWN', label: 'UP/DOWN (legacy)' },
  { value: 'COMPLETE', label: 'COMPLETE (chat-trigger)' }
];

function buildTypeOptions(currentType) {
  const options = [...BASE_QUESTION_TYPES];
  const legacy = LEGACY_QUESTION_TYPES.find(t => t.value === currentType);
  if (legacy && !options.some(o => o.value === legacy.value)) {
    options.push(legacy);
  }
  return options;
}

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
          <label>Choices</label>
          <div id="q-mc"></div>
          <button id="q-add-mc" type="button">➕ Add Choice</button>
          <small class="${styles.help}">Mark exactly one as correct.</small>`;

      case 'OPEN':
        return `
          <label>Accepted Answers (comma-separated)</label>
          <input id="q-accept" type="text" placeholder="e.g. Paris, City of Light" />
          <label>Must Include (optional)</label>
          <input id="q-inc" type="text" placeholder="e.g. France" />`;

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

    // Handle dynamic MC options
    if (els.type.value === 'MULTIPLE_CHOICE') {
      const div = document.getElementById('q-mc');
      const addBtn = document.getElementById('q-add-mc');
      addBtn.addEventListener('click', () => {
        const idx = div.children.length + 1;
        div.insertAdjacentHTML(
          'beforeend',
          `<div class="${styles.mcRow}">
            <input type="radio" name="mc-correct" />
            <input type="text" placeholder="Choice ${idx}" />
          </div>`
        );
      });
    }
  };

  els.type.addEventListener('change', update);
  // Populate type options dynamically to include legacy if needed
  const opts = buildTypeOptions(els.type.value || 'YES_NO');
  els.type.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  if (!els.type.value) {
    els.type.value = 'YES_NO';
  }
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
      const options = rows
        .map((r) => {
          const [radio, input] = r.querySelectorAll('input');
          return { text: input.value.trim(), correct: radio.checked };
        })
        .filter((r) => r.text);
      base.mcOptions = options;
      // Store the correct answer explicitly for player-side validation
      base.answer = options.find((o) => o.correct)?.text || options[0]?.text || '';
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
  const opts = buildTypeOptions(d.type || 'YES_NO');
  els.type.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  document.getElementById('q-type').value = d.type || 'YES_NO';
  document.getElementById('q-points').value = d.points ?? 10;
  els.type.dispatchEvent(new Event('change')); // refresh dynamic fields
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneQuestions/ZoneQuestionsEditor.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: renderZoneQuestionEditor, initializeZoneQuestionEditor
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
