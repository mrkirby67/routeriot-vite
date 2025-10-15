// --- IMPORTS & GLOBAL VARIABLES ---
import { db, firebaseConfig } from './modules/config.js';
import { allTeams } from './data.js';
import { doc, onSnapshot, collection, query, where, getDoc, getDocs, setDoc, addDoc, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';
import { addPointsToTeam, updateControlledZones } from './modules/scoreboardManager.js';
import { broadcastChallenge, updateTeamLocation, broadcastWin } from './modules/gameLogicManager.js';

let currentTeamName = null;
let challengeState = {
    zoneId: null,
    questionId: null,
    attemptsLeft: 3
};


// --- THIS IS THE FULLY UPGRADED CHAT & BROADCAST SYSTEM ---
function setupPlayerChatAndBroadcasts(teamName) {
    const chatLog = document.getElementById('team-chat-log');
    const opponentsTbody = document.getElementById('opponents-tbody');
    if (!chatLog || !opponentsTbody) return;

    // --- Part 1: Set up the UI for sending messages to other teams ---
    opponentsTbody.innerHTML = '';
    const otherTeams = allTeams.filter(t => t.name !== teamName);
    otherTeams.forEach(team => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${team.name}</td>
            <td id="location-${team.name.replace(/\s/g, '')}">--</td>
            <td class="message-cell">
                <input type="text" class="chat-input" data-recipient-input="${team.name}" placeholder="Message...">
                <button class="send-btn" data-recipient="${team.name}">Send</button>
            </td>
        `;
        opponentsTbody.appendChild(row);
    });

    opponentsTbody.addEventListener('click', (event) => {
        if (event.target.classList.contains('send-btn')) {
            const recipientName = event.target.dataset.recipient;
            const input = document.querySelector(`input[data-recipient-input="${recipientName}"]`);
            const messageText = input.value.trim();
            if (messageText) {
                sendMessage(teamName, recipientName, messageText);
                input.value = '';
            }
        }
    });
    
    // --- Part 2: Listen for all relevant messages ---
    listenForMyMessages(teamName, chatLog);
}

async function sendMessage(sender, recipient, text) {
    const sortedNames = [sender, recipient].sort();
    const convoId = `${sortedNames[0].replace(/\s/g, '')}_${sortedNames[1].replace(/\s/g, '')}`;
    const messagesRef = collection(db, 'conversations', convoId, 'messages');
    
    try {
        await addDoc(messagesRef, {
            sender: sender,
            recipient: recipient,
            text: text,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

function listenForMyMessages(myTeamName, logBox) {
    // This requires Firestore indexes. Check console for links to create them if there are errors.
    const messagesRef = collectionGroup(db, 'messages');
    const sentQuery = query(messagesRef, where('sender', '==', myTeamName));
    const receivedQuery = query(messagesRef, where('recipient', '==', myTeamName));
    const broadcastQuery = query(collection(db, 'communications'), where('teamName', '==', 'Commissioner'));

    let allMessages = [];
    const messageIds = new Set();

    const updateLog = () => {
        allMessages.sort((a, b) => a.timestamp - b.timestamp);
        logBox.innerHTML = '';
        allMessages.forEach(msg => {
            const logEntry = document.createElement('p');
            if (msg.sender === "Commissioner") {
                // --- THIS IS THE ENHANCED STYLING FOR BROADCASTS ---
                logEntry.style.backgroundColor = '#3a3a24';
                logEntry.style.padding = '8px';
                logEntry.style.borderRadius = '5px';
                logEntry.style.margin = '5px 0';
                logEntry.innerHTML = `<strong style="color: #fdd835; font-size: 1.1em; text-transform: uppercase;">Broadcast:</strong> <span style="font-size: 1.1em; font-weight: bold;">${msg.text}</span>`;
            } else if (msg.sender === myTeamName) {
                logEntry.innerHTML = `<strong>You to ${msg.recipient}:</strong> ${msg.text}`;
            } else {
                logEntry.innerHTML = `<strong>From ${msg.sender}:</strong> ${msg.text}`;
            }
            logBox.appendChild(logEntry);
        });
        logBox.scrollTop = logBox.scrollHeight;
    };

    const processSnapshot = (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && !messageIds.has(change.doc.id)) {
                messageIds.add(change.doc.id);
                allMessages.push(change.doc.data());
            }
        });
        updateLog();
    };

    onSnapshot(sentQuery, processSnapshot);
    onSnapshot(receivedQuery, processSnapshot);
    onSnapshot(broadcastQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && !messageIds.has(change.doc.id)) {
                const data = change.doc.data();
                messageIds.add(change.doc.id);
                // We format broadcasts to look like private messages for simplicity
                allMessages.push({
                    sender: "Commissioner",
                    recipient: "ALL",
                    text: data.message,
                    timestamp: data.timestamp.toMillis()
                });
            }
        });
        updateLog();
    });
}


// --- MAIN APP INITIALIZATION ---
async function main() {
    loadTeamInfo();
    listenForGameUpdates();
    // Broadcasts and chat are now handled together
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
    if (!currentTeamName) { return; }
    
    const currentTeam = allTeams.find(team => team.name === currentTeamName);
    if (!currentTeam) { return; }

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
    
    // This single function now sets up all chat and broadcast listeners
    setupPlayerChatAndBroadcasts(currentTeamName);
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

function loadZones() {
    // ... (This function is correct) ...
}

// --- GAMEPLAY ACTIONS ---
// ... (All other functions are correct and complete) ...

