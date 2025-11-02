// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneManagement/zoneHandlers.js
// PURPOSE: 🔍 MANAGE BUTTON (toggle zone details)
// DEPENDS_ON: ../../modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../modules/scoreboardManager.js, ../../data.js
// USED_BY: components/ZoneManagement/ZoneManagement.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { db } from '../../modules/config.js';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { updateControlledZones } from '../../modules/scoreboardManager.js';
import { allTeams } from '../../data.js';
import { allowedQuestionTypes, questionTypeLabels } from '../ZoneQuestions/ZoneQuestionsTypes.js';

// ---------------------------------------------------------------------------
// 💾 SAVE QUESTIONS (for a specific zone)
// ---------------------------------------------------------------------------
async function saveZoneQuestions(zoneId) {
  if (!zoneId) return;

  const detailsRow = document.getElementById(`details-${zoneId}`);
  if (!detailsRow) return;

  const questionRows = detailsRow.querySelectorAll('tbody tr[data-question-id]');
  let savedCount = 0;

  for (const row of questionRows) {
    const questionId = row.dataset.questionId;
    const questionText = row.querySelector('[data-col="question"]')?.textContent.trim();
    const answerText = row.querySelector('[data-col="answer"]')?.textContent.trim();
    const type = row.querySelector('.question-type-select')?.value;

    // Skip blank new rows
    if (questionId.startsWith('new-') && !questionText && !answerText) {
      continue;
    }

    const finalQuestionId = questionId.startsWith('new-') ? doc(collection(db, 'zones', zoneId, 'questions')).id : questionId;

    const questionData = {
      question: questionText,
      answer: answerText,
      type: type,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'zones', zoneId, 'questions', finalQuestionId), questionData, { merge: true });
    savedCount++;
  }

  console.log(`💾 Saved ${savedCount} questions for zone ${zoneId}.`);
}


/* ---------------------------------------------------------------------------
 * 🔍 MANAGE BUTTON (toggle zone details and SAVE ON CLOSE)
 * ------------------------------------------------------------------------ */
async function onManageClick(zoneId, renderZones, tableBody, googleMapsApiLoaded) {
  const detailsRow = document.getElementById(`details-${zoneId}`);
  if (!detailsRow) return;

  const isVisible = detailsRow.style.display === 'table-row';

  // If we are about to close the view, save the questions first.
  if (isVisible) {
    await saveZoneQuestions(zoneId);
    await renderZones({ tableBody, googleMapsApiLoaded }); // Re-render to show fresh data
  }

  // Toggle visibility AFTER saving and re-rendering
  const newDetailsRow = document.getElementById(`details-${zoneId}`);
  if(newDetailsRow) {
    newDetailsRow.style.display = isVisible ? 'none' : 'table-row';
    const btn = document.querySelector(`.manage-zone-btn[data-zone-id="${zoneId}"]`);
    if (btn) btn.textContent = isVisible ? 'Manage' : '💾 Close';
  }
}

/* ---------------------------------------------------------------------------
 * 🔄 RESET ZONE → Available
 * ------------------------------------------------------------------------ */
