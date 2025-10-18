// File: modules/zones.js
import { db, firebaseConfig } from './config.js';
import { allTeams } from '../data.js';
import {
  doc, onSnapshot, collection, getDoc, getDocs, setDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addPointsToTeam, updateControlledZones } from './scoreboardManager.js';

/* ---------------------------------------------------------------------------
 *  LOCAL STATE
 * ------------------------------------------------------------------------ */
let currentTeamName = null;
let zonesLocked = true;
let gameStarted = false;
let challengeState = {
  zoneId: null,
  questionId: null,
  attemptsLeft: 3
};

/* ---------------------------------------------------------------------------
 *  FIRESTORE EVENT HELPERS
 * ------------------------------------------------------------------------ */
async function broadcastEvent(teamName, message) {
  await addDoc(collection(db, "communications"), {
    teamName,
    message,
    timestamp: new Date()
  });
}

const broadcastChallenge = (teamName, zoneName) =>
  broadcastEvent(teamName, `is challenging ${zoneName}!`);

const broadcastWin = (teamName, zoneName) =>
  broadcastEvent(teamName, `** has captured ${zoneName}! **`);

async function updateTeamLocation(teamName, zoneName) {
  await setDoc(doc(db, "teamStatus", teamName), {
    lastKnownLocation: zoneName,
    timestamp: new Date()
  }, { merge: true });
}

/* ---------------------------------------------------------------------------
 *  COUNTDOWN + GAME START VISUAL
 * ------------------------------------------------------------------------ */
function showCountdownBanner(message, color = '#222') {
  let banner = document.getElementById('game-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'game-banner';
    banner.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      background: ${color};
      color: white;
      padding: 30px 50px;
      border-radius: 12px;
      font-size: 3em;
      font-weight: bold;
      text-align: center;
      z-index: 9999;
      box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(banner);
  }
  banner.style.background = color;
  banner.textContent = message;
  banner.style.display = 'block';
  setTimeout(() => banner.style.display = 'none', 2000);
}

async function playRaceStartSequence() {
  if (gameStarted) return; // avoid duplicates
  gameStarted = true;

  const steps = ['3', '2', '1', 'GO!'];
  for (let i = 0; i < steps.length; i++) {
    const color = steps[i] === 'GO!' ? '#2E7D32' : '#C62828';
    showCountdownBanner(steps[i], color);
    await new Promise(r => setTimeout(r, 1000));
  }

  showCountdownBanner('🏁 The Race is ON! 🏁', '#1565C0');
  await broadcastEvent('System', '🏁 The Race is ON! 🏁');
}

/* ---------------------------------------------------------------------------
 *  DISTANCE & VALIDATION HELPERS
 * ------------------------------------------------------------------------ */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon)) / 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function validateAnswer(playerAnswer, correctAnswer, type) {
  const pAns = playerAnswer.toLowerCase().trim();
  const cAns = (correctAnswer || '').toLowerCase().trim();
  switch ((type || 'OPEN').toUpperCase()) {
    case 'SET':
    case 'YES': case 'Y': case 'TRUE':
    case 'NO': case 'N': case 'FALSE':
      return pAns === cAns;
    case 'CSV':
      return cAns.split(',').map(s => s.trim()).includes(pAns);
    default:
      return pAns.length > 0;
  }
}

/* ---------------------------------------------------------------------------
 *  MAP HELPERS
 * ------------------------------------------------------------------------ */
function calculateZoomLevel(diameterKm, imageWidthPixels = 150) {
  const GLOBE_WIDTH = 256;
  const angle = diameterKm / 6371 * (180 / Math.PI) * 2;
  const zoom = Math.floor(Math.log2(imageWidthPixels * 360 / angle / GLOBE_WIDTH));
  return Math.max(8, Math.min(18, zoom));
}

