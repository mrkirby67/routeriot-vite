// ============================================================================
// PLAYER PAGE SCRIPT
// Synchronizes player view with Firestore game state & team data
// ============================================================================

import { db, firebaseConfig } from './modules/config.js';
import { allTeams } from './data.js';
import {
  doc, onSnapshot, collection, getDoc, getDocs, setDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addPointsToTeam, updateControlledZones } from './modules/scoreboardManager.js';
import { setupPlayerChat } from './modules/chatManager.js';
import { listenForGameStatus } from './modules/gameStateManager.js';
import { showCountdownBanner, showFlashMessage } from './modules/gameCountdown.js';

// ---------------------------------------------------------------------------
// LOCAL STATE
// ---------------------------------------------------------------------------
let currentTeamName = localStorage.getItem('teamName') || 'Unknown Team';
let challengeState = { zoneId: null, questionId: null, attemptsLeft: 3 };
let timerInterval = null;
let countdownShown = false;

// ---------------------------------------------------------------------------
// FIRESTORE COMMUNICATION HELPERS
// ---------------------------------------------------------------------------
async function broadcastEvent(teamName, message) {
  await addDoc(collection(db, "communications"), { teamName, message, timestamp: new Date() });
}
const broadcastChallenge = (team, zone) => broadcastEvent(team, `is challenging ${zone}!`);
const broadcastWin = (team, zone) => broadcastEvent(team, `** has captured ${zone}! **`);

async function updateTeamLocation(teamName, zoneName) {
  await setDoc(doc(db, "teamStatus", teamName),
    { lastKnownLocation: zoneName, timestamp: new Date() }, { merge: true });
}

// ---------------------------------------------------------------------------
// MAP HELPERS
// ---------------------------------------------------------------------------
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon)) / 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function validateAnswer(pAns, cAns, type) {
  pAns = pAns.toLowerCase().trim();
  cAns = (cAns || '').toLowerCase().trim();
  switch ((type || 'OPEN').toUpperCase()) {
    case 'YES': case 'Y': case 'TRUE': case 'NO': case 'N': case 'FALSE':
      return pAns === cAns;
    case 'CSV':
      return cAns.split(',').map(s => s.trim()).includes(pAns);
    default:
      return pAns.length > 0;
  }
}

function generateMiniMap(zoneData) {
  if (!firebaseConfig.apiKey)
    return `<img src="https://placehold.co/150x150/5d1c1c/fff?text=Missing+Key" class="mini-map">`;

  const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
  if (!zoneData?.gps || !gpsRegex.test(zoneData.gps))
    return `<img src="https://placehold.co/150x150/1e1e1e/555?text=Invalid+GPS" class="mini-map">`;

  const [lat, lng] = zoneData.gps.split(',').map(Number);
  const diameterKm = parseFloat(zoneData.diameter) || 0.05;
  const zoom = Math.max(8, Math.min(18, Math.floor(16 - Math.log2(diameterKm))));
  const mapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=${zoom}&size=150x150&maptype=satellite&markers=color:red%7C${lat},${lng}` +
    `&key=${firebaseConfig.apiKey}`;
  const taken = zoneData.status === 'Taken' ? 'status-taken' : 'status-available';
  return `<img src="${mapUrl}" class="mini-map ${taken}" alt="${zoneData.name}">`;
}

// ---------------------------------------------------------------------------
// MAIN INITIALIZATION
// ---------------------------------------------------------------------------
export async function initializePlayerPage() {
  // 🏁 Load team data
  const teamInfo = allTeams[currentTeamName] || {};
  document.getElementById('team-name').textContent = currentTeamName;
  document.getElementById('team-slogan').textContent = teamInfo.slogan || 'Ready to race!';
  const memberList = document.getElementById('team-member-list');
  if (teamInfo.members) {
    memberList.innerHTML = teamInfo.members.map(m => `<li>${m}</li>`).join('');
  } else {
    memberList.innerHTML = '<li>No members listed.</li>';
  }

  // 💬 Setup chat
  setupPlayerChat(currentTeamName);

  // 🗺️ Zones
  initializeZones(currentTeamName);

  // 🎮 Listen to global game state
  listenForGameStatus((state) => handleGameStateUpdate(state));
}

// ---------------------------------------------------------------------------
// GAME STATE REACTIONS
// ---------------------------------------------------------------------------
function handleGameStateUpdate(state) {
  const { status, zonesReleased, startTime } = state;
  const statusEl = document.getElementById('game-status');
  if (statusEl) statusEl.textContent = status.toUpperCase();

  switch (status) {
    case 'waiting':
      showFlashMessage('Waiting for host to start...', '#616161');
      clearTimer();
      break;

    case 'active':
      if (!countdownShown) {
        countdownShown = true;
        showCountdownBanner();
        showFlashMessage('The Race is ON!', '#2e7d32');
      }
      if (startTime) startTimer(startTime);
      break;

    case 'ended':
      clearTimer();
      showFlashMessage('🏁 Game Over! Return to base.', '#c62828', 4000);
      break;
  }
}

// ---------------------------------------------------------------------------
// TIMER LOGIC
// ---------------------------------------------------------------------------
function startTimer(startTime) {
  const timerEl = document.getElementById('player-timer');
  clearTimer();
  const start = new Date(startTime.seconds * 1000);

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
    const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    timerEl.textContent = `${hrs}:${mins}:${secs}`;
  }, 1000);
}

function clearTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  const timerEl = document.getElementById('player-timer');
  if (timerEl) timerEl.textContent = '--:--:--';
}

// ---------------------------------------------------------------------------
// ZONES (real-time Firestore listener)
// ---------------------------------------------------------------------------
function initializeZones(teamName) {
  const zonesCol = collection(db, "zones");
  const tbody = document.getElementById('player-zones-tbody');

  onSnapshot(zonesCol, (snap) => {
    tbody.innerHTML = '';
    snap.forEach(docSnap => {
      const zone = docSnap.data();
      const zoneId = docSnap.id;
      const taken = zone.status === 'Taken' && zone.controllingTeam;
      const status = taken ? `Controlled by ${zone.controllingTeam}` : 'Available';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${zone.name || zoneId}</td>
        <td>${generateMiniMap(zone)}</td>
        <td>${status}</td>
        <td><button class="challenge-btn" data-zone-id="${zoneId}">Challenge</button></td>`;
      tbody.appendChild(row);
    });
    tbody.querySelectorAll('.challenge-btn').forEach(b =>
      b.addEventListener('click', handleChallengeClick)
    );
  });
}

