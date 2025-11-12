import {
  app as firebaseApp,
  ensureAnonymousAuth,
  getAuthInstance,
  getFirestoreInstance,
  getRealtimeInstance,
} from './firebaseApp.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  serverTimestamp as firestoreServerTimestamp,
  increment,
  deleteDoc,
  deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ref,
  set,
  get,
  update as updateRtdb,
  onValue,
  off,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const dom = {
  unlockSection: document.getElementById('unlockSection'),
  unlockForm: document.getElementById('unlockForm'),
  unlockStatus: document.getElementById('unlockStatus'),
  controlsSection: document.getElementById('controlsSection'),
  gameLabel: document.getElementById('controlsGameLabel'),
  resetBtn: document.getElementById('resetToRegister'),
  roundOptionsForm: document.getElementById('roundOptionsForm'),
  startRoundBtn: document.getElementById('startRoundBtn'),
  nextRoundBtn: document.getElementById('nextRoundBtn'),
  roundStatus: document.getElementById('roundStatus'),
  phaseBadge: document.getElementById('phaseBadge'),
  countdownCopy: document.getElementById('countdownCopy'),
  countdownClock: document.getElementById('countdownClock'),
  windowClock: document.getElementById('windowClock'),
  endingScene: document.getElementById('endingScene'),
  winnerName: document.getElementById('winnerName'),
  winnerChant: document.getElementById('winnerChant'),
  winnerReaction: document.getElementById('winnerReaction'),
  leaderboardList: document.getElementById('leaderboardList'),
  playerList: document.getElementById('playerList'),
  resetPlayersBtn: document.getElementById('resetPlayersBtn'),
  refreshGameBtn: document.getElementById('refreshGameBtn'),
  winnerDisplay: document.getElementById('winnerDisplay'),
  roundResultsCard: document.getElementById('roundResultsCard'),
  resultsMeta: document.getElementById('resultsMeta'),
  resultsTableBody: document.querySelector('#resultsTable tbody'),
  liveResultsMeta: document.getElementById('liveResultsMeta'),
  liveResultsTableBody: document.querySelector('#liveResultsTable tbody'),
};

const firestore = getFirestoreInstance();
const realtime = getRealtimeInstance();

let unlockedGameId = null;
let stateRef = null;
let stateListener = null;
let winnerRef = null;
let winnerListener = null;
let playersUnsub = null;
let phaseGuardInterval = null;
let uiTickInterval = null;
let currentState = {};
let playerRecords = [];
let latestWinner = null;
let lastRoundId = null;
const processedWinners = new Set();
let countdownSequenceToken = 0;
let attemptsListener = null;
let attemptsRefHandle = null;
let roundCounter = 0;

dom.unlockForm?.addEventListener('submit', handleUnlockSubmit);
dom.resetBtn?.addEventListener('click', relockControls);
dom.roundOptionsForm?.addEventListener('change', handleOptionChange);
dom.startRoundBtn?.addEventListener('click', startRound);
dom.resetPlayersBtn?.addEventListener('click', handleResetPlayers);
dom.nextRoundBtn?.addEventListener('click', handleNextRound);
dom.refreshGameBtn?.addEventListener('click', handleGameRefresh);

bootstrap();

async function bootstrap() {
  await ensureAnonymousAuth();
}

async function handleGameRefresh() {
  if (!unlockedGameId || !playerRecords.length) {
    dom.roundStatus.textContent = 'No game to refresh.';
    return;
  }
  const confirmed = window.confirm(
    'Are you sure you want to refresh the game? This will reset all scores and elimination statuses.'
  );
  if (!confirmed) return;

  roundCounter = 0;
  try {
    const updates = playerRecords.map((player) => {
      const playerRef = doc(
        firestore,
        'ff_games',
        unlockedGameId,
        'players',
        player.id
      );
      return updateDoc(playerRef, {
        score: 0,
        eliminatedInRound: deleteField(),
      });
    });
    await Promise.all(updates);
    dom.roundStatus.textContent = 'Game refreshed. Scores and eliminations have been reset.';
  } catch (error) {
    console.error('Failed to refresh game', error);
    dom.roundStatus.textContent = 'Could not refresh the game. Check console.';
  }
}


