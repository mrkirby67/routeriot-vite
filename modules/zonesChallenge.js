// ============================================================================
// FILE: /modules/zonesChallenge.js
// PURPOSE: Inline Challenge + Question handling logic for player zones
// ============================================================================

import { db } from '/core/config.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
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

const DEFAULT_SCORING = { first: 10, second: 5, successive: 2 };

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

function resolveGameId() {
  const candidates = [
    typeof window !== 'undefined' ? window.__rrGameId : null,
    typeof window !== 'undefined' ? window.__routeRiotGameId : null,
    typeof window !== 'undefined' ? window.sessionStorage?.getItem?.('activeGameId') : null,
    typeof window !== 'undefined' ? window.localStorage?.getItem?.('activeGameId') : null,
  ];

  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return 'global';
}

async function fetchZoneScoring(gameId) {
  try {
    const snap = await getDoc(doc(db, 'games', gameId, 'settings', 'zoneScoring'));
    if (!snap.exists()) return { ...DEFAULT_SCORING };
    const data = snap.data() || {};
    return {
      first: Number.isFinite(data.first) ? data.first : DEFAULT_SCORING.first,
      second: Number.isFinite(data.second) ? data.second : DEFAULT_SCORING.second,
      successive: Number.isFinite(data.successive) ? data.successive : DEFAULT_SCORING.successive
    };
  } catch (err) {
    console.warn('⚠️ Failed to load zone scoring config:', err);
    return { ...DEFAULT_SCORING };
  }
}

async function countPriorCaptures(gameId, zoneId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'games', gameId, 'captures'),
        where('zoneId', '==', zoneId)
      )
    );
    return snap.size || 0;
  } catch (err) {
    console.warn('⚠️ Failed to count prior captures:', err);
    return 0;
  }
}

