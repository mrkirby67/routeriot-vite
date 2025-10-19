// ============================================================================
// File: components/ZoneManagement/ZoneManagement.js
// ============================================================================
import { db, firebaseConfig } from '../../modules/config.js'; // Corrected import
import {
  onSnapshot, collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './ZoneManagement.module.css';

/* ---------------------------------------------------------------------------
 * MARKUP COMPONENT
 * ------------------------------------------------------------------------ */
export function ZoneManagementComponent() {
  const controlSection = styles?.controlSection || '';
  const dataTable = styles?.dataTable || '';
  const cooldownSetup = styles?.cooldownSetup || '';

  return `
    <div class="${controlSection}">
      <h2>Zone Management</h2>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <button id="add-zone-btn"
          style="background:#00897B;color:white;padding:8px 16px;
                 border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
          ➕ Add Zone
        </button>

        <button id="refresh-zones-btn"
          style="background:#3949AB;color:white;padding:8px 16px;
                 border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
          🔄 Refresh
        </button>
      </div>

      <div id="zone-status-banner"
        style="padding:10px;margin-bottom:10px;border-radius:6px;text-align:center;
               background:#333;color:#bbb;font-weight:bold;display:none;">
      </div>

      <div class="${cooldownSetup}">
        <label for="cooldown-time">Capture Cooldown:</label>
        <select id="cooldown-time">
          <option value="15">15 minutes</option>
          <option value="20">20 minutes</option>
          <option value="25">25 minutes</option>
          <option value="30" selected>30 minutes</option>
          <option value="45">45 minutes</option>
        </select>
      </div>

      <table class="${dataTable}" id="zones-table">
        <thead>
          <tr>
            <th>Zone (ID)</th>
            <th>Name (Editable)</th>
            <th>GPS (Lat,Lng)</th>
            <th>Diameter (km)</th>
            <th>Action</th>
            <th>Status / Team</th>
          </tr>
        </thead>
        <tbody id="zones-table-body"></tbody>
      </table>
    </div>
  `;
}

/* ---------------------------------------------------------------------------
 * INITIALIZATION
 * ------------------------------------------------------------------------ */
export function initializeZoneManagementLogic(googleMapsApiLoaded) {
  const tableBody = document.getElementById('zones-table-body');
  const banner = document.getElementById('zone-status-banner');
  if (!tableBody) return;

  const zonesCollection = collection(db, "zones");

  /* ---------------- Mini Static Map ---------------- */
  function generateMiniMap(zoneData) {
    if (!firebaseConfig.apiKey) {
      return `<div style="width:600px;height:200px;background:#5d1c1c;color:white;
                display:flex;align-items:center;justify-content:center;border-radius:8px;font-weight:bold;">
                ❌ Missing Google Maps API Key
              </div>`;
    }

    if (!googleMapsApiLoaded) {
      return `<div style="width:600px;height:200px;background:#222;display:flex;
                align-items:center;justify-content:center;border-radius:8px;">
                Waiting for Google Maps...
              </div>`;
    }

    const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
    if (!zoneData?.gps || !gpsRegex.test(zoneData.gps)) {
      return `<div style="background:#222;width:600px;height:200px;display:flex;align-items:center;justify-content:center;border-radius:8px;">Invalid GPS</div>`;
    }

    const [lat, lng] = zoneData.gps.split(',').map(Number);
    const diameterKm = parseFloat(zoneData.diameter) || 0.05;
    const safeDiameter = Math.max(diameterKm, 0.001);
    const zoom = Math.max(3, Math.min(21, Math.round(16 - Math.log2(safeDiameter))));
    const mapUrl =
      `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
      `&zoom=${zoom}&size=600x200&maptype=satellite` +
      `&markers=color:red%7C${lat},${lng}&key=${firebaseConfig.apiKey}`;
    return `<img src="${mapUrl}" alt="Map preview of ${zoneData.name}" style="border-radius:8px;">`;
  }

  /* ---------------- Game State Banner ---------------- */
  onSnapshot(doc(db, "game", "gameState"), (gameSnap) => {
    const data = gameSnap.data() || {};
    const locked = !(data.status === 'active' && data.zonesReleased);
    if (locked) {
      banner.style.display = 'block';
      banner.textContent = '🔒 Zones Locked — Waiting for Game Start';
      tableBody.parentElement.style.opacity = 0.5;
    } else {
      banner.style.display = 'none';
      tableBody.parentElement.style.opacity = 1;
    }
  });

  /* ---------------- Live Zone Table ---------------- */
  async function renderZones() {
    const zoneDocs = await getDocs(zonesCollection);
    tableBody.innerHTML = '';

    for (const zoneDoc of zoneDocs.docs) {
      const zoneId = zoneDoc.id;
      const zoneData = zoneDoc.data();

      const [questionsSnapshot, statusDoc] = await Promise.all([
        getDocs(collection(db, "zones", zoneId, "questions")),
        getDoc(doc(db, "teamStatus", zoneData.controllingTeam || "none"))
      ]);

      const questions = {};
      questionsSnapshot.forEach(q => (questions[q.id] = q.data()));

      const dataRow = document.createElement('tr');
      dataRow.dataset.zoneId = zoneId;
      const controlling = zoneData.controllingTeam || "None";

      dataRow.innerHTML = `
        <td>${zoneData.name || zoneId}<br><span style="font-size:0.8em;color:#888;">(${zoneId})</span></td>
        <td contenteditable="true" data-field="name">${zoneData.name || ''}</td>
        <td contenteditable="true" data-field="gps">${zoneData.gps || ''}</td>
        <td contenteditable="true" data-field="diameter">${zoneData.diameter || '0.05'}</td>
        <td>
          <button class="manage-zone-btn" data-zone-id="${zoneId}">Manage</button>
          <button class="reset-zone-btn" data-zone-id="${zoneId}" style="background:#B71C1C;color:white;margin-left:6px;">Reset</button>
          <button class="force-capture-btn" data-zone-id="${zoneId}" style="background:#2E7D32;color:white;margin-left:6px;">Force Capture</button>
        </td>
        <td>${zoneData.status || 'Available'}<br><small style="color:#8bc34a;">${controlling}</small></td>
      `;

      const detailsRow = document.createElement('tr');
      detailsRow.id = `details-${zoneId}`;
      detailsRow.style.display = 'none';
      detailsRow.innerHTML = `
        <td colspan="6" style="background:#2c2c2c;padding:20px;">
          <div class="map-container">${generateMiniMap(zoneData)}</div>
          <div class="zone-questions-container" style="margin-top:20px;">
            <h4>Zone Questions (${Object.keys(questions).length})</h4>
            <table class="data-table questions-table" data-zone-id="${zoneId}">
              <thead><tr><th>Question</th><th>Answer</th><th>Type</th></tr></thead>
              <tbody>
                ${[1,2,3,4,5,6,7].map(qNum => `
                  <tr data-question-id="unique${qNum}">
                    <td contenteditable="true">${(questions[`unique${qNum}`] || {}).question || ''}</td>
                    <td contenteditable="true">${(questions[`unique${qNum}`] || {}).answer || ''}</td>
                    <td contenteditable="true">${(questions[`unique${qNum}`] || {}).type || ''}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </td>
      `;

      tableBody.appendChild(dataRow);
      tableBody.appendChild(detailsRow);
    }
  }

  renderZones();
  document.getElementById('refresh-zones-btn').onclick = renderZones;

  /* ---------------- Row Click Handlers ---------------- */
  tableBody.addEventListener('click', async (e) => {
    const zoneId = e.target.dataset.zoneId;
    if (!zoneId) return;

    if (e.target.classList.contains('manage-zone-btn')) {
      const detailsRow = document.getElementById(`details-${zoneId}`);
      const visible = detailsRow.style.display !== 'none';
      detailsRow.style.display = visible ? 'none' : 'table-row';
      e.target.textContent = visible ? 'Manage' : 'Close';
      return;
    }

    if (e.target.classList.contains('reset-zone-btn')) {
      if (!confirm(`Reset ${zoneId} to Available?`)) return;
      await setDoc(doc(db, "zones", zoneId), { status: 'Available', controllingTeam: '' }, { merge: true });
      alert(`✅ ${zoneId} reset.`);
      renderZones();
      return;
    }

    if (e.target.classList.contains('force-capture-btn')) {
      const team = prompt('Enter team name to force capture:');
      if (!team) return;
      await setDoc(doc(db, "zones", zoneId), { status: 'Taken', controllingTeam: team }, { merge: true });
      await addDoc(collection(db, "communications"), {
        teamName: team,
        message: `⚡️ Admin forced ${team} to capture ${zoneId}`,
        timestamp: new Date()
      });
      alert(`⚡️ ${team} captured ${zoneId}.`);
      renderZones();
      return;
    }
  });

  /* ---------------- Editable Cell Save ---------------- */
  tableBody.addEventListener('blur', async (e) => {
    const cell = e.target;
    if (!cell.isContentEditable) return;

    const zoneRow = cell.closest('tr');
    const zoneId = zoneRow.dataset.zoneId;
    if (!zoneId) return;

    const field = cell.dataset.field;
    const value = cell.textContent.trim();

    if (field) {
      await setDoc(doc(db, "zones", zoneId), { [field]: value }, { merge: true });
    } else if (cell.closest('.questions-table')) {
      const row = cell.closest('tr');
      const questionId = row.dataset.questionId;
      const table = cell.closest('table');
      const zone = table.dataset.zoneId;
      const columns = ['question', 'answer', 'type'];
      const colName = columns[cell.cellIndex];
      await setDoc(doc(db, "zones", zone, "questions", questionId), { [colName]: value }, { merge: true });
    }

    cell.style.background = '#1b5e20';
    setTimeout(() => (cell.style.background = ''), 400);
  }, true);

  /* ---------------- Add Zone ---------------- */
  document.getElementById('add-zone-btn').onclick = async () => {
    const snapshot = await getDocs(zonesCollection);
    const ids = snapshot.docs.map(d => d.id);
    const nextNum = Math.max(...ids.map(id => parseInt(id.replace('zone', ''), 10) || 0)) + 1;
    const newZoneId = `zone${nextNum}`;
    const newZone = { name: `Zone ${nextNum}`, gps: '', diameter: '0.05', status: 'Available' };
    await setDoc(doc(db, "zones", newZoneId), newZone);
    alert(`✅ Added ${newZoneId}`);
    renderZones();
  };
}

