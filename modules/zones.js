// --- IMPORTS & GLOBAL VARIABLES ---
import { db, firebaseConfig } from './config.js';
import { doc, onSnapshot, collection, getDoc, getDocs, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addPointsToTeam, updateControlledZones } from './scoreboardManager.js';

// This needs to be exported so other modules can access it
export let challengeState = {
    zoneId: null,
    questionId: null,
    attemptsLeft: 3
};

// --- CORE LOADER ---
export function loadZones(currentTeamName) {
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
            button.addEventListener('click', (event) => handleChallengeClick(event, currentTeamName));
        });
    });
}

// --- GAMEPLAY ACTIONS ---
async function handleChallengeClick(event, currentTeamName) {
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
                displayZoneQuestions(zoneId, zoneData.name, currentTeamName);
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

async function handleAnswerSubmit(currentTeamName) {
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

// --- GAME LOGIC HELPERS ---
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

async function displayZoneQuestions(zoneId, zoneName, currentTeamName) {
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
            submitBtn.onclick = () => handleAnswerSubmit(currentTeamName);
        } else {
            questionEl.textContent = "No unique question found for this challenge.";
            answerArea.innerHTML = '';
        }
    }
    challengeBox.style.display = 'block';
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