async function handleUnlockSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const gameId = data.get('controlGameId')?.trim();
  const passwordAttempt = data.get('controlPassword')?.trim();
  console.log('INIT: gameId entered:', gameId);
  console.log('INIT: Firebase app:', firebaseApp);
  console.log('INIT: Auth user (pre-auth):', getAuthInstance().currentUser);
  if (!gameId || !passwordAttempt) {
    setUnlockStatus('Enter both Game ID and password.', true);
    return;
  }
  setUnlockStatus('Checking password…');
  try {
    await ensureAnonymousAuth();
    const settingsRef = doc(firestore, 'ff_games', gameId, 'settings', 'main');
    let passwordDoc = await getDoc(settingsRef);
    if (!passwordDoc.exists()) {
      await setDoc(settingsRef, {
        controlPassword: 'kirby123',
        createdAt: Date.now(),
      });
      passwordDoc = await getDoc(settingsRef);
      console.log(`🆕 Created new Fastest Finger room ${gameId} with default password.`);
    }
    const passwordData = passwordDoc.data ? passwordDoc.data() : null;
    console.log('INIT: controlPassword doc snapshot:', passwordDoc.exists(), passwordData);
    if (!passwordDoc.exists()) {
      throw new Error('No control password found for this Game ID.');
    }
    const stored =
      passwordData?.controlPassword ??
      passwordData?.value ??
      passwordData?.password ??
      '';
    if (stored !== passwordAttempt) {
      throw new Error('Incorrect password. Try again.');
    }
    await unlockControls(gameId);
  } catch (error) {
    console.error(error);
    setUnlockStatus(error.message ?? 'Unable to unlock controls.', true);
  }
}

async function unlockControls(gameId) {
  unlockedGameId = gameId;
  dom.unlockSection.classList.add('hidden');
  dom.controlsSection.classList.remove('hidden');
  dom.gameLabel.textContent = gameId;
  dom.roundStatus.textContent = '';

  stateRef = ref(realtime, `ff/${gameId}/state`);
  await ensureStateDefaults();
  attachStateListener();
  subscribePlayers();
  kickOffPhaseGuard();
  kickOffUiTicker();
}

function relockControls() {
  teardownListeners();
  unlockedGameId = null;
  dom.controlsSection.classList.add('hidden');
  dom.unlockSection.classList.remove('hidden');
  dom.unlockStatus.textContent = '';
  dom.roundStatus.textContent = '';
  dom.unlockForm.reset();
  dom.phaseBadge.textContent = 'Phase · register';
  dom.countdownClock.textContent = '—';
  dom.windowClock.textContent = '—';
  dom.countdownCopy.textContent = 'Waiting for players to register…';
  dom.leaderboardList.innerHTML = '';
  dom.winnerName.textContent = 'Waiting…';
  dom.winnerChant.textContent = '';
  dom.winnerReaction.textContent = '';
  latestWinner = null;
  currentState = {};
  lastRoundId = null;
  processedWinners.clear();
  countdownSequenceToken++;
  setWinnerDisplay('');
  detachAttemptsWatcher();
  renderRoundResults([]);
  renderLiveResults([]);
}

function teardownListeners() {
  if (stateListener && stateRef) {
    off(stateRef, 'value', stateListener);
  }
  if (winnerListener && winnerRef) {
    off(winnerRef, 'value', winnerListener);
  }
  if (playersUnsub) {
    playersUnsub();
    playersUnsub = null;
  }
  if (phaseGuardInterval) {
    clearInterval(phaseGuardInterval);
    phaseGuardInterval = null;
  }
  if (uiTickInterval) {
    clearInterval(uiTickInterval);
    uiTickInterval = null;
  }
  detachAttemptsWatcher();
  renderRoundResults([]);
}

async function ensureStateDefaults() {
  if (!stateRef) return;
  const snapshot = await get(stateRef);
  if (!snapshot.exists()) {
    await set(stateRef, {
      phase: 'register',
      countdownMs: 3000,
      windowMs: 5000,
      endSceneStyle: 'classroom',
      countdownValue: null,
      suspenseMs: null,
      suspenseAt: null,
      updatedAt: Date.now(),
    });
  }
}

