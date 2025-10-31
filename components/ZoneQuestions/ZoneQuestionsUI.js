// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneQuestions/ZoneQuestionsUI.js
// PURPOSE: 🧱 Component (UI)
// DEPENDS_ON: components/ZoneQuestions/ZoneQuestionsEditor.js, components/ZoneQuestions/ZoneQuestionsLogic.js, ../../modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js
// USED_BY: components/ZoneQuestions/ZoneQuestions.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

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
// 🧱 Component (UI)
// ============================================================================
export function ZoneQuestionsComponent() {
  return `
    <div class="${styles.controlSection}">
      <h2>Flat Tire — Tow Time</h2>
      <p>Schedule & manage tow assignments. Teams only see the tow location when a flat is triggered.</p>
      <div id="zone-questions-accordion" class="${styles.accordion}">
        <div class="${styles.loading}">⏳ Loading tow zones...</div>
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

  container.innerHTML = `<div class="${styles.loading}">⏳ Loading tow zones...</div>`;

  try {
    const zonesSnap = await getDocs(collection(db, 'zones'));
    if (zonesSnap.empty) {
      container.innerHTML = `<p style="color:#aaa;">No tow zones found in database.</p>`;
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
            <div class="${styles.loading}">⏳ Loading checkpoint tasks...</div>
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

        if (!isOpen) await loadZoneCheckpoints(zoneId);
      });
    });
  } catch (err) {
    console.error('❌ Error loading tow zones:', err);
    container.innerHTML = `<p style="color:red;">⚠️ Failed to load tow zones: ${err.message}</p>`;
  }
}

// ============================================================================
// 🧩 Load Checkpoints for Zone
// ============================================================================
async function loadZoneCheckpoints(zoneId) {
  const cont = document.getElementById(`zone-questions-${zoneId}`);
  if (!cont) return;
  cont.innerHTML = `<div class="${styles.loading}">⏳ Loading checkpoint tasks...</div>`;

  try {
    const qs = query(
      collection(db, 'questions'),
      where('zoneId', '==', zoneId),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(qs);
    const checkpoints = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 🕳️ If no tasks yet
    if (!checkpoints.length) {
      cont.innerHTML = `
        <p style="color:#999;">No tasks set for this tow zone yet.</p>
        <button class="${styles.addBtn} add-q" data-zone="${zoneId}">➕ Add Task</button>
      `;
      cont.querySelector('.add-q').addEventListener('click', () => {
        cont.innerHTML = renderZoneQuestionEditor(zoneId);
        initializeZoneQuestionEditor(zoneId);
      });
      return;
    }

    // 📋 Build tasks table
    cont.innerHTML = `
      <table class="${styles.dataTable}">
        <thead>
          <tr>
            <th>Type</th>
            <th>Task / Objective</th>
            <th>Proof or Answer</th>
            <th>Pts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${checkpoints.map(task => `
            <tr>
              <td>${task.type || '—'}</td>
              <td>${task.question || ''}</td>
              <td>${renderAnswerSummary(task)}</td>
              <td>${task.points ?? 0}</td>
              <td>
                <button class="${styles.smallBtn} edit-q" data-id="${task.id}" data-zone="${zoneId}">✏️ Edit</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button class="${styles.addBtn} add-q" data-zone="${zoneId}">➕ Add Task</button>
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
    console.error(`❌ Error loading tasks for ${zoneId}:`, err);
    cont.innerHTML = `<p style="color:red;">⚠️ Failed to load tasks: ${err.message}</p>`;
  }
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneQuestions/ZoneQuestionsUI.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: ZoneQuestionsComponent, initializeZoneQuestionsUI
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
