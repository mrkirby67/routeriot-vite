// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/ZoneManagement/zoneRender.js
// PURPOSE: 🔍 Helper: Dynamic Zoom from Diameter
// DEPENDS_ON: /core/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../data.js, components/ZoneQuestions/ZoneQuestionsTypes.js, ../../modules/zoneManager.js
// USED_BY: components/ZoneManagement/ZoneManagement.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import styles from './ZoneManagement.module.css';
import { db, firebaseConfig } from '/core/config.js';
import {
  collection,
  getDocs,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { allTeams } from '../../data.js';
import { allowedQuestionTypes, questionTypeLabels } from '../ZoneQuestions/ZoneQuestionsTypes.js';
import {
  hydrateZoneCooldown,
  isZoneOnCooldown,
  getZoneCooldownRemaining
} from '../../modules/zoneManager.js';

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
    const questionsCol = collection(db, 'zones', zoneId, 'questions');
    const questionsSnap = await getDocs(questionsCol);
    const questions = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 🧭 Normalize controlling team
    const controllingTeam =
      allTeams.find(t => t.name === zoneData.controllingTeam)?.name ||
      zoneData.controllingTeam ||
      '—';

    // 🕓 Format timestamp + hydrate cooldown cache
    const updatedAtMs = zoneData.updatedAt?.toMillis
      ? zoneData.updatedAt.toMillis()
      : zoneData.updatedAt?.seconds
        ? zoneData.updatedAt.seconds * 1000
        : typeof zoneData.updatedAt === 'number'
          ? zoneData.updatedAt
          : null;
    const updatedLabel = updatedAtMs ? new Date(updatedAtMs).toLocaleString() : '—';

    const cooldownUntilMs = zoneData.cooldownUntil?.toMillis
      ? zoneData.cooldownUntil.toMillis()
      : typeof zoneData.cooldownUntil === 'number'
        ? zoneData.cooldownUntil
        : null;

    if (cooldownUntilMs) {
      hydrateZoneCooldown(zoneId, cooldownUntilMs);
    }

    const onCooldown = isZoneOnCooldown(zoneId);
    const remainingMinutes = onCooldown
      ? Math.max(1, Math.ceil(getZoneCooldownRemaining(zoneId) / 60000))
      : 0;

    const statusCellClass = [
      styles?.zoneStatusCell,
      'zone-status-cell'
    ].filter(Boolean).join(' ');
    const cooldownClass = styles?.cooldownActive || 'cooldown-active';
    const ownedClass = styles?.ownedBy || 'owned-by';
    const availableClass = styles?.available || 'zone-available';
    const updatedClass = styles?.statusUpdated || 'status-updated';
    const zoneStatus = zoneData.status || 'Available';

    const ownerLabel = controllingTeam !== '—' ? controllingTeam : '';
    let statusHtml = `<span class="${availableClass}">${zoneStatus}</span>`;
    if (ownerLabel) {
      statusHtml = onCooldown
        ? `<span class="${cooldownClass}">${ownerLabel} ⏳ (${remainingMinutes} min left)</span>`
        : `<span class="${ownedClass}">${ownerLabel}</span>`;
    } else if (onCooldown) {
      statusHtml = `<span class="${cooldownClass}">Cooldown ⏳ (${remainingMinutes} min left)</span>`;
    }

    const datasetCooldown = onCooldown ? cooldownUntilMs : '';

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
      <td
        class="${statusCellClass}"
        data-zone-id="${zoneId}"
        data-team="${ownerLabel}"
        data-zone-status="${zoneStatus}"
        data-updated-ts="${updatedAtMs || ''}"
        data-cooldown-until="${datasetCooldown || ''}"
        data-class-cooldown="${cooldownClass}"
        data-class-owned="${ownedClass}"
        data-class-available="${availableClass}"
        data-class-updated="${updatedClass}"
      >
        ${statusHtml}<br>
        <small class="${updatedClass}">Updated: ${updatedLabel}</small>
      </td>
    `;

    // 🧩 Details row (hidden by default)
    const detailsRow = document.createElement('tr');
    detailsRow.id = `details-${zoneId}`;
    detailsRow.style.display = 'none';
    
    const questionRowsHtml = questions.map(q => {
        return `
          <tr data-question-id="${q.id}">
            <td contenteditable="true" data-col="question">${q.question || ''}</td>
            <td contenteditable="true" data-col="answer">${q.answer || ''}</td>
            <td data-col="type">
              <select class="question-type-select">
                ${allowedQuestionTypes
                  .map(t => `<option value="${t}" ${q.type === t ? 'selected' : ''}>${questionTypeLabels[t] || t}</option>`)
                  .join('')}
              </select>
            </td>
          </tr>`;
      }).join('');

    detailsRow.innerHTML = `
      <td colspan="6" style="background:#2c2c2c;padding:20px;">
        <div class="map-container">${miniMapHtml(zoneData, googleMapsApiLoaded)}</div>
        <div class="zone-questions-container" style="margin-top:20px;">
          <h4>Zone Questions (${questions.length})</h4>
          <table class="data-table questions-table" data-zone-id="${zoneId}">
            <thead>
              <tr><th>Question</th><th>Answer</th><th>Type</th></tr>
            </thead>
            <tbody>
              ${questionRowsHtml}
            </tbody>
          </table>
          <button class="add-question-btn" data-zone-id="${zoneId}" style="margin-top:10px;">➕ Add Question</button>
        </div>
      </td>
    `;

    // 🧩 Insert into table
    tableBody.appendChild(dataRow);
    tableBody.appendChild(detailsRow);
  }

  console.log(`✅ Rendered ${zoneDocs.size} zones.`);
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/ZoneManagement/zoneRender.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: renderZones
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