// ---------------------------------------------------------------------------
// CHALLENGE LOGIC
// ---------------------------------------------------------------------------
async function handleChallengeClick(e) {
  const zoneId = e.target.dataset.zoneId;
  const zoneDoc = await getDoc(doc(db, "zones", zoneId));
  if (!zoneDoc.exists()) return alert("Zone not found!");
  const zone = zoneDoc.data();
  const [lat, lng] = zone.gps.split(',').map(Number);
  const radiusKm = (parseFloat(zone.diameter) || 0.05) / 2;

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude, accuracy } = pos.coords;
    const distance = calculateDistance(latitude, longitude, lat, lng);
    const accKm = accuracy / 1000;
    if (distance <= radiusKm + accKm) {
      alert("You're in the zone! You have 3 tries.");
      broadcastChallenge(currentTeamName, zone.name);
      updateTeamLocation(currentTeamName, zone.name);
      displayZoneQuestions(zoneId, zone.name);
    } else {
      alert(`Getting warmer... ${(distance - radiusKm).toFixed(3)} km away.`);
    }
  }, () => alert("Location services unavailable."));
}

async function displayZoneQuestions(zoneId, zoneName) {
  challengeState = { zoneId, questionId: null, attemptsLeft: 3 };
  const box = document.getElementById('challenge-box');
  const qEl = document.getElementById('challenge-question');
  const aEl = document.getElementById('challenge-answer-area');
  const btn = document.getElementById('submit-answer-btn');
  document.getElementById('challenge-zone-name').textContent = `Challenge: ${zoneName}`;

  const qsRef = collection(db, "zones", zoneId, "questions");
  const qsSnap = await getDocs(qsRef);
  if (qsSnap.empty) { qEl.textContent = "No questions found."; aEl.innerHTML = ''; return; }

  let qData;
  qsSnap.forEach(doc => {
    if (doc.id.startsWith('unique')) {
      qData = doc.data();
      challengeState.questionId = doc.id;
    }
  });

  if (qData?.question) {
    qEl.textContent = qData.question;
    aEl.innerHTML = `<input type="text" id="player-answer" placeholder="Your answer here...">`;
    btn.onclick = () => handleAnswerSubmit();
  }
  box.style.display = 'block';
}

async function handleAnswerSubmit() {
  const { zoneId, questionId, attemptsLeft } = challengeState;
  const ans = document.getElementById('player-answer').value.trim();
  if (!ans) return alert("Enter an answer.");

  const qDoc = await getDoc(doc(db, "zones", zoneId, "questions", questionId));
  const qData = qDoc.data();
  const zoneDoc = await getDoc(doc(db, "zones", zoneId));
  const zoneName = zoneDoc.data().name;
  const correct = validateAnswer(ans, qData.answer, qData.type);

  if (correct) {
    const pts = attemptsLeft === 3 ? 10 : attemptsLeft === 2 ? 8 : 6;
    alert(`✅ CORRECT! You captured ${zoneName} and earned ${pts} points!`);
    await broadcastWin(currentTeamName, zoneName);
    await setDoc(doc(db, "zones", zoneId), { status: "Taken", controllingTeam: currentTeamName }, { merge: true });
    await addPointsToTeam(currentTeamName, pts);
    await updateControlledZones(currentTeamName, zoneName);
    document.getElementById('challenge-box').style.display = 'none';
  } else {
    challengeState.attemptsLeft--;
    if (challengeState.attemptsLeft > 0)
      alert(`❌ Incorrect. ${challengeState.attemptsLeft} attempt(s) left.`);
    else {
      alert("❌ Out of attempts — PitStop!");
      document.getElementById('challenge-box').style.display = 'none';
    }
  }
}

// ---------------------------------------------------------------------------
// AUTO-INIT
// ---------------------------------------------------------------------------
initializePlayerPage();