// ============================================================================
// FILE: /modules/zonesChallenge.js
// PURPOSE: Inline Challenge + Question handling logic for player zones
// ============================================================================

import { db } from '/core/config.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { validateAnswer } from './zonesUtils.js';
import { broadcastChallenge, broadcastWin, updateTeamLocation } from './zonesFirestore.js';
import { allTeams } from '../data.js';
import {
  hydrateZoneCooldown,
  isZoneOnCooldown,
  startZoneCooldown,
  getZoneCooldownRemaining
} from './zoneManager.js';
import { publish } from '/core/eventBus.js';

// ---------------------------------------------------------------------------
// 🧭 Context State
// ---------------------------------------------------------------------------
let currentTeamName = null;
const DEFAULT_ZONE_COOLDOWN_MINUTES = 15;
let challengeState = {
  zoneId: null,
  zoneName: null,
  questionId: null,
  attemptsLeft: 3,
  cooldownMinutes: DEFAULT_ZONE_COOLDOWN_MINUTES
};

export function setTeamContext(teamName) {
  currentTeamName = allTeams.find(t => t.name === teamName)?.name || teamName;
  console.log(`🎯 Team context set for challenges: ${currentTeamName}`);
}

// ---------------------------------------------------------------------------
// 🎮 DISPLAY CHALLENGE QUESTIONS INLINE (UNDER ZONE)
// ---------------------------------------------------------------------------
export async function displayZoneQuestions(zoneId, zoneName) {
  challengeState = {
    zoneId,
    zoneName,
    questionId: null,
    attemptsLeft: 3,
    cooldownMinutes: DEFAULT_ZONE_COOLDOWN_MINUTES
  };

  // 🧱 Find the zone row
  const zoneRow = document.querySelector(`[data-zone-id="${zoneId}"]`);
  if (!zoneRow) {
    console.warn(`⚠️ Zone row not found for ${zoneId}`);
    return;
  }

  try {
    const zoneSnap = await getDoc(doc(db, 'zones', zoneId));
    if (zoneSnap.exists()) {
      const zoneData = zoneSnap.data() || {};
      hydrateZoneCooldown(zoneId, zoneData.cooldownUntil);
      const storedCooldown = Number(zoneData.cooldownMinutes);
      if (Number.isFinite(storedCooldown) && storedCooldown > 0) {
        challengeState.cooldownMinutes = storedCooldown;
      }
    }
  } catch (err) {
    console.warn('⚠️ Failed to load zone metadata for cooldown check:', err);
  }

  if (isZoneOnCooldown(zoneId)) {
    const remainingMinutes = Math.max(1, Math.ceil(getZoneCooldownRemaining(zoneId) / 60000));
    alert(`⏳ Zone cooling down — try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`);
    return;
  }

  // 🔄 Remove any existing inline block for this zone
  document.getElementById(`inline-question-${zoneId}`)?.remove();

  // 📦 Create inline question row
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

  // 📚 Load questions from Firestore (new modular schema support)
  let questionData = null;

  try {
    const globalDoc = await getDoc(doc(db, 'questions', zoneId));
    if (globalDoc.exists()) {
      questionData = { id: globalDoc.id, ...globalDoc.data() };
    }

    const questionEl = document.getElementById(`question-text-${zoneId}`);
    const answerArea = document.getElementById(`answer-area-${zoneId}`);
    const submitBtn = document.getElementById(`submit-answer-${zoneId}`);

    if (questionData?.question) {
      questionEl.textContent = `❓ ${questionData.question}`;

      // 🧩 Render answer input differently by type
      switch (questionData.type) {
        case 'YES_NO':
        case 'TRUE_FALSE':
        case 'UP_DOWN': {
          const opts =
            questionData.type === 'YES_NO' ? ['YES', 'NO'] :
            questionData.type === 'TRUE_FALSE' ? ['TRUE', 'FALSE'] :
            ['UP', 'DOWN'];
          answerArea.innerHTML = `
            ${opts.map(o =>
              `<label style="margin-right:10px;">
                <input type="radio" name="answer-${zoneId}" value="${o}" /> ${o}
              </label>`
            ).join('')}
          `;
          break;
        }

        case 'MULTIPLE_CHOICE':
          answerArea.innerHTML = questionData.mcOptions?.map((o, i) =>
            `<label style="display:block;margin-bottom:4px;">
              <input type="radio" name="answer-${zoneId}" value="${o.text}" /> ${o.text}
            </label>`
          ).join('') || '<p>No options defined.</p>';
          break;

        default:
          // OPEN, NUMBER, COMPLETE, etc.
          answerArea.innerHTML = `
            <input type="text" id="player-answer-${zoneId}"
                   placeholder="Your answer..."
                   style="width:80%;padding:8px;border-radius:6px;border:none;background:#333;color:#fff;">
          `;
      }

      submitBtn.style.display = 'inline-block';
      submitBtn.onclick = () => handleAnswerSubmitInline(zoneId, questionData);
    } else {
      document.getElementById(`question-text-${zoneId}`).textContent =
        'No unique question found for this zone.';
    }

    // 📢 Broadcast start
    await broadcastChallenge(currentTeamName, zoneName);
    console.log(`⚔️ ${currentTeamName} started challenge in ${zoneName}`);
  } catch (err) {
    console.error('❌ Error loading zone question:', err);
    document.getElementById(`question-text-${zoneId}`).textContent =
      '⚠️ Failed to load question data.';
  }
}

