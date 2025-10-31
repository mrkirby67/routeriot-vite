// ============================================================================
// FILE: components/Broadcast/Broadcast.js
// PURPOSE: Component module components/Broadcast/Broadcast.js
// DEPENDS_ON: modules/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================

import { db } from '../../modules/config.js';
import { onSnapshot, doc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './Broadcast.module.css';

export function BroadcastComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Broadcast & Communication</h2>
            <div class="${styles.broadcastBox}">
                <label for="broadcast-message">Broadcast Message to All Racers:</label>
                <input type="text" id="broadcast-message" placeholder="E.g., Meet at City Hall for lunch...">
                <button id="broadcast-btn">Send Broadcast</button>
            </div>
            <div id="communication-log" class="${styles.logBox}">
                <p>All team communications will appear here...</p>
            </div>
        </div>
    `;
    return componentHtml;
}

export function initializeBroadcastLogic() {
    const broadcastBtn = document.getElementById('broadcast-btn');
    const broadcastInput = document.getElementById('broadcast-message');
    if (!broadcastBtn || !broadcastInput) return;

    onSnapshot(doc(db, "game", "gameState"), (docSnap) => {
        const gameState = docSnap.data();
        if (gameState && gameState.status === 'active') {
            broadcastBtn.disabled = false;
            broadcastInput.placeholder = "E.g., Meet at City Hall for lunch...";
        } else {
            broadcastBtn.disabled = true;
            broadcastInput.placeholder = "Game must be running to send broadcasts.";
        }
    });

    broadcastBtn.addEventListener('click', async () => {
        const message = broadcastInput.value.trim();
        if (!message) return alert("Please enter a message to broadcast.");
        try {
            const commsRef = collection(db, "communications");
            await addDoc(commsRef, {
                teamName: "Game Master",
                sender: "Game Master",
                senderDisplay: "Game Master",
                message: message,
                isBroadcast: true,
                timestamp: serverTimestamp()
            });
            alert("Broadcast sent!");
            broadcastInput.value = '';
        } catch (error) { console.error("Error sending broadcast:", error); }
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
// exports: BroadcastComponent, initializeBroadcastLogic
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END ===