function attachStateListener() {
  if (!stateRef) return;
  if (stateListener) {
    off(stateRef, 'value', stateListener);
  }
  stateListener = (snap) => {
    const oldPhase = currentState.phase;
    currentState = snap.val() ?? {};
    if (!currentState.phase) {
      currentState.phase = 'register';
    }

    if (
      currentState.phase === 'locked' &&
      oldPhase === 'live' &&
      currentState.eliminationMode
    ) {
      handleEliminations(currentState.activeRoundId);
    }

    if (currentState.phase === 'countdown') {
      dom.roundStatus.textContent = 'Countdown underway…';
    } else if (currentState.phase === 'live') {
      dom.roundStatus.textContent = 'Buzz window is live!';
    } else if (currentState.phase === 'locked') {
      dom.roundStatus.textContent = 'Round locked. Show the ending scene!';
    } else {
      dom.roundStatus.textContent = '';
    }
    if (currentState.activeRoundId !== lastRoundId) {
      lastRoundId = currentState.activeRoundId ?? null;
      latestWinner = null;
      attachAttemptsWatcher(lastRoundId);
    }
    if (!currentState.activeRoundId) {
      renderRoundResults([]);
    }
    updatePhaseBadge();
    renderEndingScene();
    manageWinnerSubscription();
  };
  onValue(stateRef, stateListener);
}

function subscribePlayers() {
  if (!unlockedGameId) return;
  if (playersUnsub) {
    playersUnsub();
  }
  const playersRef = collection(
    firestore,
    'ff_games',
    unlockedGameId,
    'players'
  );
  playersUnsub = onSnapshot(playersRef, (snapshot) => {
    playerRecords = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    renderEndingScene();
    renderPlayerLobby();
  });
}

function handleOptionChange(event) {
  if (!stateRef || !event.target.name) return;
  const { name, value, type, checked } = event.target;

  let parsedValue;
  if (type === 'checkbox') {
    parsedValue = checked;
  } else if (name === 'endSceneStyle') {
    parsedValue = value;
  } else {
    parsedValue = Number.parseInt(value, 10);
  }

  updateRtdb(stateRef, {
    [name]: parsedValue,
    updatedAt: Date.now(),
  });
}

async function startRound(event) {
  event?.preventDefault();
  if (!unlockedGameId || !stateRef) return;
  const form = new FormData(dom.roundOptionsForm);
  const countdownMs = Number.parseInt(form.get('countdownMs'), 10);
  const windowMs = Number.parseInt(form.get('windowMs'), 10);
  const endSceneStyle = form.get('endSceneStyle') ?? 'classroom';
  const onePushRule = dom.roundOptionsForm.onePushRule.checked;
  const eliminationMode = dom.roundOptionsForm.eliminationMode.checked;

  if (currentState.phase === 'countdown' || currentState.phase === 'live') {
    dom.roundStatus.textContent =
      'Round already in progress. Wait until it locks.';
    return;
  }

  roundCounter++;
  dom.startRoundBtn.disabled = true;
  dom.roundStatus.textContent = 'Scheduling round…';
  try {
    const now = Date.now();
    const roundId = `${now}`;
    const countdownValues = buildCountdownValues(countdownMs);
    const countdownDuration = countdownValues.length * 1000;
    const suspenseMs = randInt(1000, 3000);
    const suspenseAt = now + countdownDuration;
    const liveAt = suspenseAt + suspenseMs;
    const closeAt = liveAt + windowMs;
    await set(ref(realtime, `ff/${unlockedGameId}/rounds/${roundId}`), {
      liveAt,
      suspenseAt,
      suspenseMs,
      closeAt,
    });
    await updateRtdb(stateRef, {
      phase: 'countdown',
      countdownMs,
      windowMs,
      endSceneStyle,
      onePushRule,
      eliminationMode,
      liveAt,
      closeAt,
      suspenseAt,
      suspenseMs,
      countdownValue: countdownValues[0] ?? null,
      activeRoundId: roundId,
      roundNumber: roundCounter,
      updatedAt: Date.now(),
    });
    processedWinners.delete(roundId);
    dom.roundStatus.textContent = 'Countdown started!';
    const token = ++countdownSequenceToken;
    runCountdownDisplay(countdownValues.slice(1), token);
    setWinnerDisplay('');
  } catch (error) {
    console.error(error);
    roundCounter--;
    dom.roundStatus.textContent = 'Unable to start round. Try again.';
  } finally {
    setTimeout(() => {
      dom.startRoundBtn.disabled = false;
    }, 800);
  }
}

