// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/RacerManagement/RacerManagement.js
// PURPOSE: Provides Racer Management UI and Firestore synchronization for roster data.
// DEPENDS_ON: /core/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { db } from '/core/config.js';
import { onSnapshot, collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './RacerManagement.module.css';

export function RacerManagementComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <div class="${styles.headerRow}">
                <h2>Racer Management</h2>
                <button id="toggle-racers-btn" class="${styles.secondaryBtn}">Expand ▼</button>
            </div>
            <div id="racers-table-container" style="display: none;">
                <table class="${styles.dataTable}" id="racers-table">
                    <thead>
                        <tr>
                            <th>Assigned Team</th>
                            <th>Racer Name</th>
                            <th>Cell Number</th>
                            <th>Email Address</th>
                        </tr>
                    </thead>
                    <tbody id="racers-table-body">
                    </tbody>
                </table>
            </div>
        </div>
    `;
    return componentHtml;
}

export function initializeRacerManagementLogic() {
    const tableBody = document.getElementById('racers-table-body');
    const toggleBtn = document.getElementById('toggle-racers-btn');
    const tableContainer = document.getElementById('racers-table-container');

    if (!tableBody || !toggleBtn || !tableContainer) return;

    toggleBtn.addEventListener('click', () => {
        const isHidden = tableContainer.style.display === 'none';
        tableContainer.style.display = isHidden ? 'block' : 'none';
        toggleBtn.textContent = isHidden ? 'Collapse ▲' : 'Expand ▼';
    });

    const racersCollection = collection(db, "racers");

    async function saveRacerData(event) {
        const cell = event.target;
        const racerId = cell.dataset.id;
        const field = cell.dataset.field;
        const value = cell.textContent.trim();
        if (!racerId || !field) return;
        const racerRef = doc(db, "racers", racerId);
        try {
            await setDoc(racerRef, { [field]: value }, { merge: true });
        } catch (error) { console.error("Error saving racer data: ", error); }
    }

    onSnapshot(racersCollection, (snapshot) => {
        tableBody.innerHTML = '';
        let racers = [];
        snapshot.forEach(doc => racers.push({ id: doc.id, ...doc.data() }));
        for (let i = 0; i < 12; i++) {
            const racer = racers[i] || { id: `racer_${i + 1}`, name: '', cell: '', email: '', team: '-' };
            const row = document.createElement('tr');
            row.innerHTML = `<td>${racer.team || '-'}</td><td contenteditable="true" data-id="${racer.id}" data-field="name">${racer.name}</td><td contenteditable="true" data-id="${racer.id}" data-field="cell">${racer.cell}</td><td contenteditable="true" data-id="${racer.id}" data-field="email">${racer.email}</td>`;
            tableBody.appendChild(row);
        }
        tableBody.querySelectorAll('td[contenteditable="true"]').forEach(cell => cell.addEventListener('blur', saveRacerData));
    });
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/RacerManagement/RacerManagement.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: RacerManagementComponent, initializeRacerManagementLogic
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