function encodeCircle(centerStr, radius) {
  if (!window.google || !window.google.maps || !window.google.maps.geometry) {
    console.warn("Geometry library not ready — skipping encoded circle.");
    return "";
  }
  try {
    if (!centerStr) return '';
    const [lat, lng] = centerStr.split(',').map(Number);
    const R = 6371e3;
    const points = [];
    for (let i = 0; i <= 360; i += 10) {
      const d = radius;
      const brng = i * Math.PI / 180;
      const lat2 = Math.asin(
        Math.sin(lat * Math.PI / 180) * Math.cos(d / R) +
        Math.cos(lat * Math.PI / 180) * Math.sin(d / R) * Math.cos(brng)
      );
      const lng2 = (lng * Math.PI / 180) +
        Math.atan2(
          Math.sin(brng) * Math.sin(d / R) * Math.cos(lat * Math.PI / 180),
          Math.cos(d / R) - Math.sin(lat * Math.PI / 180) * Math.sin(lat2)
        );
      points.push([lat2 * 180 / Math.PI, lng2 * 180 / Math.PI]);
    }
    return google.maps.geometry.encoding.encodePath(
      points.map(p => new google.maps.LatLng(p[0], p[1]))
    );
  } catch (e) {
    console.error("Could not encode circle:", e);
    return "";
  }
}

function generateMiniMap(zoneData) {
  if (!firebaseConfig.apiKey) {
    return `<img src="https://placehold.co/150x150/5d1c1c/ffffff?text=Missing+API+Key" class="mini-map" alt="Key Error">`;
  }

  const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
  if (!zoneData || !zoneData.gps || !gpsRegex.test(zoneData.gps)) {
    return `<img src="https://placehold.co/150x150/1e1e1e/555?text=Invalid+GPS" class="mini-map">`;
  }

  const [lat, lng] = zoneData.gps.split(',').map(s => parseFloat(s.trim()));
  if (isNaN(lat) || isNaN(lng)) {
    return `<img src="https://placehold.co/150x150/1e1e1e/555?text=Invalid+GPS" class="mini-map">`;
  }

  const statusClass = (zoneData.status === 'Taken') ? 'status-taken' : 'status-available';
  const diameterKm = parseFloat(zoneData.diameter) || 0.05;
  const zoomLevel = calculateZoomLevel(diameterKm);
  const radiusInMeters = (diameterKm / 2) * 1000;
  const circlePath =
    (window.google && window.google.maps && window.google.maps.geometry)
      ? `path=fillcolor:0xAA000033|weight:2|color:0xFF0000FF|enc:${encodeCircle(`${lat},${lng}`, radiusInMeters)}`
      : '';

  const mapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=${zoomLevel}&size=150x150&maptype=satellite` +
    `&markers=color:red%7C${lat},${lng}` +
    `&${circlePath}&key=${firebaseConfig.apiKey}`;
  return `<img src="${mapUrl}" class="mini-map ${statusClass}" alt="Map preview of ${zoneData.name}">`;
}

/* ---------------------------------------------------------------------------
 *  MAIN EXPORT — Initialize Zones (Player Page)
 * ------------------------------------------------------------------------ */
export function initializeZones(teamName) {
  currentTeamName = teamName;
  const zonesCollection = collection(db, "zones");
  const tableBody = document.getElementById('player-zones-tbody');
  if (!tableBody) return;

  // Listen for game state to enable/disable zones + trigger countdown
  onSnapshot(doc(db, "game", "gameState"), (gameSnap) => {
    const data = gameSnap.data() || {};
    const previouslyLocked = zonesLocked;
    zonesLocked = !(data.status === 'active' && data.zonesReleased);

    if (!zonesLocked && previouslyLocked) {
      playRaceStartSequence();
    }
  });

  // Zones display and update
  onSnapshot(zonesCollection, (snapshot) => {
    tableBody.innerHTML = '';

    snapshot.forEach(docSnap => {
      const zone = docSnap.data();
      const zoneId = docSnap.id;
      const row = document.createElement('tr');

      let statusText = 'Available';
      if (zone.status === 'Taken' && zone.controllingTeam) {
        statusText = `Controlled by ${zone.controllingTeam}`;
      }

      const locked = zonesLocked ? 'disabled' : '';

      row.innerHTML = `
        <td>${zone.name || zoneId}</td>
        <td>${generateMiniMap(zone)}</td>
        <td>${statusText}</td>
        <td>
          <button class="challenge-btn" data-zone-id="${zoneId}" ${locked}>
            ${zonesLocked ? 'Locked' : 'Challenge'}
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Attach handlers only if game unlocked
    if (!zonesLocked) {
      document.querySelectorAll('.challenge-btn').forEach(btn => {
        btn.addEventListener('click', handleChallengeClick);
      });
    }
  });
}