function manageWinnerSubscription() {
  if (!unlockedGameId) return;
  const roundId = currentState.activeRoundId;
  if (!roundId) {
    if (winnerListener && winnerRef) {
      off(winnerRef, 'value', winnerListener);
      winnerListener = null;
    }
    return;
  }
  const nextRef = ref(realtime, `ff/${unlockedGameId}/rounds/${roundId}/winner`);
  if (winnerRef && winnerRef.toString() === nextRef.toString()) {
    return;
  }
  if (winnerListener && winnerRef) {
    off(winnerRef, 'value', winnerListener);
  }
  winnerRef = nextRef;
  winnerListener = (snap) => {
    const data = snap.val();
    if (data) {
      handleRoundWinner(roundId, data);
    }
  };
  onValue(winnerRef, winnerListener);
}

async function handleRoundWinner(roundId, winnerData) {
  if (processedWinners.has(roundId)) {
    return;
  }
  const liveAt = currentState.liveAt;
  const reactionMs =
    typeof winnerData.buzzAt === 'number' && liveAt
      ? Math.max(0, winnerData.buzzAt - liveAt)
      : null;
  try {
    const attemptsSnapshot = await get(
      ref(realtime, `ff/${unlockedGameId}/rounds/${roundId}/attempts`)
    );
    const attemptsValue = attemptsSnapshot.val() || {};
    const attempts = Object.values(attemptsValue)
      .map((entry) => {
        if (entry.tooSoon) {
          return {
            playerId: entry.playerId,
            nickname: entry.nickname || 'Player',
            reactionMs: 'Too Soon',
          };
        }
        const buzzAtMs = normalizeTimestamp(entry.buzzAt);
        return {
          playerId: entry.playerId,
          nickname: entry.nickname || 'Player',
          reactionMs:
            buzzAtMs && liveAt
              ? Math.max(0, Math.round(buzzAtMs - liveAt))
              : null,
        };
      })
      .filter((row) => row.reactionMs !== null)
      .sort((a, b) => {
        if (a.reactionMs === 'Too Soon') return -1;
        if (b.reactionMs === 'Too Soon') return 1;
        return a.reactionMs - b.reactionMs;
      });

    const roundDoc = doc(
      firestore,
      'ff_games',
      unlockedGameId,
      'rounds',
      roundId
    );
    await setDoc(
      roundDoc,
      {
        roundId,
        winnerId: winnerData.playerId,
        nickname: winnerData.nickname,
        victoryChant: winnerData.victoryChant ?? '',
        reactionMs,
        liveAt: currentState.liveAt ?? null,
        closeAt: currentState.closeAt ?? null,
        attempts,
        recordedAt: firestoreServerTimestamp(),
      },
      { merge: true }
    );

    const playerRef = doc(
      firestore,
      'ff_games',
      unlockedGameId,
      'players',
      winnerData.playerId
    );
    try {
      await updateDoc(playerRef, {
        score: increment(1),
        lastReactionMs: reactionMs,
        updatedAt: firestoreServerTimestamp(),
      });
    } catch (err) {
      if (err.code === 'not-found') {
        await setDoc(
          playerRef,
          {
            score: 1,
            lastReactionMs: reactionMs,
            nickname: winnerData.nickname ?? 'Player',
            updatedAt: firestoreServerTimestamp(),
          },
          { merge: true }
        );
      } else {
        throw err;
      }
    }
    latestWinner = {
      roundId,
      ...winnerData,
      reactionMs,
    };
    processedWinners.add(roundId);
    renderEndingScene();
    renderRoundResults(attempts);
    setWinnerDisplay(
      `Winner: ${latestWinner.nickname ?? 'Unknown'}${
        isFinite(reactionMs) ? ` (${formatMs(reactionMs)})` : ''
      }`
    );
    if (stateRef) {
      await updateRtdb(stateRef, {
        phase: 'locked',
        winnerNickname: winnerData.nickname ?? '',
        countdownValue: null,
        closeAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  } catch (error) {
    console.error('Failed to post winner stats', error);
    dom.roundStatus.textContent =
      'Winner detected but failed to log stats. Check console.';
  }
}

function updatePhaseBadge() {
  const phase = currentState.phase ?? 'register';
  dom.phaseBadge.textContent = `Phase · ${phase}`;
  let copy = 'Waiting for players to register…';
  if (phase === 'countdown') {
    copy = 'Countdown is visible to players.';
    if (typeof currentState.countdownValue === 'number') {
      copy = `Countdown: ${currentState.countdownValue}`;
    }
  } else if (phase === 'suspense') {
    copy = 'Dramatic pause… wait for it!';
  } else if (phase === 'live') {
    copy = 'Buzz window is open.';
  } else if (phase === 'locked') {
    copy = 'Window closed. Reveal the winner!';
  }
  dom.countdownCopy.textContent = copy;
  dom.startRoundBtn.disabled = phase === 'countdown' || phase === 'live';
}

function renderEndingScene() {
  const style = currentState.endSceneStyle ?? 'classroom';
  dom.endingScene.classList.remove(
    'scene-classroom',
    'scene-neon',
    'scene-spotlight'
  );
  const sceneClass =
    style === 'neon'
      ? 'scene-neon'
      : style === 'spotlight'
      ? 'scene-spotlight'
      : 'scene-classroom';
  dom.endingScene.classList.add(sceneClass);
  updateWinnerBanner();
  renderLeaderboard();
}

function updateWinnerBanner() {
  if (currentState.phase !== 'locked') {
    dom.winnerName.textContent = 'Waiting for round to lock…';
    dom.winnerChant.textContent = '';
    dom.winnerReaction.textContent = '';
    return;
  }
  if (!latestWinner) {
    dom.winnerName.textContent = 'No winner logged yet.';
    dom.winnerChant.textContent = '';
    dom.winnerReaction.textContent = '';
    return;
  }
  dom.winnerName.textContent = latestWinner.nickname ?? 'Unknown winner';
  dom.winnerChant.textContent = latestWinner.victoryChant
    ? `“${latestWinner.victoryChant}”`
    : '';
  dom.winnerReaction.textContent = isFinite(latestWinner.reactionMs)
    ? `Reaction: ${formatMs(latestWinner.reactionMs)}`
    : '';
}

function renderLeaderboard() {
  dom.leaderboardList.innerHTML = '';
  if (!playerRecords.length) {
    const li = document.createElement('li');
    li.textContent = 'No player registrations yet.';
    dom.leaderboardList.appendChild(li);
    return;
  }
  const sorted = [...playerRecords].sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    const aReaction =
      typeof a.lastReactionMs === 'number' ? a.lastReactionMs : Number.MAX_SAFE_INTEGER;
    const bReaction =
      typeof b.lastReactionMs === 'number' ? b.lastReactionMs : Number.MAX_SAFE_INTEGER;
    return aReaction - bReaction;
  });
  sorted.slice(0, 5).forEach((player, idx) => {
    const li = document.createElement('li');
    if (idx < 3) {
      li.classList.add('top');
    }
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `#${idx + 1}`;

    const body = document.createElement('div');
    body.className = 'leaderboard-body';
    const name = document.createElement('div');
    name.textContent = player.nickname ?? 'Anonymous';
    const meta = document.createElement('small');
    const scoreLabel = `${player.score ?? 0} pts`;
    const reactionLabel = isFinite(player.lastReactionMs)
      ? `${formatMs(player.lastReactionMs)}`
      : '—';
    meta.textContent = `${scoreLabel} • ${reactionLabel}`;
    body.append(name, meta);

    li.append(rank, body);
    dom.leaderboardList.appendChild(li);
  });
}

function renderPlayerLobby() {
  if (!dom.playerList) return;
  dom.playerList.innerHTML = '';
  if (!playerRecords.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No players connected yet.';
    dom.playerList.appendChild(li);
    return;
  }

  const sorted = [...playerRecords].sort((a, b) => {
    if (a.eliminatedInRound && !b.eliminatedInRound) return 1;
    if (!a.eliminatedInRound && b.eliminatedInRound) return -1;
    return (a.nickname ?? '').localeCompare(b.nickname ?? '', undefined, {
      sensitivity: 'base',
    });
  });

  sorted.forEach((player) => {
    const li = document.createElement('li');
    if (player.eliminatedInRound) {
      li.classList.add('inactive');
    }

    const meta = document.createElement('div');
    meta.className = 'player-meta';
    const name = document.createElement('strong');
    name.textContent = player.nickname ?? 'Anonymous';
    const detail = document.createElement('small');
    detail.textContent = [player.firstName, player.lastName].filter(Boolean).join(' ') || '—';
    meta.append(name, detail);

    const status = document.createElement('div');
    status.className = 'player-status';

    if (player.eliminatedInRound) {
      const eliminatedText = document.createElement('span');
      eliminatedText.textContent = `Eliminated (Round ${player.eliminatedInRound.roundNumber})`;
      eliminatedText.className = 'eliminated-text';
      status.appendChild(eliminatedText);
    } else {
      const score = document.createElement('strong');
      score.textContent = `${player.score ?? 0} pts`;
      status.appendChild(score);
    }

    const actions = document.createElement('div');
    if (!player.eliminatedInRound) {
      const bootBtn = document.createElement('button');
      bootBtn.type = 'button';
      bootBtn.className = 'ghost danger small';
      bootBtn.textContent = 'Boot';
      bootBtn.addEventListener('click', () => {
        bootPlayer(player.id, player.nickname);
      });
      actions.appendChild(bootBtn);
    }

    li.append(meta, status, actions);
    dom.playerList.appendChild(li);
  });
  
  const activePlayers = playerRecords.filter(p => !p.eliminatedInRound);
  if (currentState.eliminationMode && activePlayers.length === 1) {
    const winner = activePlayers[0];
    dom.roundStatus.textContent = `🎉 ${winner.nickname} is the final winner!`;
    const declareWinnerBtn = document.createElement('button');
    declareWinnerBtn.textContent = 'Declare Final Winner';
    declareWinnerBtn.className = 'primary tall';
    declareWinnerBtn.onclick = () => {
      setWinnerDisplay(`🎉 ${winner.nickname} is the final winner!`);
      updateRtdb(stateRef, { phase: 'finished' });
    };
    dom.playerList.append(declareWinnerBtn);
  }
}

async function handleEliminations(roundId) {
  if (!unlockedGameId || !roundId) return;

  const attemptsRef = ref(
    realtime,
    `ff/${unlockedGameId}/rounds/${roundId}/attempts`
  );
  const attemptsSnapshot = await get(attemptsRef);
  const attempts = attemptsSnapshot.val() || {};

  const playersToEliminate = new Set();
  let slowestPlayer = null;
  let maxReactionTime = -1;

  for (const playerId in attempts) {
    const attempt = attempts[playerId];
    if (attempt.tooSoon) {
      playersToEliminate.add(playerId);
    }
    else {
      const reactionMs =
        attempt.buzzAt && currentState.liveAt
          ? attempt.buzzAt - currentState.liveAt
          : -1;
      if (reactionMs > maxReactionTime) {
        maxReactionTime = reactionMs;
        slowestPlayer = playerId;
      }
    }
  }

  if (slowestPlayer) {
    playersToEliminate.add(slowestPlayer);
  }

  for (const playerId of playersToEliminate) {
    const playerRef = doc(
      firestore,
      'ff_games',
      unlockedGameId,
      'players',
      playerId
    );
    await updateDoc(playerRef, {
      eliminatedInRound: {
        roundId: roundId,
        roundNumber: currentState.roundNumber,
        timestamp: firestoreServerTimestamp(),
      }
    });
  }
}


function renderLiveResults(rows = []) {
  if (!dom.liveResultsTableBody || !dom.liveResultsMeta) return;
  dom.liveResultsMeta.textContent = rows.length
    ? `Live attempts: ${rows.length}`
    : 'No attempts yet.';
  if (!rows.length) {
    dom.liveResultsTableBody.innerHTML =
      '<tr><td colspan="3" class="muted">Waiting for buzzes…</td></tr>';
    return;
  }
  dom.liveResultsTableBody.innerHTML = rows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${row.nickname}</td>
          <td>${
            typeof row.reactionMs === 'number'
              ? `${row.reactionMs}ms`
              : row.reactionMs
          }</td>
        </tr>
      `
    )
    .join('');
}

function renderRoundResults(rows = []) {
  if (!dom.resultsTableBody || !dom.resultsMeta) return;
  dom.resultsMeta.textContent = rows.length
    ? `Final attempts: ${rows.length}`
    : 'No attempts yet.';
  if (!rows.length) {
    dom.resultsTableBody.innerHTML =
      '<tr><td colspan="3" class="muted">Waiting for buzzes…</td></tr>';
    return;
  }
  dom.resultsTableBody.innerHTML = rows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${row.nickname}</td>
          <td>${
            typeof row.reactionMs === 'number'
              ? `${row.reactionMs}ms`
              : row.reactionMs
          }</td>
        </tr>
      `
    )
    .join('');
  renderLiveResults(rows);
}

