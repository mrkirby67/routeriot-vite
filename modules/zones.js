// ============================================================================
// MODULE: zones.js  (Patched & Hardened • updates teamStatus for last location)
// ============================================================================
import { db, firebaseConfig } from './config.js';
import {
  doc,
  onSnapshot,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addPointsToTeam, updateControlledZones } from './scoreboardManager.js';

/* ---------------------------------------------------------------------------
 * LOCAL STATE
 * ------------------------------------------------------------------------ */
let currentTeamName = null;
let zonesLocked = true;
let gameStarted = false;
let challengeState = { zoneId: null, questionId: null, attemptsLeft: 3 };

/* ---------------------------------------------------------------------------
 * UTILS
 * ------------------------------------------------------------------------ */
function waitForElement(id, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const el = document.getElementById(id);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.getElementById(id);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => reject(`Timeout waiting for #${id}`), timeout);
  });
}

function flashPlayerLocation(text) {
  const el = document.getElementById('player-location');
  if (!el) return;
  el.textContent = text;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 800);
}

/* ---------------------------------------------------------------------------
 * FIRESTORE EVENT HELPERS
 * ------------------------------------------------------------------------ */
async function broadcastEvent(teamName, message) {
  try {
    await addDoc(collection(db, "communications"), {
      teamName,            // 👈 keep the sender for chat rendering
      message,
      isBroadcast: true,   // 👈 helpful flag for renderers
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error("Broadcast error:", e);
  }
}

const broadcastChallenge = (teamName, zoneName) =>
  broadcastEvent(teamName, `is challenging ${zoneName}!`);

const broadcastWin = (teamName, zoneName) =>
  broadcastEvent(teamName, `** has captured ${zoneName}! **`);

async function updateTeamLocation(teamName, zoneName) {
  try {
    await setDoc(
      doc(db, "teamStatus", teamName),
      { lastKnownLocation: zoneName, timestamp: serverTimestamp() },
      { merge: true }
    );
    // Optimistic UI update so players see it immediately
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    flashPlayerLocation(`📍 ${zoneName} (updated ${timeStr})`);
  } catch (e) {
    console.error("updateTeamLocation error:", e);
  }
}

/* ---------------------------------------------------------------------------
 * COUNTDOWN + GAME START VISUAL
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
  setTimeout(() => (banner.style.display = 'none'), 2000);
}

async function playRaceStartSequence() {
  if (gameStarted) return;
  gameStarted = true;

  const steps = ['3', '2', '1', 'GO!'];
  for (let i = 0; i < steps.length; i++) {
    const color = steps[i] === 'GO!' ? '#2E7D32' : '#C62828';
    showCountdownBanner(steps[i], color);
    await new Promise((r) => setTimeout(r, 1000));
  }

  showCountdownBanner('🏁 The Race is ON! 🏁', '#1565C0');
  await broadcastEvent('System', '🏁 The Race is ON! 🏁');
}

/* ---------------------------------------------------------------------------
 * DISTANCE & VALIDATION HELPERS
 * ------------------------------------------------------------------------ */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
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
      return cAns.split(',').map((s) => s.trim()).includes(pAns);
    default:
      return pAns.length > 0;
  }
}

/* ---------------------------------------------------------------------------
 * MAP HELPERS
 * ------------------------------------------------------------------------ */
function calculateZoomLevel(diameterKm, imageWidthPixels = 150) {
  const GLOBE_WIDTH = 256;
  const angle = (diameterKm / 6371) * (180 / Math.PI) * 2;
  const zoom = Math.floor(Math.log2(imageWidthPixels * 360 / angle / GLOBE_WIDTH));
  return Math.max(8, Math.min(18, zoom));
}

function encodeCircle(centerStr, radius) {
  try {
    if (!window.google?.maps?.geometry) return "";
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
      points.map((p) => new google.maps.LatLng(p[0], p[1]))
    );
  } catch (e) {
    console.warn("Could not encode circle:", e);
    return "";
  }
}

