// ============================================================================
// File: components/ZoneManagement/zoneRender.js
// Purpose: Pure rendering for the Zone Management table (no event listeners).
// Depends only on Firestore reads and firebaseConfig for Static Maps.
// ============================================================================

import { db, firebaseConfig } from '../../modules/config.js';
import {
  collection,
  getDocs,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */
function calculateZoomFromDiameter(diameterKm) {
  const safe = Math.max(parseFloat(diameterKm) || 0.05, 0.001);
  // Rough heuristic; higher diameter → lower zoom
  return Math.max(3, Math.min(21, Math.round(16 - Math.log2(safe))));
}

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
 * Public: renderZones
 * - Renders all zone rows (data row + hidden detail row) into the table body
 * - Does not attach listeners (delegated to zoneHandlers.js)
 * ------------------------------------------------------------------------ */
export async function renderZones({ tableBody, googleMapsApiLoaded }) {
  const zonesCol = collection(db, "zones");
  const zoneDocs = await getDocs(zonesCol);

  tableBody.innerHTML = '';

  for (const zoneDoc of zoneDocs.docs) {
    const zoneId = zoneDoc.id;
    const zoneData = zoneDoc.data();

    // Preload questions count (for the header in details)
    const questionsSnap = await getDocs(collection(db, "zones", zoneId, "questions"));
    const questionsCount = questionsSnap.size;

    // (Optional) Preload controlling team status doc (not rendered heavily)
    const controllingTeam = zoneData.controllingTeam || "None";
    if (controllingTeam && controllingTeam !== "None") {
      // Safe read; we don't need the data, but this avoids errors if you later expand UI
      await getDoc(doc(db, "teamStatus", controllingTeam)).catch(() => {});
    }

    const dataRow = document.createElement('tr');
    dataRow.dataset.zoneId = zoneId;
    dataRow.innerHTML = `
      <td>${zoneData.name || zoneId}<br>
          <span style="font-size:0.8em;color:#888;">(${zoneId})</span>
      </td>
      <td contenteditable="true" data-field="name">${zoneData.name || ''}</td>
      <td contenteditable="true" data-field="gps">${zoneData.gps || ''}</td>
      <td contenteditable="true" data-field="diameter">${zoneData.diameter || '0.05'}</td>
      <td>
        <button class="manage-zone-btn" data-zone-id="${zoneId}">Manage</button>
        <button class="reset-zone-btn" data-zone-id="${zoneId}" style="background:#B71C1C;color:white;margin-left:6px;">Reset</button>
        <button class="force-capture-btn" data-zone-id="${zoneId}" style="background:#2E7D32;color:white;margin-left:6px;">Force Capture</button>
      </td>
      <td>${zoneData.status || 'Available'}<br>
          <small style="color:#8bc34a;">${controllingTeam}</small>
      </td>
    `;

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
              ${[1,2,3,4,5,6,7].map(qNum => `
                <tr data-question-id="unique${qNum}">
                  <td contenteditable="true"></td>
                  <td contenteditable="true"></td>
                  <td contenteditable="true"></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </td>
    `;

    tableBody.appendChild(dataRow);
    tableBody.appendChild(detailsRow);

    // If you want to hydrate each question cell with data:
    questionsSnap.forEach(qDoc => {
      const qId = qDoc.id;
      const q = qDoc.data();
      const tr = detailsRow.querySelector(`tr[data-question-id="${qId}"]`);
      if (tr) {
        tr.children[0].textContent = q.question || '';
        tr.children[1].textContent = q.answer || '';
        tr.children[2].textContent = q.type || '';
      }
    });
  }
}