async function onResetClick(zoneId, renderZones, tableBody, googleMapsApiLoaded) {
  if (!confirm(`Reset ${zoneId} to Available?`)) return;

  await setDoc(
    doc(db, 'zones', zoneId),
    {
      status: 'Available',
      controllingTeam: '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`🧹 Zone ${zoneId} reset to Available.`);

  const row = document.querySelector(`[data-zone-id="${zoneId}"]`);
  if (row) {
    row.style.background = '#2e7d32';
    setTimeout(() => (row.style.background = ''), 600);
  }

  await renderZones({ tableBody, googleMapsApiLoaded });
}

/* ---------------------------------------------------------------------------
 * ⚡ FORCE CAPTURE (Admin manually assigns a team)
 * ------------------------------------------------------------------------ */
async function onForceCapture(zoneId, renderZones, tableBody, googleMapsApiLoaded) {
  const teamInput = prompt('Enter team name to force capture:');
  if (!teamInput) return;

  // Normalize and match team name
  const teamObj = allTeams.find(t => t.name.toLowerCase() === teamInput.toLowerCase());
  const cleanName = teamObj ? teamObj.name : teamInput.trim();

  // Update Firestore zone ownership
  await setDoc(
    doc(db, 'zones', zoneId),
    {
      status: 'Taken',
      controllingTeam: cleanName,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Update scoreboard
  await updateControlledZones(cleanName, zoneId);

  // Notify communications log
  await addDoc(collection(db, 'communications'), {
    teamName: 'Game Master',
    sender: 'Game Master',
    senderDisplay: 'Game Master',
    message: `⚡ Admin forced ${cleanName} to capture ${zoneId}.`,
    timestamp: serverTimestamp(),
  });

  console.log(`⚡️ ${cleanName} manually captured ${zoneId}`);

  const row = document.querySelector(`[data-zone-id="${zoneId}"]`);
  if (row) {
    row.style.background = '#1565c0';
    setTimeout(() => (row.style.background = ''), 800);
  }

  await renderZones({ tableBody, googleMapsApiLoaded });
}

/* ---------------------------------------------------------------------------
 * ✏️ EDITABLE CELL SAVE (zone fields ONLY)
 * ------------------------------------------------------------------------ */
async function onEditableBlur(e) {
  const cell = e.target;
  if (!cell.isContentEditable) return;

  const zoneRow = cell.closest('tr[data-zone-id]');
  const zoneId = zoneRow?.dataset?.zoneId;
  if (!zoneId) return;

  // This function now ONLY handles the main zone fields (name, gps, diameter)
  const field = cell.dataset.field;
  if (field) {
    const value = cell.textContent.trim();
    await setDoc(
      doc(db, 'zones', zoneId),
      { [field]: value, updatedAt: serverTimestamp() },
      { merge: true }
    );

    cell.style.background = '#1b5e20';
    setTimeout(() => (cell.style.background = ''), 400);
  }
}

/* ---------------------------------------------------------------------------
 * ➕ ADD ZONE BUTTON
 * ------------------------------------------------------------------------ */
async function onAddZone(renderZones, tableBody, googleMapsApiLoaded) {
  const zonesCol = collection(db, 'zones');
  const snapshot = await getDocs(zonesCol);
  const ids = snapshot.docs.map(d => d.id);
  const nextNum = Math.max(
    ...ids.map(id => parseInt(id.replace(/[^\d]/g, ''), 10) || 0),
    0
  ) + 1;

  const newZoneId = `zone${nextNum}`;
  const newZone = {
    name: `Zone ${nextNum}`,
    gps: '',
    diameter: '0.05',
    status: 'Available',
    controllingTeam: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'zones', newZoneId), newZone);
  console.log(`✅ Added ${newZoneId}`);
  await renderZones({ tableBody, googleMapsApiLoaded });
}

/* ---------------------------------------------------------------------------
 * ➕ ADD QUESTION BUTTON
 * ------------------------------------------------------------------------ */
function onAddQuestionClick(e) {
    const zoneId = e.target.dataset.zoneId;
    if (!zoneId) return;

    const tableBody = document.querySelector(`.questions-table[data-zone-id="${zoneId}"] tbody`);
    if (!tableBody) return;

    const newId = `new-${Date.now()}`;
    const newRow = document.createElement('tr');
    newRow.dataset.questionId = newId;
    newRow.innerHTML = `
        <td contenteditable="true" data-col="question"></td>
        <td contenteditable="true" data-col="answer"></td>
        <td data-col="type">
            <select class="question-type-select">
                ${allowedQuestionTypes
                    .map(t => `<option value="${t}">${questionTypeLabels[t] || t}</option>`)
                    .join('')}
            </select>
        </td>
    `;
    tableBody.appendChild(newRow);
}

/* ---------------------------------------------------------------------------
 * 📡 ATTACH ALL HANDLERS
 * ------------------------------------------------------------------------ */
export function attachZoneHandlers({ tableBody, renderZones, googleMapsApiLoaded }) {
  if (!tableBody) return;

  // Row-level click handling
  tableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const zoneId = target?.dataset?.zoneId;

    if (target.classList.contains('manage-zone-btn')) {
      await onManageClick(zoneId, renderZones, tableBody, googleMapsApiLoaded);
      return;
    }
    if (target.classList.contains('reset-zone-btn')) {
      await onResetClick(zoneId, renderZones, tableBody, googleMapsApiLoaded);
      return;
    }
    if (target.classList.contains('force-capture-btn')) {
      await onForceCapture(zoneId, renderZones, tableBody, googleMapsApiLoaded);
      return;
    }
    if (target.classList.contains('add-question-btn')) {
        onAddQuestionClick(e);
        return;
    }
  });

  // Editable cell save (zone fields only)
  tableBody.addEventListener('blur', onEditableBlur, true);

  // Add Zone button
  const addBtn = document.getElementById('add-zone-btn');
  if (addBtn) addBtn.onclick = () => onAddZone(renderZones, tableBody, googleMapsApiLoaded);

  // Manual refresh button
  const refreshBtn = document.getElementById('refresh-zones-btn');
  if (refreshBtn) refreshBtn.onclick = () => renderZones({ tableBody, googleMapsApiLoaded });
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneManagement/zoneHandlers.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: default
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
