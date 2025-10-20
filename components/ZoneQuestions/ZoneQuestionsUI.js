// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestionsUI.js
// PURPOSE: Control page accordion that lists zones and loads their unique questions.
// Integrates with ZoneQuestionsEditor.js for editing individual questions.
// ============================================================================
import styles from './ZoneQuestions.module.css';
import { renderZoneQuestionEditor, initializeZoneQuestionEditor } from './ZoneQuestionsEditor.js';
import { renderAnswerSummary } from './ZoneQuestionsLogic.js';
import { db } from '../../modules/config.js';
import {
  collection,
  getDocs,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================================
// 🧱 Component
// ============================================================================
export function ZoneQuestionsComponent() {
  return `
    <div class="${styles.controlSection}">
      <h2>🗺️ Unique Zone Questions</h2>
      <p>Click a zone below to expand and edit its unique questions.</p>
      <div id="zone-questions-accordion" class="${styles.accordion}">
        <div class="${styles.loading}">⏳ Loading zones...</div>
      </div>
    </div>
  `;
}

// ============================================================================
// 🚀 Initialize Accordion
// ============================================================================
export async function initializeZoneQuestionsUI() {
  const container = document.getElementById('zone-questions-accordion');
  if (!container) return;

  container.innerHTML = `<div class="${styles.loading}">⏳ Loading zones...</div>`;

  try {
    const zonesSnap = await getDocs(collection(db, 'zones'));
    if (zonesSnap.empty) {
      container.innerHTML = `<p style="color:#aaa;">No zones found in database.</p>`;
      return;
    }

    container.innerHTML = '';

    zonesSnap.forEach(docSnap => {
      const zone = docSnap.data();
      const zoneId = docSnap.id;

      const wrapper = document.createElement('div');
      wrapper.className = styles.zonePanel;
      wrapper.innerHTML = `
        <div class="${styles.zoneHeader}" data-zone="${zoneId}">
          <strong>${zone.name || 'Unnamed Zone'}</strong>
          <span class="${styles.zoneId}">${zoneId}</span>
          <button class="${styles.expandBtn}" data-zone="${zoneId}">Expand ▼</button>
        </div>
        <div class="${styles.zoneBody}" id="zone-body-${zoneId}" style="display:none;">
          <div class="${styles.questionsContainer}" id="zone-questions-${zoneId}">
            <div class="${styles.loading}">⏳ Loading questions...</div>
          </div>
        </div>
      `;
      container.appendChild(wrapper);
    });

    // 🔹 Expand / collapse handlers
    container.querySelectorAll(`.${styles.expandBtn}`).forEach(btn => {
      btn.addEventListener('click', async () => {
        const zoneId = btn.dataset.zone;
        const body = document.getElementById(`zone-body-${zoneId}`);
        const isOpen = body.style.display === 'block';
        body.style.display = isOpen ? 'none' : 'block';
        btn.textContent = isOpen ? 'Expand ▼' : 'Collapse ▲';

        if (!isOpen) await loadZoneQuestions(zoneId);
      });
    });
  } catch (err) {
    console.error('❌ Error loading zones:', err);
    container.innerHTML = `<p style="color:red;">⚠️ Failed to load zones: ${err.message}</p>`;
  }
}

// ============================================================================
// 🧩 Load Questions for Zone
// ============================================================================
async function loadZoneQuestions(zoneId) {
  const cont = document.getElementById(`zone-questions-${zoneId}`);
  if (!cont) return;
  cont.innerHTML = `<div class="${styles.loading}">⏳ Loading questions...</div>`;

  try {
    const qs = query(
      collection(db, 'questions'),
      where('zoneId', '==', zoneId),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(qs);
    const questions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 🕳️ If no questions yet
    if (!questions.length) {
      cont.innerHTML = `
        <p style="color:#999;">No questions for this zone yet.</p>
        <button class="${styles.addBtn} add-q" data-zone="${zoneId}">➕ Add Question</button>
      `;
      cont.querySelector('.add-q').addEventListener('click', () => {
        cont.innerHTML = renderZoneQuestionEditor(zoneId);
        initializeZoneQuestionEditor(zoneId);
      });
      return;
    }

    // 📋 Build questions table
    cont.innerHTML = `
      <table class="${styles.dataTable}">
        <thead>
          <tr>
            <th>Type</th>
            <th>Question</th>
            <th>Answer</th>
            <th>Pts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${questions.map(q => `
            <tr>
              <td>${q.type || '—'}</td>
              <td>${q.question || ''}</td>
              <td>${renderAnswerSummary(q)}</td>
              <td>${q.points ?? 0}</td>
              <td>
                <button class="${styles.smallBtn} edit-q" data-id="${q.id}" data-zone="${zoneId}">✏️ Edit</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button class="${styles.addBtn} add-q" data-zone="${zoneId}">➕ Add Question</button>
    `;

    // 🔹 Add & Edit wiring
    cont.querySelectorAll('.add-q').forEach(btn => {
      btn.addEventListener('click', () => {
        cont.innerHTML = renderZoneQuestionEditor(zoneId);
        initializeZoneQuestionEditor(zoneId);
      });
    });

    cont.querySelectorAll('.edit-q').forEach(btn => {
      btn.addEventListener('click', () => {
        cont.innerHTML = renderZoneQuestionEditor(zoneId, btn.dataset.id);
        initializeZoneQuestionEditor(zoneId, btn.dataset.id);
      });
    });
  } catch (err) {
    console.error(`❌ Error loading questions for ${zoneId}:`, err);
    cont.innerHTML = `<p style="color:red;">⚠️ Failed to load questions: ${err.message}</p>`;
  }
}