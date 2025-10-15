// --- IMPORTS & GLOBAL VARIABLES ---
import { db, firebaseConfig } from './modules/config.js';
import { allTeams } from './data.js';
import { doc, onSnapshot, collection, query, where, getDoc, getDocs, setDoc, addDoc, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { loadGoogleMapsApi } from './modules/googleMapsLoader.js';
import { addPointsToTeam, updateControlledZones } from './modules/scoreboardManager.js';

let currentTeamName = null;
let challengeState = {
    zoneId: null,
    questionId: null,
    attemptsLeft: 3
};


// --- CHAT & BROADCAST SYSTEM ---
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
            const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (msg.sender === "Commissioner") {
                logEntry.style.backgroundColor = '#3a3a24';
                logEntry.style.padding = '8px';
                logEntry.style.borderRadius = '5px';
                logEntry.style.margin = '5px 0';
                logEntry.innerHTML = `<span style="color: #aaa; margin-right: 8px;">[${timestamp}]</span> <strong style="color: #fdd835; font-size: 1.1em; text-transform: uppercase;">Broadcast:</strong> <span style="font-size: 1.1em; font-weight: bold;">${msg.text}</span>`;
            } else if (msg.sender === myTeamName) {
                logEntry.innerHTML = `<span style="color: #aaa; margin-right: 8px;">[${timestamp}]</span> <strong>You to ${msg.recipient}:</strong> ${msg.text}`;
            } else {
                logEntry.innerHTML = `<span style="color: #aaa; margin-right: 8px;">[${timestamp}]</span> <strong>From ${msg.sender}:</strong> ${msg.text}`;
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
    try {
        await loadGoogleMapsApi();
        loadZones();
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
    const zonesCollection = collection(db, "zones");
    const tableBody = document.getElementById('player-zones-tbody');
    if (!tableBody) return;

    onSnapshot(zonesCollection, (snapshot) => {
        tableBody.innerHTML = '';
        snapshot.forEach(doc => {
            const zone = doc.data();
            const zoneId = doc.id;
            const row = document.createElement('tr');
            
            let statusText = 'Available';
            if (zone.status === 'Taken' && zone.controllingTeam) {
                statusText = `Controlled by ${zone.controllingTeam}`;
            }

            row.innerHTML = `
                <td>${zone.name || zoneId}</td>
                <td>${generateMiniMap(zone)}</td>
                <td>${statusText}</td>
                <td><button class="challenge-btn" data-zone-id="${zoneId}">Challenge</button></td>
            `;
            tableBody.appendChild(row);
        });
        
        document.querySelectorAll('.challenge-btn').forEach(button => {
            button.addEventListener('click', handleChallengeClick);
        });
    });
}

// --- GAMEPLAY ACTIONS ---
async function handleChallengeClick(event) {
    const zoneId = event.target.dataset.zoneId;
    const zoneRef = doc(db, "zones", zoneId);
    const zoneDoc = await getDoc(zoneRef);
    if (!zoneDoc.exists() || !zoneDoc.data().gps || !zoneDoc.data().diameter) {
        alert("Error: Zone data is incomplete. Please set GPS and Diameter on the Control Page.");
        return;
    }
    const zoneData = zoneDoc.data();
    const targetDiameterKm = parseFloat(zoneData.diameter);
    const targetRadiusKm = targetDiameterKm / 2;
    const [targetLat, targetLng] = zoneData.gps.split(',').map(Number);

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const playerLat = position.coords.latitude;
            const playerLng = position.coords.longitude;
            const distanceToCenter = calculateDistance(playerLat, playerLng, targetLat, targetLng);
            
            if (distanceToCenter <= targetRadiusKm) {
                alert("Time to answer the question! You have 3 tries before a PitStop to cool your engines.");
                broadcastChallenge(currentTeamName, zoneData.name);
                updateTeamLocation(currentTeamName, zoneData.name);
                displayZoneQuestions(zoneId, zoneData.name);
            } else {
                const distanceToEdge = distanceToCenter - targetRadiusKm;
                alert(`Getting warmer... ${distanceToEdge.toFixed(3)} KM to be in the zone.`);
            }
        },
        () => { 
            alert("Could not get your location. Please enable location services in your browser."); 
        }
    );
}