function attachAttemptsWatcher(roundId) {
  detachAttemptsWatcher();
  if (!roundId || !unlockedGameId) {
    renderRoundResults([]);
    return;
  }
  attemptsRefHandle = ref(
    realtime,
    `ff/${unlockedGameId}/rounds/${roundId}/attempts`
  );
  attemptsListener = (snap) => {
    const raw = snap.val() || {};
    const liveAt = currentState.liveAt ?? null;
    const rows = Object.values(raw)
      .map((entry) => {
        if (entry.tooSoon) {
          return {
            nickname: entry.nickname || 'Player',
            reactionMs: 'Too Soon',
          };
        }
        const buzzAtMs = normalizeTimestamp(entry.buzzAt);
        return {
          nickname: entry.nickname || 'Player',
          reactionMs:
            buzzAtMs && liveAt
              ? Math.max(0, Math.round(buzzAtMs - liveAt))
              : null,
        };
      })
      .filter((row) => row.reactionMs !== null)
      .sort((a, b) => {
        if (a.reactionMs === 'Too Soon') return -1;
        if (b.reactionMs === 'Too Soon') return 1;
        return a.reactionMs - b.reactionMs;
      });
    renderLiveResults(rows);
  };
  onValue(attemptsRefHandle, attemptsListener);
}

