// ============================================================================
// PLAYER UI INITIALIZER
// Sets the initial team name, slogan, and member list on the player page.
// ============================================================================

import { db } from './config.js';
import { onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Simple helpers for DOM manipulation
function $(id) { return document.getElementById(id); }
function setText(id, value) { const el = $(id); if (el) el.textContent = value; }

/**
 * Initializes the static UI elements for the player page.
 * @param {object} team - The team object from the allTeams array.
 * @param {string} teamName - The name of the current team.
 */
export function initializePlayerUI(team, teamName) {
    // Set the team name and slogan from the data.js file
    setText('team-name', team.name || teamName);
    setText('team-slogan', team.slogan || 'Ready to race!');

    const memberList = $('team-member-list');
    if (!memberList) return;

    // Set up a real-time listener for the team's roster
    const q = query(collection(db, "racers"), where("team", "==", teamName));
    
    onSnapshot(q, (snapshot) => {
        memberList.innerHTML = '';
        if (snapshot.empty) { 
            memberList.innerHTML = '<li>No racers assigned to this team yet.</li>'; 
        } else {
            snapshot.forEach(doc => {
                const member = doc.data();
                const li = document.createElement('li');
                let memberDetails = `<strong>${member.name || 'Unnamed Racer'}</strong>`;
                if (member.cell) { memberDetails += ` - 📱 ${member.cell}`; }
                if (member.email) { memberDetails += ` - ✉️ ${member.email}`; }
                li.innerHTML = memberDetails;
                memberList.appendChild(li);
            });
        }
    });
}

