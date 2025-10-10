// --- IMPORTS & GLOBAL VARIABLES ---
import { db, firebaseConfig } from './modules/config.js';
import { allTeams } from './data.js';
import { doc, onSnapshot, collection, query, where, getDoc, getDocs, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setupPlayerChat } from './modules/chatManager.js';
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';

// Functions that used to be in separate modules are now here for simplicity
async function addPointsToTeam(teamName, points) {
    if (!teamName || !points) return;
    const scoreRef = doc(db, "scores", teamName);
    await setDoc(scoreRef, { score: increment(points) }, { merge: true });
}
async function updateControlledZones(teamName, zoneName) {
    if (!teamName || !zoneName) return;
    const scoreRef = doc(db, "scores", teamName);
    await setDoc(scoreRef, { zonesControlled: zoneName }, { merge: true });
}
async function broadcastEvent(teamName, message) {
    const commsRef = collection(db, "communications");
    await addDoc(commsRef, { teamName, message, timestamp: new Date() });
}
function broadcastChallenge(teamName, zoneName) {
    broadcastEvent(teamName, `is challenging ${zoneName}!`);
}
function broadcastWin(teamName, zoneName) {
    broadcastEvent(teamName, `** has captured ${zoneName}! **`);
}
async function updateTeamLocation(teamName, zoneName) {
    if (!teamName || !zoneName) return;
    const teamStatusRef = doc(db, "teamStatus", teamName);
    await setDoc(teamStatusRef, { lastKnownLocation: zoneName }, { merge: true });
}


let currentTeamName = null;
let challengeState = {
    zoneId: null,
    questionId: null,
    attemptsLeft: 3
};

// --- MAIN APP INITIALIZATION ---
async function main() {
    loadTeamInfo();
    listenForGameUpdates();
    listenForBroadcasts();
    try {
        await loadGoogleMapsApi();
        loadZones();
        console.log("SUCCESS: All Player Page modules, including maps, have been loaded.");
    } catch (error) {
        console.error("CRITICAL ERROR: Could not load Google Maps API.", error);
    }
}
document.addEventListener('DOMContentLoaded', main);

// --- CORE PAGE LOADERS ---
function loadTeamInfo() {
    const params = new URLSearchParams(window.location.search);
    currentTeamName = params.get('teamName');
    if (!currentTeamName) {
        document.getElementById('team-name').textContent = "NO TEAM SPECIFIED";
        return; 
    }
    
    const currentTeam = allTeams.find(team => team.name === currentTeamName);
    if (!currentTeam) { 
        document.getElementById('team-name').textContent = "INVALID TEAM";
        return; 
    }

    document.getElementById('team-name').textContent = currentTeam.name;
    document.getElementById('team-slogan').textContent = currentTeam.slogan;

    const memberList = document.getElementById('team-member-list');
    const q = query(collection(db, "racers"), where("team", "==", currentTeamName));
    onSnapshot(q, (snapshot) => {
        memberList.innerHTML = '';
        if (snapshot.empty) { 
            memberList.innerHTML = '<li>No racers assigned.</li>'; 
        } else {
            snapshot.forEach(doc => {
                const li = document.createElement('li');
                li.textContent = doc.data().name;
                memberList.appendChild(li);
            });
        }
    });
    
    setupPlayerChat(currentTeamName);
}

function listenForGameUpdates() {
    // ... logic is correct
}

function loadZones() {
    // ... logic is correct
}

// --- GAMEPLAY ACTIONS ---
async function handleChallengeClick(event) {
    // ... logic is correct
}

async function handleAnswerSubmit() {
    // ... logic is correct
}

// ... All other functions from your original player.js are correct ...
