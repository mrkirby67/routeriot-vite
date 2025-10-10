// --- IMPORTS & GLOBAL VARIABLES ---
import { db, firebaseConfig } from './modules/config.js';
import { allTeams } from './data.js';
import { doc, onSnapshot, collection, query, where, getDoc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { setupPlayerChat } from './modules/chatManager.js';
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';
import { addPointsToTeam, updateControlledZones } from './modules/scoreboardManager.js';
import { broadcastChallenge, updateTeamLocation, broadcastWin } from './modules/gameLogicManager.js';

let currentTeamName = null;
let challengeState = {
    zoneId: null,
    questionId: null,
    attemptsLeft: 3
};

// --- MAIN APP INITIALIZATION ---
async function main() { /* ... code is correct ... */ }
document.addEventListener('DOMContentLoaded', main);

// --- CORE PAGE LOADERS ---
function loadTeamInfo() {
    const params = new URLSearchParams(window.location.search);
    currentTeamName = params.get('teamName');
    if (!currentTeamName) { /* ... error handling ... */ return; }
    
    const currentTeam = allTeams.find(team => team.name === currentTeamName);
    if (!currentTeam) { /* ... error handling ... */ return; }

    document.getElementById('team-name').textContent = currentTeam.name;
    document.getElementById('team-slogan').textContent = currentTeam.slogan;

    const memberList = document.getElementById('team-member-list');
    const q = query(collection(db, "racers"), where("team", "==", currentTeamName));
    onSnapshot(q, (snapshot) => {
        memberList.innerHTML = '';
        if (snapshot.empty) { memberList.innerHTML = '<li>No racers assigned.</li>'; } 
        else {
            snapshot.forEach(doc => {
                const li = document.createElement('li');
                li.textContent = doc.data().name;
                memberList.appendChild(li);
            });
        }
    });
    
    setupPlayerChat(currentTeamName);
}

function listenForGameUpdates() { /* ... code is correct ... */ }

function loadZones() { /* ... code is correct ... */ }

// --- GAMEPLAY ACTIONS ---
async function handleChallengeClick(event) { /* ... code is correct ... */ }

async function handleAnswerSubmit() { /* ... code is correct ... */ }

function validateAnswer(playerAnswer, correctAnswer, type) { /* ... code is correct ... */ }

// --- HELPER FUNCTIONS ---
function calculateDistance(lat1, lon1, lat2, lon2) { /* ... code is correct ... */ }

async function displayZoneQuestions(zoneId, zoneName) { /* ... code is correct ... */ }

function listenForBroadcasts() { /* ... code is correct ... */ }

// --- MAP & VISUAL HELPERS ---
function calculateZoomLevel(diameterKm, imageWidthPixels = 150) { /* ... code is correct ... */ }

function generateMiniMap(zoneData) { /* ... code is correct ... */ }

function encodeCircle(centerStr, radius) { /* ... code is correct ... */ }