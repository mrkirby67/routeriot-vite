// ============================================================================
// File: components/ZoneManagement/zoneHandlers.js
// Purpose: All event handlers for Zone Management (clicks, edits, add zone).
// No rendering here—only DOM events + Firestore writes.
// ============================================================================

import { db } from '../../modules/config.js';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------------------------------
 * Click Handlers (Manage / Reset / Force Capture)
 * ------------------------------------------------------------------------ */
async function onManageClick(zoneId) {
  const detailsRow = document.getElementById(`details-${zoneId}`);
  if (!detailsRow) return;
  const visible = detailsRow.style.display !== 'none';
  detailsRow.style.display = visible ? 'none' : 'table-row';

  // Toggle button label
  const btn = document.querySelector(`.manage-zone-btn[data-zone-id="${zoneId}"]`);
  if (btn) btn.textContent = visible ? 'Manage' : 'Close';
}

async function onResetClick(zoneId, renderZones, tableBody, googleMapsApiLoaded) {
  if (!confirm(`Reset ${zoneId} to Available?`)) return;
  await setDoc(doc(db, "zones", zoneId), { status: 'Available', controllingTeam: '' }, { merge: true });
  alert(`✅ ${zoneId} reset.`);
  await renderZones({ tableBody, googleMapsApiLoaded });
}

async function onForceCapture(zoneId, renderZones, tableBody, googleMapsApiLoaded) {
  const team = prompt('Enter team name to force capture:');
  if (!team) return;
  await setDoc(doc(db, "zones", zoneId), { status: 'Taken', controllingTeam: team }, { merge: true });
  await addDoc(collection(db, "communications"), {
    teamName: team,
    message: `⚡️ Admin forced ${team} to capture ${zoneId}`,
    timestamp: new Date()
  });
  alert(`⚡️ ${team} captured ${zoneId}.`);
  await renderZones({ tableBody, googleMapsApiLoaded });
}

/* ---------------------------------------------------------------------------
 * Editable Cell Save (zone fields + questions)
 * ------------------------------------------------------------------------ */
async function onEditableBlur(e) {
  const cell = e.target;
  if (!cell.isContentEditable) return;

  const zoneRow = cell.closest('tr');
  if (!zoneRow) return;
  const zoneId = zoneRow.dataset.zoneId || zoneRow.closest('tbody')?.querySelector('tr[data-zone-id]')?.dataset.zoneId;
  if (!zoneId) return;

  // Zone main fields
  const field = cell.dataset.field;
  if (field) {
    const value = cell.textContent.trim();
    await setDoc(doc(db, "zones", zoneId), { [field]: value }, { merge: true });
    cell.style.background = '#1b5e20';
    setTimeout(() => (cell.style.background = ''), 400);
    return;
  }

  // Questions table cells
  const qTable = cell.closest('.questions-table');
  if (qTable) {
    const row = cell.closest('tr');
    const questionId = row?.dataset?.questionId;
    const zone = qTable.dataset.zoneId;
    if (!questionId || !zone) return;

    const columns = ['question', 'answer', 'type'];
    const colName = columns[cell.cellIndex] || 'question';
    const value = cell.textContent.trim();
    await setDoc(doc(db, "zones", zone, "questions", questionId), { [colName]: value }, { merge: true });

    cell.style.background = '#1b5e20';
    setTimeout(() => (cell.style.background = ''), 400);
  }
}

/* ---------------------------------------------------------------------------
 * Add Zone Button
 * ------------------------------------------------------------------------ */
async function onAddZone(renderZones, tableBody, googleMapsApiLoaded) {
  const zonesCol = collection(db, "zones");
  const snapshot = await getDocs(zonesCol);
  const ids = snapshot.docs.map(d => d.id);
  const nextNum = Math.max(...ids.map(id => parseInt(id.replace('zone', ''), 10) || 0), 0) + 1;

  const newZoneId = `zone${nextNum}`;
  const newZone = {
    name: `Zone ${nextNum}`,
    gps: '',
    diameter: '0.05',
    status: 'Available',
    controllingTeam: ''
  };

  await setDoc(doc(db, "zones", newZoneId), newZone);
  alert(`✅ Added ${newZoneId}`);
  await renderZones({ tableBody, googleMapsApiLoaded });
}

/* ---------------------------------------------------------------------------
 * Public: attachZoneHandlers
 * - Wires tableBody + buttons with the logic above.
 * - Expects a renderZones callback so we can refresh after writes.
// ------------------------------------------------------------------------ */
export function attachZoneHandlers({ tableBody, renderZones, googleMapsApiLoaded }) {
  if (!tableBody) return;

  // Row-level click handling
  tableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const zoneId = target?.dataset?.zoneId;
    if (!zoneId && !target.classList.contains('manage-zone-btn')) return;

    if (target.classList.contains('manage-zone-btn')) {
      await onManageClick(zoneId);
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
  });

  // Editable cell save (zone fields + questions cells)
  tableBody.addEventListener('blur', onEditableBlur, true);

  // Add Zone button
  const addBtn = document.getElementById('add-zone-btn');
  if (addBtn) {
    addBtn.onclick = () => onAddZone(renderZones, tableBody, googleMapsApiLoaded);
  }

  // Manual refresh button (optional)
  const refreshBtn = document.getElementById('refresh-zones-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => renderZones({ tableBody, googleMapsApiLoaded });
  }
}