function detachAttemptsWatcher() {
  if (attemptsRefHandle && attemptsListener) {
    off(attemptsRefHandle, 'value', attemptsListener);
  }
  attemptsRefHandle = null;
  attemptsListener = null;
}

async function handleNextRound(event) {
  event?.preventDefault();
  if (!stateRef) return;
  countdownSequenceToken++;
  latestWinner = null;
  processedWinners.clear();
  try {
    await updateRtdb(stateRef, {
      phase: 'register',
      countdownValue: null,
      activeRoundId: null,
      liveAt: null,
      closeAt: null,
      suspenseAt: null,
      suspenseMs: null,
      winnerNickname: null,
      updatedAt: Date.now(),
    });
    dom.roundStatus.textContent = 'Round reset. Ready when you are.';
    setWinnerDisplay('');
    dom.startRoundBtn.disabled = false;
    detachAttemptsWatcher();
    renderRoundResults([]);
    renderLiveResults([]);
  } catch (error) {
    console.error('Failed to reset round state', error);
    dom.roundStatus.textContent = 'Unable to reset round right now.';
  }
}

function normalizeTimestamp(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value.seconds === 'number') {
    return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  }
  return null;
}

async function bootPlayer(playerId, nickname = '') {
  if (!unlockedGameId || !playerId) return;
  const confirmed = window.confirm(
    `Remove ${nickname || 'this player'} from the lobby?`
  );
  if (!confirmed) return;
  try {
    await deleteDoc(
      doc(firestore, 'ff_games', unlockedGameId, 'players', playerId)
    );
    dom.roundStatus.textContent = `${nickname || 'Player'} removed from lobby.`;
  } catch (error) {
    console.error('Failed to boot player', error);
    dom.roundStatus.textContent = 'Unable to remove player right now.';
  }
}