function generateMiniMap(zoneData) {
  if (!firebaseConfig.apiKey) {
    return `<img src="https://placehold.co/150x150/5d1c1c/ffffff?text=Missing+API+Key" class="mini-map">`;
  }

  const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
  if (!zoneData?.gps || !gpsRegex.test(zoneData.gps)) {
    return `<img src="https://placehold.co/150x150/1e1e1e/555?text=Invalid+GPS" class="mini-map">`;
  }

  const [lat, lng] = zoneData.gps.split(',').map((n) => parseFloat(n.trim()));
  if (isNaN(lat) || isNaN(lng)) {
    return `<img src="https://placehold.co/150x150/1e1e1e/555?text=Invalid+GPS" class="mini-map">`;
  }

  const statusClass = zoneData.status === 'Taken' ? 'status-taken' : 'status-available';
  const diameterKm = parseFloat(zoneData.diameter) || 0.05;
  const zoomLevel = calculateZoomLevel(diameterKm);
  const radiusInMeters = (diameterKm / 2) * 1000;

  let circlePath = '';
  try {
    if (window.google?.maps?.geometry) {
      circlePath = `path=fillcolor:0xAA000033|weight:2|color:0xFF0000FF|enc:${encodeCircle(`${lat},${lng}`, radiusInMeters)}`;
    }
  } catch (e) {
    console.warn("Geometry not ready — skipping circle overlay:", e);
  }

  const mapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=${zoomLevel}&size=150x150&maptype=satellite` +
    `&markers=color:red%7C${lat},${lng}` +
    `&${circlePath}&key=${firebaseConfig.apiKey}`;

  return `<img src="${mapUrl}" class="mini-map ${statusClass}" alt="Map preview of ${zoneData.name}">`;
}

/* ---------------------------------------------------------------------------
 * MAIN EXPORT — Initialize Zones (Player Page)
 * ------------------------------------------------------------------------ */
export async function initializeZones(teamName) {
  currentTeamName = teamName;
  const tableBody = await waitForElement('player-zones-tbody');
  const zonesCollection = collection(db, "zones");

  // 🔹 Listen for game state changes (zone lock/unlock)
  onSnapshot(doc(db, "game", "gameState"), (gameSnap) => {
    const data = gameSnap.data();
    if (!data?.status) return;
    const previouslyLocked = zonesLocked;
    const newLocked = !(data.status === 'active' && data.zonesReleased);
    if (previouslyLocked && !newLocked) playRaceStartSequence();
    zonesLocked = newLocked;
  });

  // 🔹 Listen for zone updates
  onSnapshot(zonesCollection, (snapshot) => {
    tableBody.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const zone = docSnap.data();
      const zoneId = docSnap.id;
      const statusText =
        zone.status === 'Taken' && zone.controllingTeam
          ? `Controlled by ${zone.controllingTeam}`
          : 'Available';

    const locked = zonesLocked ? 'disabled' : '';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${zone.name || zoneId}</td>
        <td>${generateMiniMap(zone)}</td>
        <td>${statusText}</td>
        <td><button class="challenge-btn" data-zone-id="${zoneId}" ${locked}>
          ${zonesLocked ? 'Locked' : 'Challenge'}
        </button></td>
      `;
      tableBody.appendChild(row);
    });
  });

  if (!tableBody._listenerAttached) {
    tableBody.addEventListener('click', (e) => {
      if (e.target.classList.contains('challenge-btn') && !zonesLocked) {
        handleChallengeClick(e);
      }
    });
    tableBody._listenerAttached = true;
  }
}

/* ---------------------------------------------------------------------------
 * CHALLENGE LOGIC
 * ------------------------------------------------------------------------ */
