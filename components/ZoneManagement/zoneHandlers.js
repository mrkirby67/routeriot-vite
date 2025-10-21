// ============================================================================
// FILE: components/ZoneManagement/zoneHandlers.js
// PURPOSE: All event handlers for Zone Management (clicks, edits, add zone).
// No rendering here — only DOM events + Firestore writes.
// ============================================================================
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

/* ---------------------------------------------------------------------------
 * 🔍 MANAGE BUTTON (toggle zone details)
 * ------------------------------------------------------------------------ */
async function onManageClick(zoneId) {
  const detailsRow = document.getElementById(`details-${zoneId}`);
  if (!detailsRow) return;
  const isVisible = detailsRow.style.display === 'table-row';
  detailsRow.style.display = isVisible ? 'none' : 'table-row';

  const btn = document.querySelector(`.manage-zone-btn[data-zone-id="${zoneId}"]`);
  if (btn) btn.textContent = isVisible ? 'Manage' : 'Close';
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
 * ✏️ EDITABLE CELL SAVE (zone fields + questions)
 * ------------------------------------------------------------------------ */
async function onEditableBlur(e) {
  const cell = e.target;
  if (!cell.isContentEditable) return;

  const zoneRow = cell.closest('tr');
  const zoneId = zoneRow?.dataset?.zoneId;
  if (!zoneId) return;

  // --- Zone Main Fields ---
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
    return;
  }

  // --- Question Table Fields ---
  const qTable = cell.closest('.questions-table');
  if (qTable) {
    const row = cell.closest('tr');
    const questionId = row?.dataset?.questionId;
    const zone = qTable.dataset.zoneId;
    if (!questionId || !zone) return;

    const columns = ['question', 'answer', 'type'];
    const colName = columns[cell.cellIndex] || 'question';
    const value = cell.textContent.trim();

    await setDoc(
      doc(db, 'zones', zone, 'questions', questionId),
      { [colName]: value, updatedAt: serverTimestamp() },
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
 * 📡 ATTACH ALL HANDLERS
 * ------------------------------------------------------------------------ */
export function attachZoneHandlers({ tableBody, renderZones, googleMapsApiLoaded }) {
  if (!tableBody) return;

  // Row-level click handling
  tableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const zoneId = target?.dataset?.zoneId;

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

  // Editable cell save (zone fields + questions)
  tableBody.addEventListener('blur', onEditableBlur, true);

  // Add Zone button
  const addBtn = document.getElementById('add-zone-btn');
  if (addBtn) addBtn.onclick = () => onAddZone(renderZones, tableBody, googleMapsApiLoaded);

  // Manual refresh button
  const refreshBtn = document.getElementById('refresh-zones-btn');
  if (refreshBtn) refreshBtn.onclick = () => renderZones({ tableBody, googleMapsApiLoaded });
}
