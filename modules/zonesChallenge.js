// ============================================================================
// FILE: /modules/zonesChallenge.js
// PURPOSE: Challenge + Question handling logic for player zones
// ============================================================================
import { db } from './config.js';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { calculateDistance, validateAnswer } from './zonesUtils.js';
import { broadcastChallenge, broadcastWin, updateTeamLocation } from './zonesFirestore.js';
import { addPointsToTeam, updateControlledZones } from './scoreboardManager.js';
import { allTeams } from '../data.js';

// ---------------------------------------------------------------------------
// 🧭 Context State
// ---------------------------------------------------------------------------
let currentTeamName = null;
let challengeState = { zoneId: null, questionId: null, attemptsLeft: 3 };

export function setTeamContext(teamName) {
  currentTeamName = allTeams.find(t => t.name === teamName)?.name || teamName;
  console.log(`🎯 Team context set for challenges: ${currentTeamName}`);
}

// ---------------------------------------------------------------------------
// 🎮 DISPLAY CHALLENGE QUESTIONS
// ---------------------------------------------------------------------------
export async function displayZoneQuestions(zoneId, zoneName) {
  challengeState = { zoneId, questionId: null, attemptsLeft: 3 };
  const challengeBox = document.getElementById('challenge-box');
  if (!challengeBox) return;

  const zoneNameEl = document.getElementById('challenge-zone-name');
  const questionEl = document.getElementById('challenge-question');
  const answerArea = document.getElementById('challenge-answer-area');
  const submitBtn = document.getElementById('submit-answer-btn');

  zoneNameEl.textContent = `Challenge: ${zoneName}`;

  const snapshot = await getDocs(collection(db, 'zones', zoneId, 'questions'));
  if (snapshot.empty) {
    questionEl.textContent = 'No questions found for this zone.';
    answerArea.innerHTML = '';
    return;
  }

  // Grab the first valid question document (or "unique" one)
  let questionData;
  snapshot.forEach(docSnap => {
    if (docSnap.id.startsWith('unique') && !questionData) {
      questionData = docSnap.data();
      challengeState.questionId = docSnap.id;
    }
  });

  if (questionData?.question) {
    questionEl.textContent = questionData.question;
    answerArea.innerHTML = `<input type="text" id="player-answer" placeholder="Your answer here...">`;
    submitBtn.onclick = () => handleAnswerSubmit();
  } else {
    questionEl.textContent = 'No unique question found for this challenge.';
    answerArea.innerHTML = '';
  }

  challengeBox.style.display = 'block';
  await broadcastChallenge(currentTeamName, zoneName);
  console.log(`⚔️ ${currentTeamName} started a challenge in ${zoneName}`);
}

// ---------------------------------------------------------------------------
// 🧩 HANDLE ANSWER SUBMISSION
// ---------------------------------------------------------------------------
export async function handleAnswerSubmit() {
  const { zoneId, questionId, attemptsLeft } = challengeState;
  if (!zoneId || !questionId) return;

  const playerAnswer = document.getElementById('player-answer')?.value.trim();
  if (!playerAnswer) return alert('Please enter an answer.');

  const questionDoc = await getDoc(doc(db, 'zones', zoneId, 'questions', questionId));
  if (!questionDoc.exists()) return alert('Question data missing.');

  const questionData = questionDoc.data();
  const zoneDoc = await getDoc(doc(db, 'zones', zoneId));
  const zoneName = zoneDoc.data().name || zoneId;

  const isCorrect = validateAnswer(playerAnswer, questionData.answer, questionData.type);

  // ✅ CORRECT ANSWER
  if (isCorrect) {
    const points = attemptsLeft === 3 ? 10 : attemptsLeft === 2 ? 8 : 6;
    alert(`✅ CORRECT! You captured ${zoneName} and earned ${points} points!`);

    // 1️⃣ Update live Firestore data
    await updateTeamLocation(currentTeamName, zoneName);
    await broadcastWin(currentTeamName, zoneName);

    // 2️⃣ Mark zone as captured
    await setDoc(
      doc(db, 'zones', zoneId),
      {
        status: 'Taken',
        controllingTeam: currentTeamName,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    // 3️⃣ Score + controlled zone updates
    await addPointsToTeam(currentTeamName, points);
    await updateControlledZones(currentTeamName, zoneName);

    // 4️⃣ UI feedback
    document.getElementById('challenge-box').style.display = 'none';
    console.log(`🏁 ${currentTeamName} captured ${zoneName} (+${points} pts).`);
  }

  // ❌ INCORRECT ANSWER
  else {
    challengeState.attemptsLeft--;
    if (challengeState.attemptsLeft > 0) {
      alert(`❌ Incorrect. ${challengeState.attemptsLeft} attempt(s) left.`);
    } else {
      alert('😓 Out of attempts. Time for a PitStop!');
      document.getElementById('challenge-box').style.display = 'none';
    }
  }
}