async function handleResetPlayers() {
  if (!unlockedGameId || !playerRecords.length) {
    dom.roundStatus.textContent = 'No players to reset.';
    return;
  }
  const confirmed = window.confirm(
    'Reset the entire lobby? All players will be removed.'
  );
  if (!confirmed) return;
  try {
    await Promise.all(
      playerRecords.map((player) =>
        deleteDoc(
          doc(firestore, 'ff_games', unlockedGameId, 'players', player.id)
        )
      )
    );
    dom.roundStatus.textContent = 'Player lobby cleared.';
  } catch (error) {
    console.error('Failed to reset players', error);
    dom.roundStatus.textContent = 'Unable to reset players right now.';
  }
}

function buildCountdownValues(totalMs) {
  const seconds = Math.max(3, Math.round(totalMs / 1000) || 3);
  const values = [];
  for (let i = seconds; i >= 1; i -= 1) {
    values.push(i);
  }
  return values;
}

async function runCountdownDisplay(values, token) {
  if (!stateRef) return;
  for (const value of values) {
    await sleep(1000);
    if (token !== countdownSequenceToken) return;
    await updateRtdb(stateRef, {
      countdownValue: value,
      updatedAt: Date.now(),
    });
  }
  await sleep(1000);
  if (token !== countdownSequenceToken) return;
  await updateRtdb(stateRef, {
    countdownValue: null,
    updatedAt: Date.now(),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randInt(min, max) {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function setWinnerDisplay(text) {
  if (dom.winnerDisplay) {
    dom.winnerDisplay.textContent = text ?? '';
  }
}

function kickOffPhaseGuard() {
  if (phaseGuardInterval) {
    clearInterval(phaseGuardInterval);
  }
  phaseGuardInterval = setInterval(() => {
    if (!stateRef || !currentState.phase) return;
    const now = Date.now();
    if (
      currentState.phase === 'countdown' &&
      currentState.suspenseAt &&
      now >= currentState.suspenseAt
    ) {
      updateRtdb(stateRef, { phase: 'suspense', updatedAt: now });
    } else if (
      currentState.phase !== 'locked' &&
      currentState.liveAt &&
      now >= currentState.liveAt
    ) {
      updateRtdb(stateRef, { phase: 'live', updatedAt: now });
    } else if (
      currentState.phase !== 'locked' &&
      currentState.closeAt &&
      now >= currentState.closeAt
    ) {
      updateRtdb(stateRef, { phase: 'locked', updatedAt: now });
    }
  }, 800);
}

function kickOffUiTicker() {
  if (uiTickInterval) {
    clearInterval(uiTickInterval);
  }
  uiTickInterval = setInterval(() => {
    if (!currentState.liveAt) {
      dom.countdownClock.textContent =
        typeof currentState.countdownValue === 'number'
          ? currentState.countdownValue
          : '—';
      dom.windowClock.textContent = '—';
      return;
    }
    const now = Date.now();
    const toLive = Math.max(0, currentState.liveAt - now);
    const toLocked = currentState.closeAt
      ? Math.max(0, currentState.closeAt - now)
      : null;
    if (typeof currentState.countdownValue === 'number') {
      dom.countdownClock.textContent = currentState.countdownValue;
    } else if (currentState.phase === 'suspense') {
      dom.countdownClock.textContent = '…';
    } else if (currentState.phase === 'countdown') {
      dom.countdownClock.textContent = formatMs(toLive);
    } else {
      dom.countdownClock.textContent = '—';
    }
    dom.windowClock.textContent =
      currentState.phase === 'live' && toLocked !== null
        ? formatMs(toLocked)
        : currentState.phase === 'locked'
        ? '0.00s'
        : '—';
  }, 200);
}

function setUnlockStatus(message, isError = false) {
  dom.unlockStatus.textContent = message;
  dom.unlockStatus.style.color = isError ? 'var(--ff-danger)' : 'var(--ff-muted)';
}

function formatMs(ms) {
  if (!isFinite(ms)) return '—';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.max(0, Math.round(ms))}ms`;
}