async function handleAnswerSubmit() {
    const { zoneId, questionId, attemptsLeft } = challengeState;
    if (!zoneId || !questionId) return;
    const playerAnswer = document.getElementById('player-answer').value.trim();
    if (!playerAnswer) {
        alert("Please enter an answer.");
        return;
    }
    const questionRef = doc(db, "zones", zoneId, "questions", questionId);
    const questionDoc = await getDoc(questionRef);
    if (!questionDoc.exists()) {
        alert("Error: Could not find question data.");
        return;
    }
    const questionData = questionDoc.data();
    const zoneName = (await getDoc(doc(db, "zones", zoneId))).data().name;
    const isCorrect = validateAnswer(playerAnswer, questionData.answer, questionData.type);

    if (isCorrect) {
        let points = 0;
        if (attemptsLeft === 3) points = 10;
        else if (attemptsLeft === 2) points = 8;
        else if (attemptsLeft === 1) points = 6;
        
        alert(`CORRECT! You have captured the zone and earned ${points} points!`);
        
        await broadcastWin(currentTeamName, zoneName);
        const zoneRef = doc(db, "zones", zoneId);
        await setDoc(zoneRef, { status: "Taken", controllingTeam: currentTeamName }, { merge: true });
        await addPointsToTeam(currentTeamName, points);
        await updateControlledZones(currentTeamName, zoneName);
        document.getElementById('challenge-box').style.display = 'none';
    } else {
        challengeState.attemptsLeft--;
        if (challengeState.attemptsLeft > 0) {
            alert(`Incorrect. You have ${challengeState.attemptsLeft} attempt(s) left.`);
        } else {
            alert("Incorrect. You are out of attempts. Time for a PitStop!");
            document.getElementById('challenge-box').style.display = 'none';
        }
    }
}

function validateAnswer(playerAnswer, correctAnswer, type) {
    const pAns = playerAnswer.toLowerCase();
    const cAns = (correctAnswer || '').toLowerCase();
    switch((type || 'OPEN').toUpperCase()) {
        case 'SET':
        case 'YES':
        case 'TRUE OR FALSE':
        case 'TRUE/FALSE':
            return pAns === cAns;
        case 'CSV':
            return cAns.split(',').map(s => s.trim()).includes(pAns);
        case 'OPEN':
        default:
            return pAns.length > 0;
    }
}

// --- HELPER FUNCTIONS ---

