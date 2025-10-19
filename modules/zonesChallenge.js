// ============================================================================
// FILE: /modules/zonesChallenge.js
// PURPOSE: Inline Challenge + Question handling logic for player zones
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

import { validateAnswer } from './zonesUtils.js';
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
// 🎮 DISPLAY CHALLENGE QUESTIONS INLINE (UNDER ZONE)
// ---------------------------------------------------------------------------
export async function displayZoneQuestions(zoneId, zoneName) {
  challengeState = { zoneId, questionId: null, attemptsLeft: 3 };

  // 🧱 Find the zone row
  const zoneRow = document.querySelector(`[data-zone-id="${zoneId}"]`);
  if (!zoneRow) {
    console.warn(`⚠️ Zone row not found for ${zoneId}`);
    return;
  }

  // 🔄 Remove any existing inline blocks for this zone
  const existing = document.getElementById(`inline-question-${zoneId}`);
  if (existing) existing.remove();

  // 📦 Create inline block under this zone
  const questionRow = document.createElement('tr');
  questionRow.id = `inline-question-${zoneId}`;
  questionRow.innerHTML = `
    <td colspan="4" style="background:#1e1e1e; padding:15px; border-radius:8px;">
      <div style="color:white;">
        <h3 style="margin-bottom:10px;">Challenge: ${zoneName}</h3>
        <div id="question-text-${zoneId}" style="color:#bb86fc; margin-bottom:10px;">Loading question...</div>
        <div id="answer-area-${zoneId}" style="margin-bottom:10px;"></div>
        <button id="submit-answer-${zoneId}"
                style="display:none;background:#673ab7;color:white;border:none;
                       border-radius:6px;padding:8px 16px;cursor:pointer;">Submit Answer</button>
      </div>
    </td>
  `;
  zoneRow.insertAdjacentElement('afterend', questionRow);

  // 📚 Load questions from Firestore
  const snapshot = await getDocs(collection(db, 'zones', zoneId, 'questions'));
  if (snapshot.empty) {
    document.getElementById(`question-text-${zoneId}`).textContent = 'No questions found for this zone.';
    return;
  }

  // 🎯 Select first “unique” question
  let questionData;
  snapshot.forEach(docSnap => {
    if (docSnap.id.startsWith('unique') && !questionData) {
      questionData = docSnap.data();
      challengeState.questionId = docSnap.id;
    }
  });

  const questionEl = document.getElementById(`question-text-${zoneId}`);
  const answerArea = document.getElementById(`answer-area-${zoneId}`);
  const submitBtn = document.getElementById(`submit-answer-${zoneId}`);

  if (questionData?.question) {
    questionEl.textContent = `❓ ${questionData.question}`;
    answerArea.innerHTML = `
      <input type="text" id="player-answer-${zoneId}"
             placeholder="Your answer..."
             style="width:80%;padding:8px;border-radius:6px;border:none;background:#333;color:#fff;">
    `;
    submitBtn.style.display = 'inline-block';
    submitBtn.onclick = () => handleAnswerSubmitInline(zoneId);
  } else {
    questionEl.textContent = 'No unique question found for this zone.';
  }

  // 📢 Broadcast that the team started this challenge
  await broadcastChallenge(currentTeamName, zoneName);
  console.log(`⚔️ ${currentTeamName} started challenge in ${zoneName}`);
}

// ---------------------------------------------------------------------------
// 🧩 INLINE ANSWER SUBMISSION HANDLER
// ---------------------------------------------------------------------------
async function handleAnswerSubmitInline(zoneId) {
  const { questionId, attemptsLeft } = challengeState;
  if (!zoneId || !questionId) return;

  const input = document.getElementById(`player-answer-${zoneId}`);
  const playerAnswer = input?.value.trim();
  if (!playerAnswer) return alert('Please enter an answer.');

  const questionDoc = await getDoc(doc(db, 'zones', zoneId, 'questions', questionId));
  if (!questionDoc.exists()) return alert('Question not found.');

  const questionData = questionDoc.data();
  const zoneDoc = await getDoc(doc(db, 'zones', zoneId));
  const zoneName = zoneDoc.data().name || zoneId;

  const isCorrect = validateAnswer(playerAnswer, questionData.answer, questionData.type);

  // ✅ CORRECT
  if (isCorrect) {
    const points = attemptsLeft === 3 ? 10 : attemptsLeft === 2 ? 8 : 6;
    alert(`✅ CORRECT! ${zoneName} captured (+${points} pts)`);

    await updateTeamLocation(currentTeamName, zoneName);
    await broadcastWin(currentTeamName, zoneName);

    await setDoc(
      doc(db, 'zones', zoneId),
      {
        status: 'Taken',
        controllingTeam: currentTeamName,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await addPointsToTeam(currentTeamName, points);
    await updateControlledZones(currentTeamName, zoneName);

    // 🧹 Clean up question UI
    const inlineRow = document.getElementById(`inline-question-${zoneId}`);
    if (inlineRow) inlineRow.remove();

    console.log(`🏁 ${currentTeamName} captured ${zoneName} (+${points} pts).`);
  }
  // ❌ INCORRECT
  else {
    challengeState.attemptsLeft--;
    if (challengeState.attemptsLeft > 0) {
      alert(`❌ Incorrect. ${challengeState.attemptsLeft} attempt(s) left.`);
    } else {
      alert('😓 Out of attempts. Time for a PitStop!');
      const inlineRow = document.getElementById(`inline-question-${zoneId}`);
      if (inlineRow) inlineRow.remove();
    }
  }
}