async function logZoneCapture(gameId, zoneId, teamName, points, captureIndex = null) {
  try {
    const ref = doc(collection(db, 'games', gameId, 'captures'));
    await setDoc(ref, {
      zoneId,
      teamName,
      points,
      captureNumber: captureIndex,
      capturedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('⚠️ Failed to log zone capture:', err);
  }
}

async function computeCapturePoints(gameId, zoneId) {
  const scoring = await fetchZoneScoring(gameId);
  const priorCount = await countPriorCaptures(gameId, zoneId);

  let points = scoring.successive;
  if (priorCount === 0) points = scoring.first;
  else if (priorCount === 1) points = scoring.second;

  return {
    points: Number.isFinite(points) ? points : DEFAULT_SCORING.successive,
    captureNumber: priorCount + 1
  };
}

function getMultipleChoiceOptions(questionData) {
  if (Array.isArray(questionData.mcOptions) && questionData.mcOptions.length) {
    return questionData.mcOptions
      .map((o) => {
        if (typeof o === 'string') return o.trim();
        if (o && typeof o.text === 'string') return o.text.trim();
        return '';
      })
      .filter(Boolean);
  }

  if (Array.isArray(questionData.options) && questionData.options.length) {
    return questionData.options
      .map((o) => (typeof o === 'string' ? o.trim() : ''))
      .filter(Boolean);
  }

  if (typeof questionData.answer === 'string' && questionData.answer.trim()) {
    return questionData.answer
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

async function fetchLatestQuestionForZone(zoneId) {
  if (!zoneId) return null;

  // 1) Prefer per-zone subcollection: zones/{zoneId}/questions
  try {
    const subQuery = query(
      collection(db, 'zones', zoneId, 'questions'),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    const subSnap = await getDocs(subQuery);
    if (!subSnap.empty) {
      const docSnap = subSnap.docs[0];
      return { id: docSnap.id, ...(docSnap.data() || {}) };
    }
  } catch (err) {
    console.warn('⚠️ Failed to fetch zone-local questions; falling back to legacy questions collection:', err);
  }

  // 2) Fallback: legacy top-level "questions" collection
  try {
    const legacyQuery = query(
      collection(db, 'questions'),
      where('zoneId', '==', zoneId),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    const legacySnap = await getDocs(legacyQuery);
    if (!legacySnap.empty) {
      const docSnap = legacySnap.docs[0];
      return { id: docSnap.id, ...(docSnap.data() || {}) };
    }
  } catch (err) {
    console.error('❌ Error loading legacy questions for zone:', zoneId, err);
  }

  return null;
}

// ---------------------------------------------------------------------------
// 🧩 Render helpers
// ---------------------------------------------------------------------------
function renderBooleanQuestion(zoneId, questionData, answerArea) {
  const opts =
    questionData.type === 'YES_NO' ? ['YES', 'NO'] :
    questionData.type === 'TRUE_FALSE' ? ['TRUE', 'FALSE'] :
    ['UP', 'DOWN'];

  answerArea.innerHTML = opts.map((o) => `
    <label style="margin-right:10px;">
      <input type="radio" name="answer-${zoneId}" value="${o}" /> ${o}
    </label>
  `).join('');
}

function renderMultipleChoiceQuestion(zoneId, questionData, answerArea) {
  const options = getMultipleChoiceOptions(questionData);
  if (!options.length) {
    answerArea.innerHTML = '<p>No options defined.</p>';
    return;
  }

  answerArea.innerHTML = options.map((opt) => `
    <label style="display:block;margin-bottom:4px;">
      <input type="radio" name="answer-${zoneId}" value="${opt}" /> ${opt}
    </label>
  `).join('');
}

function renderNumericQuestion(zoneId, questionData, answerArea) {
  answerArea.innerHTML = `
    <input type="number" id="player-answer-${zoneId}"
           placeholder="Enter a number..."
           style="width:80%;padding:8px;border-radius:6px;border:none;background:#333;color:#fff;">
  `;
}

function renderFreeTextQuestion(zoneId, questionData, answerArea) {
  answerArea.innerHTML = `
    <input type="text" id="player-answer-${zoneId}"
           placeholder="Your answer..."
           style="width:80%;padding:8px;border-radius:6px;border:none;background:#333;color:#fff;">
  `;
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
      hydrateZoneCooldown(zoneId, zoneData.cooldownUntil, currentTeamName);
      const storedCooldown = Number(zoneData.cooldownMinutes);
      if (Number.isFinite(storedCooldown) && storedCooldown > 0) {
        challengeState.cooldownMinutes = storedCooldown;
      }
    }
  } catch (err) {
    console.warn('⚠️ Failed to load zone metadata for cooldown check:', err);
  }

  if (isZoneOnCooldown(zoneId, currentTeamName)) {
    const remainingMinutes = Math.max(1, Math.ceil(getZoneCooldownRemaining(zoneId, currentTeamName) / 60000));
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

  // 📚 Load questions from Firestore
  //    Prefer per-zone subcollection (zones/{zoneId}/questions), then
  //    fall back to the legacy top-level "questions" collection.
  let questionData = null;

  try {
    questionData = await fetchLatestQuestionForZone(zoneId);

    const questionEl = document.getElementById(`question-text-${zoneId}`);
    const answerArea = document.getElementById(`answer-area-${zoneId}`);
    const submitBtn = document.getElementById(`submit-answer-${zoneId}`);

    if (questionData?.question) {
      questionEl.textContent = `❓ ${questionData.question}`;

      // 🧩 Render answer input based on type (KEEP EXISTING BEHAVIOR)
      switch (questionData.type) {
        case 'YES_NO':
        case 'TRUE_FALSE':
        case 'UP_DOWN': {
          const options =
            questionData.type === 'YES_NO' ? ['YES', 'NO'] :
            questionData.type === 'TRUE_FALSE' ? ['TRUE', 'FALSE'] :
            ['UP', 'DOWN'];

          answerArea.innerHTML = options.map(o =>
            `<label style="margin-right:10px;">
               <input type="radio" name="answer-${zoneId}" value="${o}" /> ${o}
             </label>`
          ).join('');
          break;
        }

        case 'MULTIPLE_CHOICE':
          answerArea.innerHTML =
            (questionData.mcOptions || []).map(o =>
              `<label style="display:block;margin-bottom:4px;">
                 <input type="radio" name="answer-${zoneId}" value="${o.text}" /> ${o.text}
               </label>`
            ).join('') || '<p>No options defined.</p>';
          break;

        default:
          answerArea.innerHTML = `
            <input type="text" id="player-answer-${zoneId}"
                   placeholder="Your answer..."
                   style="width:80%;padding:8px;border-radius:6px;border:none;
                          background:#333;color:#fff;">
          `;
          break;
      }

      submitBtn.style.display = 'inline-block';
      submitBtn.onclick = () => handleAnswerSubmitInline(zoneId, questionData);
    } else {
      const questionEl = document.getElementById(`question-text-${zoneId}`);
      if (questionEl) {
        questionEl.textContent =
          'No checkpoint task is configured for this zone yet.';
      }
    }

    // 📢 Broadcast start (same behavior as before)
    await broadcastChallenge(currentTeamName, zoneName);
    console.log(`⚔️ ${currentTeamName} started challenge in ${zoneName}`);
  } catch (err) {
    console.error('❌ Error loading zone question:', err);
    const questionEl = document.getElementById(`question-text-${zoneId}`);
    if (questionEl) {
      questionEl.textContent =
        'Error loading checkpoint task. Please try again later.';
    }
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

  let isCorrect;

  if (questionData.type === 'OPEN') {
    isCorrect = typeof playerAnswer === 'string' && playerAnswer.trim().length > 0;
  } else {
    isCorrect = validateAnswer(playerAnswer, questionData.answer ?? questionData.booleanCorrect ?? questionData.openAccepted, questionData.type);
  }

  // ✅ CORRECT
  if (isCorrect) {
    const gameId = resolveGameId();
    let points = DEFAULT_SCORING.successive;
    let captureNumber = null;

    try {
      const computed = await computeCapturePoints(gameId, zoneId);
      points = computed.points;
      captureNumber = computed.captureNumber;
    } catch (err) {
      console.warn('⚠️ Using default scoring due to error:', err);
    }

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
          updatedAt: serverTimestamp(),
          captureCount: captureNumber || null
        },
        { merge: true }
      );

      publish('zone:capture', {
        teamName: currentTeamName,
        zoneId,
        points
      });

      await logZoneCapture(gameId, zoneId, currentTeamName, points, captureNumber);

      await startZoneCooldown(zoneId, cooldownMinutes, currentTeamName);
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
        await startZoneCooldown(zoneId, cooldownMinutes, currentTeamName);
      } catch (err) {
        console.warn('⚠️ Failed to start cooldown after failed attempts:', err);
      }
      alert(`😓 Out of attempts. Your team is cooling down for ${cooldownMinutes} minute${cooldownMinutes === 1 ? '' : 's'}.`);
      document.getElementById(`inline-question-${zoneId}`)?.remove();
    }
  }
}