// --- THESE FUNCTIONS HAVE BEEN RESTORED ---
async function broadcastEvent(teamName, message) {
    const commsRef = collection(db, "communications");
    await addDoc(commsRef, {
        teamName: teamName,
        message: message,
        timestamp: new Date()
    });
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

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 0.5 - Math.cos(dLat) / 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

async function displayZoneQuestions(zoneId, zoneName) {
    challengeState = { zoneId: zoneId, questionId: null, attemptsLeft: 3 };
    const challengeBox = document.getElementById('challenge-box');
    const zoneNameEl = document.getElementById('challenge-zone-name');
    const questionEl = document.getElementById('challenge-question');
    const answerArea = document.getElementById('challenge-answer-area');
    const submitBtn = document.getElementById('submit-answer-btn');
    zoneNameEl.textContent = `Challenge: ${zoneName}`;
    const questionsRef = collection(db, "zones", zoneId, "questions");
    const questionsSnapshot = await getDocs(questionsRef);

    if (questionsSnapshot.empty) {
        questionEl.textContent = "No questions found for this zone.";
        answerArea.innerHTML = '';
    } else {
        let questionData;
        questionsSnapshot.forEach(doc => {
            if (doc.id.startsWith('unique')) {
                questionData = doc.data();
                challengeState.questionId = doc.id;
            }
        });
        if (questionData && questionData.question) {
            questionEl.textContent = questionData.question;
            answerArea.innerHTML = `<input type="text" id="player-answer" placeholder="Your answer here...">`;
            submitBtn.onclick = () => handleAnswerSubmit();
        } else {
            questionEl.textContent = "No unique question found for this challenge.";
            answerArea.innerHTML = '';
        }
    }
    challengeBox.style.display = 'block';
}

function listenForBroadcasts() {
    const broadcastRef = doc(db, "game", "broadcast");
    const messageDisplay = document.getElementById('commissioner-message');
    onSnapshot(broadcastRef, (doc) => {
        if (doc.exists() && doc.data().message) {
            const data = doc.data();
            const formattedTime = new Date(data.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            messageDisplay.textContent = `[${formattedTime}] Message from the Commissioner: ${data.message}`;
            messageDisplay.style.display = 'block';
        } else {
            messageDisplay.style.display = 'none';
        }
    });
}

// --- MAP & VISUAL HELPERS ---
function calculateZoomLevel(diameterKm, imageWidthPixels = 150) {
    const GLOBE_WIDTH = 256;
    const angle = diameterKm / 6371 * (180 / Math.PI) * 2;
    const zoom = Math.floor(Math.log2(imageWidthPixels * 360 / angle / GLOBE_WIDTH));
    return Math.max(8, Math.min(18, zoom));
}

function generateMiniMap(zoneData) {
    const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
    if (!zoneData || !zoneData.gps || !gpsRegex.test(zoneData.gps)) {
        return `<img src="https://placehold.co/150x150/1e1e1e/555?text=Invalid+GPS" class="mini-map">`;
    }
    const statusClass = (zoneData.status === 'Taken') ? 'status-taken' : 'status-available';
    const diameterKm = parseFloat(zoneData.diameter) || 0.05;
    const zoomLevel = calculateZoomLevel(diameterKm);
    const radiusInMeters = (diameterKm / 2) * 1000;
    const circlePath = `path=fillcolor:0xAA000033|weight:2|color:0xFF0000FF|enc:${encodeCircle(zoneData.gps, radiusInMeters)}`;
    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${zoneData.gps}&zoom=${zoomLevel}&size=150x150&maptype=satellite&markers=color:red%7C${zoneData.gps}&${circlePath}&key=${firebaseConfig.apiKey}`;
    return `<img src="${mapUrl}" class="mini-map ${statusClass}" alt="Map preview of ${zoneData.name}">`;
}

function encodeCircle(centerStr, radius) {
    if (!window.google || !window.google.maps.geometry) {
        console.error("Could not encode circle. Google Maps Geometry library is not loaded yet.");
        return "";
    }
    try {
        if (!centerStr) return '';
        const center = centerStr.split(',').map(Number);
        let [lat, lng] = center;
        const R = 6371e3;
        let points = [];
        for (let i = 0; i <= 360; i += 10) {
            const d = radius;
            const brng = i * Math.PI / 180;
            let lat2 = Math.asin(Math.sin(lat * Math.PI / 180) * Math.cos(d / R) + Math.cos(lat * Math.PI / 180) * Math.sin(d / R) * Math.cos(brng));
            let lng2 = (lng * Math.PI / 180) + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat * Math.PI / 180), Math.cos(d / R) - Math.sin(lat * Math.PI / 180) * Math.sin(lat2));
            points.push([lat2 * 180 / Math.PI, lng2 * 180 / Math.PI]);
        }
        return google.maps.geometry.encoding.encodePath(points.map(p => new google.maps.LatLng(p[0], p[1])));
    } catch (e) {
        console.error("Could not encode circle:", e);
        return "";
    }
}