async function displayZoneQuestions(zoneId, zoneName) {
  challengeState = { zoneId, questionId: null, attemptsLeft: 3 };
  const challengeBox = document.getElementById('challenge-box');
  if (!challengeBox) return;

  const zoneNameEl = document.getElementById('challenge-zone-name');
  const questionEl = document.getElementById('challenge-question');
  const answerArea = document.getElementById('challenge-answer-area');
  const submitBtn = document.getElementById('submit-answer-btn');

  zoneNameEl.textContent = `Challenge: ${zoneName}`;
  const questionsRef = collection(db, "zones", zoneId, "questions");
  const snapshot = await getDocs(questionsRef);

  if (snapshot.empty) {
    questionEl.textContent = "No questions found for this zone.";
    answerArea.innerHTML = '';
    return;
  }

  let questionData;
  snapshot.forEach((docSnap) => {
    if (docSnap.id.startsWith('unique')) {
      questionData = docSnap.data();
      challengeState.questionId = docSnap.id;
    }
  });

  if (questionData?.question) {
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
  const zoneDoc = await getDoc(doc(db, "zones", zoneId));
  if (!zoneDoc.exists()) return alert("Zone data not found.");

  const zoneData = zoneDoc.data();
  if (!zoneData.gps || !zoneData.diameter) {
    alert("Error: Zone data incomplete.");
    return;
  }

  const [targetLat, targetLng] = zoneData.gps.split(',').map(Number);
  const targetRadiusKm = (parseFloat(zoneData.diameter) || 0.05) / 2;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const playerLat = pos.coords.latitude;
      const playerLng = pos.coords.longitude;
      const accuracyKm = pos.coords.accuracy / 1000;
      const dist = calculateDistance(playerLat, playerLng, targetLat, targetLng);

      if (dist <= targetRadiusKm + accuracyKm) {
        alert("You're in the zone! Time to answer.");

        // ✅ Update last known location immediately using server time
        try {
          await setDoc(
            doc(db, "teamStatus", currentTeamName),
            { lastKnownLocation: zoneData.name, timestamp: serverTimestamp() },
            { merge: true }
          );
          const now = new Date();
          flashPlayerLocation(`📍 ${zoneData.name} (updated ${now.toLocaleTimeString()})`);
        } catch (e) {
          console.error("⚠️ Error updating lastKnownLocation:", e);
        }

        // ✅ Broadcast challenge event
        await broadcastChallenge(currentTeamName, zoneData.name);

        // ✅ Show questions
        displayZoneQuestions(zoneId, zoneData.name);
      } else {
        alert(`Getting warmer... ${Math.max(0, dist - targetRadiusKm).toFixed(3)} km to enter the zone.`);
      }
    },
    () => alert("Could not get your location. Enable location services.")
  );
}

async function handleAnswerSubmit() {
  const { zoneId, questionId, attemptsLeft } = challengeState;
  if (!zoneId || !questionId) return;

  const playerAnswer = document.getElementById('player-answer')?.value.trim();
  if (!playerAnswer) return alert("Please enter an answer.");

  const questionDoc = await getDoc(doc(db, "zones", zoneId, "questions", questionId));
  if (!questionDoc.exists()) return alert("Question data missing.");

  const questionData = questionDoc.data();
  const zoneDoc = await getDoc(doc(db, "zones", zoneId));
  const zoneName = zoneDoc.data().name || zoneId;
  const isCorrect = validateAnswer(playerAnswer, questionData.answer, questionData.type);

  if (isCorrect) {
    const points = attemptsLeft === 3 ? 10 : attemptsLeft === 2 ? 8 : 6;
    alert(`CORRECT! You captured ${zoneName} and earned ${points} points!`);

    // ✅ Ensure teamStatus is updated on capture as well
    await updateTeamLocation(currentTeamName, zoneName);

    await broadcastWin(currentTeamName, zoneName);
    await setDoc(
      doc(db, "zones", zoneId),
      { status: "Taken", controllingTeam: currentTeamName },
      { merge: true }
    );
    await addPointsToTeam(currentTeamName, points);
    await updateControlledZones(currentTeamName, zoneName);

    document.getElementById('challenge-box')?.style.setProperty('display', 'none');
  } else {
    challengeState.attemptsLeft--;
    if (challengeState.attemptsLeft > 0) {
      alert(`Incorrect. ${challengeState.attemptsLeft} attempt(s) left.`);
    } else {
      alert("Incorrect. Out of attempts. Time for a PitStop!");
      document.getElementById('challenge-box')?.style.setProperty('display', 'none');
    }
  }
}
