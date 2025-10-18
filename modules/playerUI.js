import { db } from './config.js';
import { allTeams } from '../data.js';
import { onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Simple helpers for DOM manipulation
function $(id) { return document.getElementById(id); }
function setText(id, value) { const el = $(id); if (el) el.textContent = value; }

/**
 * Initializes all static UI elements for the player page.
 * It finds the current team and sets the name, slogan, and member list.
 * @param {string} teamName - The name of the current team.
 */
export function initializePlayerUI(teamName) {
    const team = allTeams.find(t => t.name === teamName) || {};

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

