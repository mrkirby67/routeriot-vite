import { db, firebaseConfig } from '../../modules/config.js';
import { onSnapshot, collection, doc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './ZoneManagement.module.css';

/**
 * This function returns the static HTML structure for the component.
 */
export function ZoneManagementComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Zone Management</h2>
            <div class="${styles.cooldownSetup}">
                <label for="cooldown-time">Capture Cooldown Time:</label>
                <select id="cooldown-time">
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="25">25 minutes</option>
                    <option value="30" selected>30 minutes</option>
                    <option value="45">45 minutes</option>
                </select>
            </div>
            <table class="${styles.dataTable}" id="zones-table">
                <thead>
                    <tr>
                        <th>Zone Name (ID)</th>
                        <th>Custom Name (Editable)</th>
                        <th>GPS Coordinates (Lat, Lng)</th>
                        <th>Capture Diameter (km)</th>
                        <th>Action</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="zones-table-body">
                </tbody>
            </table>
        </div>
    `;
    return componentHtml;
}

/**
 * This function finds the elements rendered by the component and attaches all the live logic.
 * @param {boolean} googleMapsApiLoaded - A flag passed from control.js to confirm the maps API is ready.
 */
export function initializeZoneManagementLogic(googleMapsApiLoaded) {
    const tableBody = document.getElementById('zones-table-body');
    if (!tableBody) return;

    const zonesCollection = collection(db, "zones");
    
    function generateMiniMap(zoneData) {
        if (!googleMapsApiLoaded || !zoneData || !zoneData.gps) {
            return `<div style="width:600px; height:200px; background:#222; display:flex; align-items:center; justify-content:center; border-radius: 8px;">Enter valid GPS & save to see preview.</div>`;
        }
        const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
        if (!gpsRegex.test(zoneData.gps)) return `<div style="width:600px; height:200px; background:#222; display:flex; align-items:center; justify-content:center; border-radius: 8px;">Invalid GPS format.</div>`;

        const diameterKm = parseFloat(zoneData.diameter) || 0.05;
        const zoom = Math.round(16 - Math.log2(diameterKm));
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${zoneData.gps}&zoom=${zoom}&size=600x200&maptype=satellite&markers=color:red%7C${zoneData.gps}&key=${firebaseConfig.apiKey}`;
        return `<img src="${mapUrl}" alt="Map preview of ${zoneData.name}" style="border-radius: 8px;">`;
    }

    onSnapshot(zonesCollection, async (snapshot) => {
        const allZoneData = {};
        snapshot.forEach(doc => { allZoneData[doc.id] = doc.data(); });
        
        const allQuestionsData = {};
        for (let i = 0; i < 20; i++) {
            const zoneId = `zone${i + 1}`;
            const questionsSnapshot = await getDocs(collection(db, "zones", zoneId, "questions"));
            allQuestionsData[zoneId] = {};
            questionsSnapshot.forEach(qDoc => {
                allQuestionsData[zoneId][qDoc.id] = qDoc.data();
            });
        }

        tableBody.innerHTML = '';
        for (let i = 0; i < 20; i++) {
            const zoneId = `zone${i + 1}`;
            const zoneData = allZoneData[zoneId] || {};
            const zoneQuestions = allQuestionsData[zoneId] || {};
            
            const dataRow = document.createElement('tr');
            dataRow.dataset.zoneId = zoneId;
            dataRow.innerHTML = `
                <td>${zoneData.name || `Zone ${i + 1}`} <span style="font-size: 0.8em; color: #888;">(Zone ${i + 1})</span></td>
                <td contenteditable="true" data-field="name" placeholder="Enter Custom Name">${zoneData.name || ''}</td>
                <td contenteditable="true" data-field="gps">${zoneData.gps || ''}</td>
                <td contenteditable="true" data-field="diameter">${zoneData.diameter || '0.05'}</td>
                <td><button class="manage-zone-btn" data-zone-id="${zoneId}">Manage Details</button></td>
                <td>${zoneData.status || 'Available'}</td>
            `;
            
            const detailsRow = document.createElement('tr');
            detailsRow.id = `details-${zoneId}`;
            detailsRow.style.display = 'none';
            detailsRow.innerHTML = `
                <td colspan="6" style="padding: 20px; background-color: #2c2c2c;">
                    <div class="map-container">${generateMiniMap(zoneData)}</div>
                    <div class="zone-questions-container" style="margin-top: 20px;">
                        <h4>Unique Questions for ${zoneData.name || `Zone ${i + 1}`}</h4>
                        <table class="data-table questions-table" data-zone-id="${zoneId}">
                            <thead><tr><th>Question</th><th>Answer</th><th>Type (Eg. Y/N, T/F, CSV, OPEN)</th></tr></thead>
                            <tbody>
                                ${[1,2,3,4,5,6,7].map(qNum => `
                                <tr data-question-id="unique${qNum}">
                                    <td contenteditable="true">${(zoneQuestions[`unique${qNum}`] || {}).question || ''}</td>
                                    <td contenteditable="true">${(zoneQuestions[`unique${qNum}`] || {}).answer || ''}</td>
                                    <td contenteditable="true">${(zoneQuestions[`unique${qNum}`] || {}).type || ''}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </td>
            `;

            tableBody.appendChild(dataRow);
            tableBody.appendChild(detailsRow);
        }
    });

    tableBody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('manage-zone-btn')) {
            const zoneId = event.target.dataset.zoneId;
            const row = event.target.closest('tr');
            const detailsRow = document.getElementById(`details-${zoneId}`);
            
            const zoneData = {
                name: row.querySelector('[data-field="name"]').textContent.trim(),
                gps: row.querySelector('[data-field="gps"]').textContent.trim(),
                diameter: row.querySelector('[data-field="diameter"]').textContent.trim(),
            };
            await setDoc(doc(db, "zones", zoneId), zoneData, { merge: true });
            
            const mapContainer = detailsRow.querySelector('.map-container');
            mapContainer.innerHTML = generateMiniMap(zoneData);
            
            const isVisible = detailsRow.style.display !== 'none';
            detailsRow.style.display = isVisible ? 'none' : 'table-row';
            event.target.textContent = isVisible ? 'Manage Details' : 'Close Details';
        }
    });

    tableBody.addEventListener('blur', async (event) => {
        const cell = event.target;
        if (cell.isContentEditable && cell.closest('.questions-table')) {
            const row = cell.closest('tr');
            const table = cell.closest('table');
            const questionId = row.dataset.questionId;
            const zoneId = table.dataset.zoneId;
            if (!questionId || !zoneId) return;

            const fields = ['question', 'answer', 'type'];
            const field = fields[cell.cellIndex];
            const value = cell.textContent.trim();
            const questionRef = doc(db, "zones", zoneId, "questions", questionId);
            try {
                await setDoc(questionRef, { [field]: value }, { merge: true });
            } catch (error) { console.error(`Error saving question:`, error); }
        }
    }, true);
}

