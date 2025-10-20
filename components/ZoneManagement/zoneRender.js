// ============================================================================
// FILE: components/ZoneManagement/zoneRender.js
// PURPOSE: Pure rendering for the Zone Management table (no event listeners).
// Depends only on Firestore reads and firebaseConfig for Static Maps.
// ============================================================================
import { db, firebaseConfig } from '../../modules/config.js';
import {
  collection,
  getDocs,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { allTeams } from '../../data.js';
import { allowedQuestionTypes, questionTypeLabels } from '../ZoneQuestions/ZoneQuestionsTypes.js';

/* ---------------------------------------------------------------------------
 * 🔍 Helper: Dynamic Zoom from Diameter
 * ------------------------------------------------------------------------ */
function calculateZoomFromDiameter(diameterKm) {
  const safe = Math.max(parseFloat(diameterKm) || 0.05, 0.001);
  // Rough heuristic; higher diameter → lower zoom
  return Math.max(3, Math.min(21, Math.round(16 - Math.log2(safe))));
}

/* ---------------------------------------------------------------------------
 * 🗺️ Helper: Mini Static Map Preview
 * ------------------------------------------------------------------------ */
function miniMapHtml(zoneData, googleMapsApiLoaded) {
  if (!firebaseConfig?.apiKey) {
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
    return `<div style="background:#222;width:600px;height:200px;display:flex;
              align-items:center;justify-content:center;border-radius:8px;">
              Invalid GPS
            </div>`;
  }

  const [lat, lng] = zoneData.gps.split(',').map(Number);
  const zoom = calculateZoomFromDiameter(zoneData.diameter);
  const mapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=${zoom}&size=600x200&maptype=satellite` +
    `&markers=color:red%7C${lat},${lng}&key=${firebaseConfig.apiKey}`;

  return `<img src="${mapUrl}" alt="Map preview of ${zoneData.name}" style="border-radius:8px;">`;
}

/* ---------------------------------------------------------------------------
 * 📋 Public: renderZones
 * - Builds each data row (zone summary) + details row (editable fields)
 * - Includes controllingTeam, status, last update time
 * ------------------------------------------------------------------------ */
export async function renderZones({ tableBody, googleMapsApiLoaded }) {
  const zonesCol = collection(db, 'zones');
  const zoneDocs = await getDocs(zonesCol);
  tableBody.innerHTML = '';

  for (const zoneDoc of zoneDocs.docs) {
    const zoneId = zoneDoc.id;
    const zoneData = zoneDoc.data();

    // 🔢 Load questions for this zone
    const questionsSnap = await getDocs(collection(db, 'zones', zoneId, 'questions'));
    const questionsCount = questionsSnap.size;

    // 🧭 Normalize controlling team
    const controllingTeam =
      allTeams.find(t => t.name === zoneData.controllingTeam)?.name ||
      zoneData.controllingTeam ||
      '—';

    // 🕓 Format timestamp
    const lastUpdated = zoneData.updatedAt?.toDate
      ? zoneData.updatedAt.toDate().toLocaleString()
      : '—';

    // 🎨 Data row
    const dataRow = document.createElement('tr');
    dataRow.dataset.zoneId = zoneId;
    dataRow.innerHTML = `
      <td>
        ${zoneData.name || zoneId}<br>
        <span style="font-size:0.8em;color:#888;">(${zoneId})</span>
      </td>
      <td contenteditable="true" data-field="name">${zoneData.name || ''}</td>
      <td contenteditable="true" data-field="gps">${zoneData.gps || ''}</td>
      <td contenteditable="true" data-field="diameter">${zoneData.diameter || '0.05'}</td>
      <td>
        <button class="manage-zone-btn" data-zone-id="${zoneId}">Manage</button>
        <button class="reset-zone-btn" data-zone-id="${zoneId}" 
          style="background:#B71C1C;color:white;margin-left:6px;">Reset</button>
        <button class="force-capture-btn" data-zone-id="${zoneId}" 
          style="background:#2E7D32;color:white;margin-left:6px;">Force Capture</button>
      </td>
      <td>
        ${zoneData.status || 'Available'}<br>
        <small style="color:#8bc34a;">${controllingTeam}</small><br>
        <small style="color:#ccc;font-size:0.75em;">Updated: ${lastUpdated}</small>
      </td>
    `;

    // 🧩 Details row (hidden by default)
    const detailsRow = document.createElement('tr');
    detailsRow.id = `details-${zoneId}`;
    detailsRow.style.display = 'none';
    detailsRow.innerHTML = `
      <td colspan="6" style="background:#2c2c2c;padding:20px;">
        <div class="map-container">${miniMapHtml(zoneData, googleMapsApiLoaded)}</div>
        <div class="zone-questions-container" style="margin-top:20px;">
          <h4>Zone Questions (${questionsCount})</h4>
          <table class="data-table questions-table" data-zone-id="${zoneId}">
            <thead>
              <tr><th>Question</th><th>Answer</th><th>Type</th></tr>
            </thead>
            <tbody>
              ${Array.from({ length: 7 }, (_, i) => {
                const qNum = i + 1;
                return `
                  <tr data-question-id="unique${qNum}">
                    <td contenteditable="true" data-col="question"></td>
                    <td contenteditable="true" data-col="answer"></td>
                    <td data-col="type">
                      <select class="question-type-select" data-zone-id="${zoneId}" data-question-id="unique${qNum}">
                        ${allowedQuestionTypes
                          .map(t => `<option value="${t}">${questionTypeLabels[t] || t}</option>`)
                          .join('')}
                      </select>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </td>
    `;

    // 🧩 Insert into table
    tableBody.appendChild(dataRow);
    tableBody.appendChild(detailsRow);

    // 🧠 Hydrate questions if present
    questionsSnap.forEach(qDoc => {
      const qId = qDoc.id;
      const q = qDoc.data();
      const tr = detailsRow.querySelector(`tr[data-question-id="${qId}"]`);
      if (tr) {
        tr.querySelector('[data-col="question"]').textContent = q.question || '';
        tr.querySelector('[data-col="answer"]').textContent = q.answer || '';
        const select = tr.querySelector('select.question-type-select');
        if (select && allowedQuestionTypes.includes(q.type)) {
          select.value = q.type;
        }
      }
    });
  }

  console.log(`✅ Rendered ${zoneDocs.size} zones.`);
}