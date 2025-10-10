// =================================================================
// IMPORTS
// =================================================================
import { db, firebaseConfig } from './modules/config.js';
import { allTeams } from './data.js';
import { onSnapshot, collection, doc, setDoc, increment, writeBatch, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Component Imports
import TeamLinksComponent from './components/TeamLinks/TeamLinks.js';
import ScoreboardComponent from './components/Scoreboard/Scoreboard.js';
import GameControlsComponent from './components/GameControls/GameControls.js';
import RacerManagementComponent from './components/RacerManagement/RacerManagement.js';
import ZoneManagementComponent from './components/ZoneManagement/ZoneManagement.js';
import ZoneQuestionsComponent from './components/ZoneQuestions/ZoneQuestions.js';
import GameChallengesComponent from './components/GameChallenges/GameChallenges.js';
import BroadcastComponent from './components/Broadcast/Broadcast.js';

// Module Imports
import { listenToAllMessages } from './modules/chatManager.js';
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';


// =================================================================
// LOGIC INITIALIZATION FUNCTIONS
// =================================================================

function initializeScoreboardListener() {
    const scoreboardBody = document.getElementById('scoreboard-tbody');
    if (!scoreboardBody) return;
    const scoresCollection = collection(db, "scores");
    onSnapshot(scoresCollection, (snapshot) => {
        const scores = {};
        snapshot.forEach(doc => { scores[doc.id] = doc.data(); });
        scoreboardBody.innerHTML = '';
        allTeams.forEach(team => {
            const teamScoreData = scores[team.name] || { score: 0, zonesControlled: "" };
            const row = document.createElement('tr');
            row.innerHTML = `<td>${team.name}</td><td>${teamScoreData.score}</td><td>${teamScoreData.zonesControlled || "None"}</td>`;
            scoreboardBody.appendChild(row);
        });
    });
}

function initializeGameControlsLogic() {
    const timerDisplay = document.getElementById('timer-display');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const endBtn = document.getElementById('end-btn');
    const resetBtn = document.getElementById('reset-game-btn');
    const randomizeBtn = document.getElementById('randomize-btn');
    const sendBtn = document.getElementById('send-links-btn');
    let gameTimerInterval;

    // Live timer listener
    onSnapshot(doc(db, "game", "gameState"), (docSnap) => {
        if (gameTimerInterval) clearInterval(gameTimerInterval);
        const gameState = docSnap.data();
        if (gameState && gameState.status === 'active' && gameState.endTime) {
            gameTimerInterval = setInterval(() => {
                const now = Date.now();
                const remaining = gameState.endTime - now;
                if (remaining <= 0) {
                    timerDisplay.textContent = "00:00:00";
                    clearInterval(gameTimerInterval);
                } else {
                    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((remaining / 1000 / 60) % 60);
                    const seconds = Math.floor((remaining / 1000) % 60);
                    timerDisplay.textContent = 
                        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                }
            }, 1000);
        } else {
            timerDisplay.textContent = "--:--:--";
        }
    });

    // Button event listeners
    startBtn.addEventListener('click', async () => {
        const durationMinutes = document.getElementById('game-duration').value || 120;
        const endTime = Date.now() + (durationMinutes * 60 * 1000);
        await setDoc(doc(db, "game", "gameState"), { status: 'active', endTime: endTime });
        alert('Game Started!');
    });

    pauseBtn.addEventListener('click', async () => {
        await setDoc(doc(db, "game", "gameState"), { status: 'paused' }, { merge: true });
        alert('Game Paused!');
    });

    endBtn.addEventListener('click', async () => {
        await setDoc(doc(db, "game", "gameState"), { status: 'finished' }, { merge: true });
        alert('Game Ended!');
    });
    
    resetBtn.addEventListener('click', async () => {
        if (confirm("Are you sure? This will reset game state, scores, and racer teams.")) {
            const batch = writeBatch(db);
            batch.set(doc(db, "game", "gameState"), { status: 'not started' });
            
            const racersSnapshot = await getDocs(collection(db, "racers"));
            racersSnapshot.forEach(racerDoc => {
                batch.update(racerDoc.ref, { team: '-' });
            });

            const scoresSnapshot = await getDocs(collection(db, "scores"));
            scoresSnapshot.forEach(scoreDoc => {
                batch.delete(scoreDoc.ref);
            });

            await batch.commit();
            alert('Game has been reset.');
        }
    });

    randomizeBtn.addEventListener('click', async () => {
        const teamSize = parseInt(document.getElementById('team-size').value);
        if (isNaN(teamSize) || teamSize < 1) {
            return alert("Please enter a valid team size.");
        }
        const racersSnapshot = await getDocs(collection(db, "racers"));
        let racers = [];
        racersSnapshot.forEach(doc => { if (doc.data().name) { racers.push({ id: doc.id, ...doc.data() }); } });
        
        for (let i = racers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [racers[i], racers[j]] = [racers[j], racers[i]];
        }
        
        const batch = writeBatch(db);
        racers.forEach((racer, index) => {
            const teamIndex = Math.floor(index / teamSize);
            const team = allTeams[teamIndex % allTeams.length];
            const racerRef = doc(db, "racers", racer.id);
            batch.update(racerRef, { team: team.name });
        });
        await batch.commit();
        alert("Teams have been randomized!");
    });

    sendBtn.addEventListener('click', () => {
        alert("Racers informed! Check the console for team rosters.");
    });
}

function initializeRacerManagementLogic() {
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

let googleMapsApiLoaded = false;

function initializeZoneManagementLogic() {
    const tableBody = document.getElementById('zones-table-body');
    if (!tableBody) return;
    const questionsAccordion = document.getElementById('zone-questions-accordion');
    if (!questionsAccordion) return;

    const zonesCollection = collection(db, "zones");
    
    function generateMiniMap(zoneData) {
        if (!googleMapsApiLoaded || !zoneData || !zoneData.gps) return `<p>Enter valid GPS to see preview.</p>`;
        const diameterKm = parseFloat(zoneData.diameter) || 0.05;
        const zoom = Math.round(16 - Math.log2(diameterKm));
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${zoneData.gps}&zoom=${zoom}&size=600x200&maptype=satellite&markers=color:red%7C${zoneData.gps}&key=${firebaseConfig.apiKey}`;
        return `<img src="${mapUrl}" alt="Map preview of ${zoneData.name}">`;
    }

    onSnapshot(zonesCollection, (snapshot) => {
        const allZoneData = {};
        snapshot.forEach(doc => { allZoneData[doc.id] = doc.data(); });

        tableBody.innerHTML = '';
        for (let i = 0; i < 20; i++) {
            const zoneId = `zone${i + 1}`;
            const zoneData = allZoneData[zoneId] || {};
            
            const dataRow = document.createElement('tr');
            dataRow.innerHTML = `
                <td>Zone ${i + 1}</td>
                <td contenteditable="true" data-field="name">${zoneData.name || ''}</td>
                <td contenteditable="true" data-field="gps">${zoneData.gps || ''}</td>
                <td contenteditable="true" data-field="diameter">${zoneData.diameter || '0.05'}</td>
                <td><button class="save-zone-btn" data-zone-id="${zoneId}">Save & Preview</button></td>
                <td>${zoneData.status || 'Available'}</td>
            `;
            tableBody.appendChild(dataRow);
        }
    });

    tableBody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('save-zone-btn')) {
            const zoneId = event.target.dataset.zoneId;
            const row = event.target.closest('tr');
            const zoneData = {
                name: row.querySelector('[data-field="name"]').textContent.trim(),
                gps: row.querySelector('[data-field="gps"]').textContent.trim(),
                diameter: row.querySelector('[data-field="diameter"]').textContent.trim(),
            };
            await setDoc(doc(db, "zones", zoneId), zoneData, { merge: true });
            alert(`${zoneData.name} saved!`);
        }
    });
}

function initializeQuestionManagementLogic() {
    const questionsAccordion = document.getElementById('zone-questions-accordion');
    if (!questionsAccordion) return;
    
    async function saveZoneQuestionData(event) {
        const cell = event.target;
        if (!cell.isContentEditable) return;
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
        } catch (error) { console.error(`Error saving question for ${zoneId}:`, error); }
    }

    questionsAccordion.addEventListener('blur', saveZoneQuestionData, true);
}

function initializeGameChallengesLogic() {
    const table = document.querySelector('.game-wide-challenges-table');
    if (!table) return;

    table.addEventListener('blur', async (event) => {
        const cell = event.target;
        if (cell.tagName !== 'TD' || !cell.isContentEditable) return;

        const row = cell.closest('tr');
        const challengeId = row.dataset.questionId;
        if (!challengeId) return;

        const fields = ['challengeType', 'question', 'answer', 'type']; 
        const field = fields[cell.cellIndex];
        if (!field || field === 'challengeType') return;

        const value = cell.textContent.trim();
        const challengeRef = doc(db, "specialChallenges", challengeId);
        try {
            await setDoc(challengeRef, { [field]: value }, { merge: true });
        } catch (error) { console.error("Error saving special challenge:", error); }
    }, true);
}

function initializeBroadcastLogic() {
    const broadcastBtn = document.getElementById('broadcast-btn');
    const broadcastInput = document.getElementById('broadcast-message');
    if (!broadcastBtn || !broadcastInput) return;

    broadcastBtn.addEventListener('click', async () => {
        const message = broadcastInput.value.trim();
        if (!message) return alert("Please enter a message to broadcast.");
        try {
            const broadcastRef = doc(db, "game", "broadcast");
            await setDoc(broadcastRef, { message, timestamp: Date.now() });
            alert("Broadcast sent!");
            broadcastInput.value = '';
        } catch (error) { console.error("Error sending broadcast:", error); }
    });
}


// =================================================================
// MAIN APPLICATION STARTUP
// =================================================================
async function main() {
    document.getElementById('game-controls-container').innerHTML = GameControlsComponent();
    document.getElementById('scoreboard-container').innerHTML = ScoreboardComponent();
    document.getElementById('team-links-container').innerHTML = TeamLinksComponent();
    document.getElementById('racer-management-container').innerHTML = RacerManagementComponent();
    document.getElementById('zone-management-container').innerHTML = ZoneManagementComponent();
    document.getElementById('zone-questions-container').innerHTML = ZoneQuestionsComponent();
    document.getElementById('game-challenges-container').innerHTML = GameChallengesComponent();
    document.getElementById('broadcast-container').innerHTML = BroadcastComponent();
    
    initializeScoreboardListener();
    initializeGameControlsLogic();
    initializeRacerManagementLogic();
    initializeQuestionManagementLogic();
    initializeGameChallengesLogic();
    initializeBroadcastLogic();
    listenToAllMessages();

    try {
        await loadGoogleMapsApi();
        googleMapsApiLoaded = true;
        initializeZoneManagementLogic();
    } catch (error) {
        console.error("CRITICAL ERROR: Could not load Google Maps API.", error);
    }
}

document.addEventListener('DOMContentLoaded', main);