// ---------------------------------------------------------------------------
// 🧩 INLINE ANSWER SUBMISSION HANDLER
// ---------------------------------------------------------------------------
async function handleAnswerSubmitInline(zoneId, questionData) {
  const { attemptsLeft } = challengeState;
  if (!zoneId || !questionData) return;

  let playerAnswer = '';

  if (['YES_NO', 'TRUE_FALSE', 'UP_DOWN', 'MULTIPLE_CHOICE'].includes(questionData.type)) {
    const selected = document.querySelector(`input[name="answer-${zoneId}"]:checked`);
    if (!selected) return alert('Please select an option.');
    playerAnswer = selected.value.trim();
  } else {
    const input = document.getElementById(`player-answer-${zoneId}`);
    playerAnswer = input?.value.trim();
  }

  if (!playerAnswer) return alert('Please enter an answer.');

  const isCorrect = validateAnswer(playerAnswer, questionData.answer ?? questionData.booleanCorrect ?? questionData.openAccepted, questionData.type);

  // ✅ CORRECT
  if (isCorrect) {
    const points = attemptsLeft === 3 ? 10 : attemptsLeft === 2 ? 8 : 6;
    alert(`✅ CORRECT! ${zoneId} captured (+${points} pts)`);

    try {
      const cooldownMinutes = challengeState.cooldownMinutes || DEFAULT_ZONE_COOLDOWN_MINUTES;
      await updateTeamLocation(currentTeamName, zoneId);
      await broadcastWin(currentTeamName, zoneId);
      await setDoc(
        doc(db, 'zones', zoneId),
        {
          status: 'Taken',
          controllingTeam: currentTeamName,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      publish('zone:capture', {
        teamName: currentTeamName,
        zoneId,
        points
      });

      await startZoneCooldown(zoneId, cooldownMinutes);
    } catch (err) {
      console.error('❌ Error finalizing win:', err);
    }

    // 🧹 Clean up question UI
    document.getElementById(`inline-question-${zoneId}`)?.remove();
    console.log(`🏁 ${currentTeamName} captured ${zoneId} (+${points} pts).`);
  }
  // ❌ INCORRECT
  else {
    challengeState.attemptsLeft--;
    if (challengeState.attemptsLeft > 0) {
      alert(`❌ Incorrect. ${challengeState.attemptsLeft} attempt(s) left.`);
    } else {
      const cooldownMinutes = challengeState.cooldownMinutes || DEFAULT_ZONE_COOLDOWN_MINUTES;
      try {
        await startZoneCooldown(zoneId, cooldownMinutes);
      } catch (err) {
        console.warn('⚠️ Failed to start cooldown after failed attempts:', err);
      }
      alert(`😓 Out of attempts. Zone cooling down for ${cooldownMinutes} minute${cooldownMinutes === 1 ? '' : 's'}.`);
      document.getElementById(`inline-question-${zoneId}`)?.remove();
    }
  }
}
