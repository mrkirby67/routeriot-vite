// ============================================================================
// File: /modules/zonesChallenge.js
// Purpose: Challenge + Question handling logic for player zones
// ============================================================================
import { db } from './config.js';
import { doc, getDoc, getDocs, collection, setDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { calculateDistance, validateAnswer } from './zonesUtils.js';
import { broadcastChallenge, broadcastWin, updateTeamLocation } from './zonesFirestore.js';
import { addPointsToTeam, updateControlledZones } from './scoreboardManager.js';

let currentTeamName = null;
let challengeState = { zoneId: null, questionId: null, attemptsLeft: 3 };

export function setTeamContext(teamName) {
  currentTeamName = teamName;
}

export async function displayZoneQuestions(zoneId, zoneName) {
  challengeState = { zoneId, questionId: null, attemptsLeft: 3 };
  const challengeBox = document.getElementById('challenge-box');
  if (!challengeBox) return;

  const zoneNameEl = document.getElementById('challenge-zone-name');
  const questionEl = document.getElementById('challenge-question');
  const answerArea = document.getElementById('challenge-answer-area');
  const submitBtn = document.getElementById('submit-answer-btn');

  zoneNameEl.textContent = `Challenge: ${zoneName}`;
  const snapshot = await getDocs(collection(db, "zones", zoneId, "questions"));

  if (snapshot.empty) {
    questionEl.textContent = "No questions found for this zone.";
    answerArea.innerHTML = '';
    return;
  }

  let questionData;
  snapshot.forEach(docSnap => {
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

export async function handleAnswerSubmit() {
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

    await updateTeamLocation(currentTeamName, zoneName);
    await broadcastWin(currentTeamName, zoneName);
    await setDoc(
      doc(db, "zones", zoneId),
      { status: "Taken", controllingTeam: currentTeamName },
      { merge: true }
    );
    await addPointsToTeam(currentTeamName, points);
    await updateControlledZones(currentTeamName, zoneName);
    document.getElementById('challenge-box').style.display = 'none';
  } else {
    challengeState.attemptsLeft--;
    alert(challengeState.attemptsLeft > 0
      ? `Incorrect. ${challengeState.attemptsLeft} attempt(s) left.`
      : "Incorrect. Out of attempts. Time for a PitStop!"
    );
    if (challengeState.attemptsLeft <= 0)
      document.getElementById('challenge-box').style.display = 'none';
  }
}