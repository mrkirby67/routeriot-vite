// --- IMPORTS & GLOBAL VARIABLES ---
import { db } from './modules/config.js';
import { allTeams } from './data.js';
import { doc, onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';
import { setupPlayerChatAndBroadcasts } from './modules/chat.js'; // <-- Import from new module
import { loadZones } from './modules/zones.js'; // <-- Import from new module

let currentTeamName = null;

// --- MAIN APP INITIALIZATION ---
async function main() {
    // These functions load the core, non-map related info first.
    loadTeamInfo();
    listenForGameUpdates();
    initializePlayerScoreboard();
    
    // After the basics are loaded, wait for the Google Maps API.
    try {
        await loadGoogleMapsApi();
        // Once maps are ready, load the zones, passing the current team name.
        loadZones(currentTeamName);
    } catch (error) {
        console.error("CRITICAL ERROR: Could not load Google Maps API.", error);
    }
}
document.addEventListener('DOMContentLoaded', main);

// --- CORE PAGE LOADERS ---
function loadTeamInfo() {
    const params = new URLSearchParams(window.location.search);
    currentTeamName = params.get('teamName');
    if (!currentTeamName) { document.body.innerHTML = '<h1>Error: No Team Specified in URL</h1>'; return; }
    
    const currentTeam = allTeams.find(team => team.name === currentTeamName);
    if (!currentTeam) { document.body.innerHTML = `<h1>Error: Team '${currentTeamName}' not found.</h1>`; return; }

    document.getElementById('team-name').textContent = currentTeam.name;
    document.getElementById('team-slogan').textContent = currentTeam.slogan;

    const memberList = document.getElementById('team-member-list');
    const q = query(collection(db, "racers"), where("team", "==", currentTeamName));
    
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
    
    // Initialize the chat and broadcast system from the new module.
    setupPlayerChatAndBroadcasts(currentTeamName);
}

function initializePlayerScoreboard() {
    const scoreboardBody = document.getElementById('player-scoreboard-tbody');
    if (!scoreboardBody) return;

    const scoresCollection = collection(db, "scores");
    onSnapshot(scoresCollection, (snapshot) => {
        let scores = [];
        allTeams.forEach(team => {
            scores.push({ name: team.name, score: 0 });
        });

        snapshot.forEach(doc => {
            const teamScore = scores.find(s => s.name === doc.id);
            if (teamScore) {
                teamScore.score = doc.data().score || 0;
            }
        });

        scores.sort((a, b) => b.score - a.score);

        scoreboardBody.innerHTML = '';
        scores.forEach(teamScore => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${teamScore.name}</td>
                <td>${teamScore.score}</td>
            `;
            scoreboardBody.appendChild(row);
        });
    });
}

function listenForGameUpdates() {
    const gameStatusEl = document.getElementById('game-status');
    const timerEl = document.getElementById('player-timer');
    if (!gameStatusEl || !timerEl) return;
    let gameTimerInterval;
    onSnapshot(doc(db, "game", "gameState"), (docSnap) => {
        if (gameTimerInterval) clearInterval(gameTimerInterval);
        if (!docSnap.exists()) {
            gameStatusEl.textContent = "Waiting to Start";
            timerEl.textContent = "--:--:--";
            return;
        }
        const gameState = docSnap.data();
        gameStatusEl.textContent = gameState.status;
        if (gameState.status === 'active' && gameState.endTime) {
            gameTimerInterval = setInterval(() => {
                const now = Date.now();
                const remaining = gameState.endTime - now;
                if (remaining <= 0) {
                    timerEl.textContent = "00:00:00";
                    clearInterval(gameTimerInterval);
                } else {
                    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((remaining / 1000 / 60) % 60);
                    const seconds = Math.floor((remaining / 1000) % 60);
                    timerEl.textContent = 
                        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                }
            }, 1000);
        } else {
            timerEl.textContent = "--:--:--";
        }
    });
}

