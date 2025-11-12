// Fastest Finger · Player — full multi-player client with live results
import { firebaseConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp as firestoreServerTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getDatabase,
  ref,
  onValue,
  runTransaction,
  serverTimestamp as rtdbServerTimestamp,
  off,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const REQUIRED_IDS = [
  'playerForm',
  'playerGameId',
  'registrationPanel',
  'playerStatusPanel',
  'playerNickname',
  'playerScore',
  'phaseMessage',
  'playerCountdown',
  'playerWindow',
  'buzzButton',
  'buzzStatus',
  'victoryPanel',
  'victoryHeadline',
  'victoryChant',
  'resultsPanel',
  'playerResultsBody',
  'eliminatedPanel',
];

const REQUIRED_INPUT_NAMES = ['firstName', 'lastName', 'nickname', 'victoryChant'];

function $(id) {
  return document.getElementById(id);
}

function show(el) {
  el?.classList?.remove('hidden');
}

function hide(el) {
  el?.classList?.add('hidden');
}

function overlayError(message) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed;inset:0;background:rgba(12,0,0,.85);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;z-index:9999;font:16px/1.4 system-ui';
  wrapper.innerHTML = `
    <div style="max-width:640px;text-align:center">
      <h2 style="margin-bottom:12px;font-size:20px;letter-spacing:.04em;">Fastest Finger – Player Error</h2>
      <p style="margin-bottom:16px;opacity:.9;">${message}</p>
      <button style="padding:8px 16px;border-radius:999px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer;">Dismiss</button>
    </div>
  `;
  wrapper.querySelector('button').onclick = () => wrapper.remove();
  document.body.appendChild(wrapper);
}

function normalizeTimestamp(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value.seconds === 'number') {
    return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  }
  return null;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

