// ============================================================================
// FILE: components/RacerManagement/RacerManagement.js
// PURPOSE: Component module components/RacerManagement/RacerManagement.js
// DEPENDS_ON: modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================

import { db } from '../../modules/config.js';
import { onSnapshot, collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './RacerManagement.module.css';

export function RacerManagementComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Racer Management</h2>
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
    `;
    return componentHtml;
}

export function initializeRacerManagementLogic() {
    const tableBody = document.getElementById('racers-table-body');
    if (!tableBody) return;
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

// === AI-CONTEXT-MAP ===
// aicp_category: component
// ai_origin:
//   primary: ChatGPT
//   secondary: Gemini
// ai_role: UI Layer
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: RacerManagementComponent, initializeRacerManagementLogic
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END ===