/* ---------------------------------------------------------------------------
 *  CHALLENGE LOGIC
 * ------------------------------------------------------------------------ */
async function displayZoneQuestions(zoneId, zoneName) {
  challengeState = { zoneId, questionId: null, attemptsLeft: 3 };
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
    return;
  }

  let questionData;
  questionsSnapshot.forEach(docSnap => {
    if (docSnap.id.startsWith('unique')) {
      questionData = docSnap.data();
      challengeState.questionId = docSnap.id;
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
  challengeBox.style.display = 'block';
}

async function handleChallengeClick(event) {
  const zoneId = event.target.dataset.zoneId;
  const zoneRef = doc(db, "zones", zoneId);
  const zoneDoc = await getDoc(zoneRef);
  if (!zoneDoc.exists() || !zoneDoc.data().gps || !zoneDoc.data().diameter) {
    alert("Error: Zone data is incomplete.");
    return;
  }

  const zoneData = zoneDoc.data();
  const [targetLat, targetLng] = zoneData.gps.split(',').map(Number);
  const targetRadiusKm = (parseFloat(zoneData.diameter) || 0.05) / 2;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const playerLat = position.coords.latitude;
      const playerLng = position.coords.longitude;
      const accuracyInKm = position.coords.accuracy / 1000;
      const distanceToCenter = calculateDistance(playerLat, playerLng, targetLat, targetLng);

      if (distanceToCenter <= targetRadiusKm + accuracyInKm) {
        alert("You're in the zone! Time to answer the question. You have 3 tries.");
        broadcastChallenge(currentTeamName, zoneData.name);
        updateTeamLocation(currentTeamName, zoneData.name);
        displayZoneQuestions(zoneId, zoneData.name);
      } else {
        const distanceToEdge = distanceToCenter - targetRadiusKm;
        alert(`Getting warmer... ${distanceToEdge.toFixed(3)} KM to be in the zone.`);
      }
    },
    () => alert("Could not get your location. Please enable location services.")
  );
}

async function handleAnswerSubmit() {
  const { zoneId, questionId, attemptsLeft } = challengeState;
  if (!zoneId || !questionId) return;
  const playerAnswer = document.getElementById('player-answer').value.trim();
  if (!playerAnswer) return alert("Please enter an answer.");

  const questionRef = doc(db, "zones", zoneId, "questions", questionId);
  const questionDoc = await getDoc(questionRef);
  if (!questionDoc.exists()) return alert("Error: Could not find question data.");

  const questionData = questionDoc.data();
  const zoneDoc = await getDoc(doc(db, "zones", zoneId));
  const zoneName = zoneDoc.data().name;
  const isCorrect = validateAnswer(playerAnswer, questionData.answer, questionData.type);

  if (isCorrect) {
    const points = (attemptsLeft === 3) ? 10 : (attemptsLeft === 2) ? 8 : 6;
    alert(`CORRECT! You captured ${zoneName} and earned ${points} points!`);

    await broadcastWin(currentTeamName, zoneName);
    await setDoc(doc(db, "zones", zoneId),
      { status: "Taken", controllingTeam: currentTeamName },
      { merge: true });
    await addPointsToTeam(currentTeamName, points);
    await updateControlledZones(currentTeamName, zoneName);
    document.getElementById('challenge-box').style.display = 'none';
  } else {
    challengeState.attemptsLeft--;
    if (challengeState.attemptsLeft > 0) {
      alert(`Incorrect. You have ${challengeState.attemptsLeft} attempt(s) left.`);
    } else {
      alert("Incorrect. You are out of attempts for this zone. Time for a PitStop!");
      document.getElementById('challenge-box').style.display = 'none';
    }
  }
}