window.addEventListener('DOMContentLoaded', () => {
  (async () => {
    try {
      const missing = REQUIRED_IDS.filter((id) => !$(id));
      if (missing.length) {
        overlayError('Missing elements: ' + missing.join(', '));
        return;
      }

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      await setPersistence(auth, browserSessionPersistence);
      await signInAnonymously(auth);

      const firestore = getFirestore(app);
      const realtime = getDatabase(app);

      const els = {
        registrationPanel: $('registrationPanel'),
        form: $('playerForm'),
        statusPanel: $('playerStatusPanel'),
        nicknameLabel: $('playerNickname'),
        scoreLabel: $('playerScore'),
        phaseMessage: $('phaseMessage'),
        countdown: $('playerCountdown'),
        window: $('playerWindow'),
        buzzButton: $('buzzButton'),
        buzzStatus: $('buzzStatus'),
        victoryPanel: $('victoryPanel'),
        victoryHeadline: $('victoryHeadline'),
        victoryChant: $('victoryChant'),
        resultsPanel: $('resultsPanel'),
        resultsBody: $('playerResultsBody'),
        eliminatedPanel: $('eliminatedPanel'),
      };

      const inputRefs = {
        gameId: $('playerGameId'),
        firstName: document.querySelector('input[name="firstName"]'),
        lastName: document.querySelector('input[name="lastName"]'),
        nickname: document.querySelector('input[name="nickname"]'),
        victoryChant: document.querySelector('textarea[name="victoryChant"]'),
      };

      REQUIRED_INPUT_NAMES.forEach((name) => {
        if (!document.querySelector(`[name="${name}"]`)) {
          throw new Error(`Missing input element: ${name}`);
        }
      });

      let playerUid = auth.currentUser?.uid ?? null;
      let gameId = null;
      let playerProfile = null;
      let detachState = null;
      let detachWinner = null;
      let detachPlayerDoc = null;
      let detachAttempts = null;
      let attemptsRefHandle = null;
      let onePushRule = false;
      let hasBuzzedThisRound = false;
      let isEliminated = false;

      els.form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const gid = inputRefs.gameId.value.trim();
        const first = inputRefs.firstName.value.trim();
        const last = inputRefs.lastName.value.trim();
        const nick = inputRefs.nickname.value.trim();
        const chant = inputRefs.victoryChant.value.trim();
        if (!gid || !first || !last || !nick || !chant) {
          overlayError('Please complete every field.');
          return;
        }

        gameId = gid;
        playerUid = auth.currentUser?.uid;
        playerProfile = { firstName: first, lastName: last, nickname: nick, victoryChant: chant };

        const playerRef = doc(firestore, 'ff_games', gameId, 'players', playerUid);
        const existing = await getDoc(playerRef);
        const payload = {
          ...playerProfile,
          updatedAt: firestoreServerTimestamp(),
          active: true,
        };
        if (!existing.exists()) {
          payload.joinedAt = firestoreServerTimestamp();
          payload.score = 0;
          payload.lastReactionMs = null;
        }
        await setDoc(playerRef, payload, { merge: true });

        swapToStatusPanel(nick);
        attachPlayerDocListener(playerRef);
        watchGameState();
      });

      function swapToStatusPanel(nickname) {
        hide(els.registrationPanel);
        show(els.statusPanel);
        els.nicknameLabel.textContent = nickname;
      }

      function attachPlayerDocListener(playerRef) {
        detachPlayerDoc?.();
        detachPlayerDoc = onSnapshot(playerRef, (snap) => {
          if (!snap.exists()) {
            overlayError('You were removed by the host. Please rejoin.');
            teardownListeners();
            show(els.registrationPanel);
            hide(els.statusPanel);
            return;
          }
          const data = snap.data();
          els.scoreLabel.textContent = data.score ?? 0;
        });
      }

      function watchGameState() {
        if (!gameId) return;
        const stateRef = ref(realtime, `ff/${gameId}/state`);
        detachState?.();
        detachState = onValue(stateRef, (snap) => {
          const state = snap.val() || {};
          handleStateUpdate(state);
        });
      }

      function handleStateUpdate(state) {
        els.phaseMessage.textContent = phaseCopy(state.phase);
        onePushRule = state.onePushRule === true;

        if (state.activeRoundId !== (attemptsRefHandle?.parent?.key || null)) {
          hasBuzzedThisRound = false;
          els.buzzStatus.textContent = '';
          els.buzzButton.disabled = false;
        }

        if (!state.activeRoundId) {
          updateCountdownLabels('—', '—');
          setBuzzAvailability(false);
          updateVictoryPanel();
          attachWinnerWatcher(null);
          attachAttemptWatcher(null);
          renderAttemptRows([]);
          hasBuzzedThisRound = false; // Reset for next round
          return;
        }

        updateCountdownDisplays(state);
        setBuzzAvailability(state.phase === 'live' && !hasBuzzedThisRound);
        attachWinnerWatcher(state.activeRoundId);
        attachAttemptWatcher(state.activeRoundId, state.liveAt || null);
      }

      function phaseCopy(phase) {
        switch (phase) {
          case 'countdown':
            return 'Get ready… countdown in progress.';
          case 'suspense':
            return 'Hold tight… buzz window opening soon!';
          case 'live':
            return 'Buzz NOW!';
          case 'locked':
            return 'Round finished. See results.';
          default:
            return 'Waiting for the host…';
        }
      }

      function updateCountdownDisplays(state) {
        if (state.phase === 'countdown' && state.liveAt) {
          const ms = Math.max(0, state.liveAt - Date.now());
          updateCountdownLabels(formatCountdown(ms), '--');
        } else if (state.phase === 'suspense') {
          updateCountdownLabels('…', '--');
        } else if (state.phase === 'live' && state.closeAt) {
          const ms = Math.max(0, state.closeAt - Date.now());
          updateCountdownLabels('--', formatCountdown(ms));
        } else if (state.phase === 'locked') {
          updateCountdownLabels('0', '0');
        } else {
          updateCountdownLabels('—', '—');
        }
      }

      function updateCountdownLabels(countdownText, windowText) {
        els.countdown.textContent = countdownText;
        els.window.textContent = windowText;
      }

      function formatCountdown(ms) {
        return ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : Math.ceil(ms / 1000);
      }

      function setBuzzAvailability(enabled) {
        show(els.buzzButton);
        els.buzzButton.disabled = !enabled;
        els.buzzStatus.textContent = enabled ? 'GO!' : '';
      }

      function attachWinnerWatcher(roundId) {
        detachWinner?.();
        detachWinner = null;
        if (!roundId || !gameId) {
          updateVictoryPanel();
          return;
        }
        const winnerRef = ref(realtime, `ff/${gameId}/rounds/${roundId}/winner`);
        detachWinner = onValue(winnerRef, (snap) => {
          const data = snap.val();
          updateVictoryPanel(data);
          if (data && data.playerId === playerUid) {
            els.buzzStatus.textContent = '🎉 You won this round!';
          }
        });
      }

      function attachAttemptWatcher(roundId, liveAt) {
        detachAttemptWatcher();
        if (!roundId || !gameId) {
          renderAttemptRows([]);
          return;
        }
        attemptsRefHandle = ref(
          realtime,
          `ff/${gameId}/rounds/${roundId}/attempts`
        );
        const listener = (snap) => {
          const raw = snap.val() || {};
          const rows = Object.values(raw)
            .map((entry) => {
              if (entry.tooSoon) {
                return {
                  nickname: entry.nickname || 'Player',
                  reactionMs: 'Too Soon',
                  you: entry.playerId === playerUid,
                };
              }
              const buzzAtMs = normalizeTimestamp(entry.buzzAt);
              return {
                nickname: entry.nickname || 'Player',
                reactionMs:
                  buzzAtMs && liveAt
                    ? Math.max(0, Math.round(buzzAtMs - liveAt))
                    : null,
                you: entry.playerId === playerUid,
              };
            })
            .filter((row) => row.reactionMs !== null)
            .sort((a, b) => {
              if (a.reactionMs === 'Too Soon') return -1;
              if (b.reactionMs === 'Too Soon') return 1;
              if (a.reactionMs === null) return 1;
              if (b.reactionMs === null) return -1;
              return a.reactionMs - b.reactionMs;
            });
          renderAttemptRows(rows);
        };
        detachAttempts = listener;
        onValue(attemptsRefHandle, listener);
      }

      function detachAttemptWatcher() {
        if (attemptsRefHandle && detachAttempts) {
          off(attemptsRefHandle, 'value', detachAttempts);
        }
        attemptsRefHandle = null;
        detachAttempts = null;
      }

      function renderAttemptRows(rows = []) {
        if (!els.resultsPanel || !els.resultsBody) return;
        if (!rows.length) {
          hide(els.resultsPanel);
          els.resultsBody.innerHTML =
            '<tr><td colspan="3" class="muted">No attempts yet.</td></tr>';
          return;
        }
        show(els.resultsPanel);
        els.resultsBody.innerHTML = rows
          .map(
            (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.nickname)}</td>
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

      function updateVictoryPanel(winnerData) {
        if (!winnerData) {
          hide(els.victoryPanel);
          els.victoryHeadline.textContent = 'Who will win?';
          els.victoryChant.textContent = '';
          return;
        }
        show(els.victoryPanel);
        els.victoryHeadline.textContent = `${winnerData.nickname || 'Player'} wins!`;
        els.victoryChant.textContent = winnerData.victoryChant
          ? `“${winnerData.victoryChant}”`
          : '';
      }

      els.buzzButton.addEventListener('click', async () => {
        if (!gameId || !playerUid || !playerProfile) return;
        if (onePushRule && hasBuzzedThisRound) {
          els.buzzStatus.textContent = 'You have already buzzed this round.';
          return;
        }

        const stateRef = ref(realtime, `ff/${gameId}/state`);
        const state = await new Promise((resolve) =>
          onValue(stateRef, (snap) => resolve(snap.val() || {}), { onlyOnce: true })
        );

        if (!state.activeRoundId) {
          els.buzzStatus.textContent = 'Waiting for next round...';
          return;
        }

        if (onePushRule) {
          hasBuzzedThisRound = true;
          els.buzzButton.disabled = true;
        }

        const attemptsRef = ref(
          realtime,
          `ff/${gameId}/rounds/${state.activeRoundId}/attempts/${playerUid}`
        );
        const winnerRef = ref(
          realtime,
          `ff/${gameId}/rounds/${state.activeRoundId}/winner`
        );

        if (state.phase !== 'live') {
          if (onePushRule) {
            try {
              await runTransaction(attemptsRef, (current) => {
                if (current) return current; // Already buzzed
                return {
                  playerId: playerUid,
                  nickname: playerProfile.nickname,
                  tooSoon: true,
                };
              });
              els.buzzStatus.textContent = 'Too Soon!';
            } catch (err) {
              console.warn('Failed to log "too soon" attempt', err);
              hasBuzzedThisRound = false; // Allow retry if DB fails
              els.buzzButton.disabled = false;
            }
          } else {
            els.buzzStatus.textContent =
              state.phase === 'locked'
                ? 'Too late! That round is already locked.'
                : 'Wait for the GO signal!';
          }
          return;
        }

        // Live phase logic
        const liveAt = state.liveAt || null;
        const reactionEstimate = liveAt ? Math.max(0, Date.now() - liveAt) : null;

        try {
          await runTransaction(attemptsRef, (current) => {
            if (current) return current;
            return {
              playerId: playerUid,
              nickname: playerProfile.nickname,
              victoryChant: playerProfile.victoryChant,
              buzzAt: rtdbServerTimestamp(),
            };
          });
        } catch (err) {
          console.warn('Attempt transaction failed', err);
        }

        try {
          await runTransaction(winnerRef, (current) => {
            if (current) return current;
            return {
              playerId: playerUid,
              nickname: playerProfile.nickname,
              victoryChant: playerProfile.victoryChant,
              buzzAt: rtdbServerTimestamp(),
            };
          });
          els.buzzStatus.textContent = reactionEstimate
            ? `✅ Buzz registered! ${reactionEstimate} ms`
            : '✅ Buzz registered!';
        } catch (err) {
          console.warn('Winner transaction failed', err);
          els.buzzStatus.textContent = reactionEstimate
            ? `Reaction recorded: ${reactionEstimate} ms`
            : 'Attempt recorded.';
        }

        els.buzzButton.disabled = true;
      });

      function teardownListeners() {
        detachState?.();
        detachWinner?.();
        detachPlayerDoc?.();
        detachAttemptWatcher();
        detachState = null;
        detachWinner = null;
        detachPlayerDoc = null;
      }
    } catch (error) {
      console.error('[FF][Player] Initialization failed', error);
      overlayError(error?.message || String(error));
    }
  })();
});
