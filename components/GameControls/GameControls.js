// ============================================================================
// File: components/GameControls/GameControls.js
// Purpose: Main control dashboard for starting, pausing, ending, and resetting games.
// ============================================================================
import { db } from '../../modules/config.js';
import { allTeams } from '../../data.js';
import { emailAllTeams } from '../../modules/emailTeams.js';
import { resetScores } from '../../modules/scoreboardManager.js';

import {
  doc,
  setDoc,
  writeBatch,
  getDocs,
  collection,
  addDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  listenToGameTimer,
  clearElapsedTimer
} from '../../modules/gameTimer.js';

import {
  pauseGame,
  resumeGame,
} from '../../modules/gameStateManager.js';

import styles from './GameControls.module.css';

// ============================================================================
// COMPONENT MARKUP
// ============================================================================
export function GameControlsComponent() {
  return `
    <div class="${styles.controlSection}">
      <h2>Game Controls & Setup</h2>

      <div class="${styles.gameControls}">
        <button id="start-btn" class="${styles.controlButton} ${styles.start}">▶️ Start Game</button>
        <button id="pause-btn" class="${styles.controlButton} ${styles.pause}">⏸️ Pause Game</button>
        <button id="end-btn" class="${styles.controlButton} ${styles.end}">🏁 End Game</button>
        <button id="reset-game-btn" class="${styles.controlButton} ${styles.pause}">🔄 Reset Game Data</button>
        <button id="clear-scores-btn" class="${styles.controlButton} ${styles.warning}">🧹 Clear Scores</button>
      </div>

      <div class="${styles.teamSetup}" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <label for="team-size">Team Size:</label>
        <input type="number" id="team-size" value="2" min="1" style="width:60px;">
        <button id="randomize-btn" class="${styles.controlButton} ${styles.pause}">🎲 Randomize Teams</button>
        <button id="send-links-btn" class="${styles.controlButton} ${styles.start}">📧 Racers Take Your Marks</button>
        <button id="toggle-rules-btn" class="${styles.controlButton} ${styles.pause}">📜 Edit Rules</button>
      </div>

      <div class="${styles.timerSetup}">
        <label for="game-duration">Game Duration (minutes):</label>
        <input type="number" id="game-duration" value="120">
        <div class="${styles.liveTimer}">
          <strong>Live Timer:</strong>
          <span id="timer-display">--:--:--</span>
        </div>
      </div>

      <div id="rules-section"
           style="display:none;margin-top:20px;background:#2b2b2b;padding:15px;border-radius:8px;">
        <h3>Game Rules</h3>
        <textarea id="rules-text"
          style="width:100%;height:200px;background:#1e1e1e;color:#fff;border:none;
          border-radius:6px;padding:10px;font-family:monospace;resize:vertical;"></textarea>
        <div style="margin-top:10px;">
          <button id="save-rules-btn" class="${styles.controlButton} ${styles.start}">💾 Save Rules</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// INITIALIZER
// ============================================================================
export function initializeGameControlsLogic() {
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const endBtn = document.getElementById('end-btn');
  const resetBtn = document.getElementById('reset-game-btn');
  const clearScoresBtn = document.getElementById('clear-scores-btn');
  const randomizeBtn = document.getElementById('randomize-btn');
  const sendBtn = document.getElementById('send-links-btn');

  const rulesBtn = document.getElementById('toggle-rules-btn');
  const rulesSection = document.getElementById('rules-section');
  const rulesText = document.getElementById('rules-text');
  const saveRulesBtn = document.getElementById('save-rules-btn');
  const rulesDocRef = doc(db, 'settings', 'rules');

  // 🧭 Load timer listener
  listenToGameTimer();

  // 📝 Load existing rules
  getDoc(rulesDocRef).then(snap => {
    rulesText.value = snap.exists() ? (snap.data().content || '') : 'Enter your Route Riot rules here...';
  });

  // 📜 Toggle rules panel
  rulesBtn.addEventListener('click', () => {
    const open = rulesSection.style.display !== 'none';
    rulesSection.style.display = open ? 'none' : 'block';
    rulesBtn.textContent = open ? '📜 Edit Rules' : '❌ Close Rules';
  });

  // 💾 Save rules
  saveRulesBtn.addEventListener('click', async () => {
    await setDoc(rulesDocRef, { content: rulesText.value.trim() }, { merge: true });
    alert('✅ Rules saved!');
  });

  // ▶️ Start Game
  startBtn.addEventListener('click', async () => {
    const mins = Number(document.getElementById('game-duration').value) || 120;
    const endTime = new Date(Date.now() + mins * 60 * 1000);

    const racersSnap = await getDocs(collection(db, 'racers'));
    const teamsInPlay = new Set();
    racersSnap.forEach(d => {
      const r = d.data();
      if (r.team && r.team !== '-') teamsInPlay.add(r.team);
    });

    await setDoc(doc(db, 'game', 'activeTeams'), { list: Array.from(teamsInPlay) }, { merge: true });
    await setDoc(doc(db, 'game', 'gameState'), {
      status: 'active',
      startTime: serverTimestamp(),
      endTime,
      zonesReleased: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await addDoc(collection(db, 'communications'), {
      teamName: 'Game Master',
      message: '🏁 The race has begun! Zones are now active — good luck racers!',
      timestamp: new Date()
    });

    alert(`🏁 Game Started — Zones Released!\n${teamsInPlay.size} teams active.`);
  });

  // ⏸️ Pause / ▶️ Resume
  pauseBtn.addEventListener('click', async () => {
    try {
      const isPaused = pauseBtn.textContent.includes('Resume');
      if (isPaused) {
        await resumeGame();
        pauseBtn.textContent = '⏸️ Pause Game';
        alert('▶️ Game Resumed!');
      } else {
        await pauseGame();
        pauseBtn.textContent = '▶️ Resume Game';
        alert('⏸️ Game Paused!');
      }
    } catch (err) {
      console.error('Pause/Resume Error:', err);
      alert('❌ Failed to pause/resume.');
    }
  });

  // 🏁 End Game
  endBtn.addEventListener('click', async () => {
    await setDoc(doc(db, 'game', 'gameState'), { status: 'finished' }, { merge: true });
    clearElapsedTimer();
    alert('🏁 Game ended.');
  });

  // 🔄 Reset Game
  resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset all game data?')) return;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'game', 'gameState'), {
        status: 'waiting',
        zonesReleased: false,
        updatedAt: serverTimestamp()
      });
      batch.delete(doc(db, 'game', 'activeTeams'));
      await batch.commit();
      alert('🔄 Game reset.');
    } catch (err) {
      console.error('Reset error:', err);
      alert('❌ Reset failed.');
    }
  });

  // 🧹 Clear Scores
  clearScoresBtn.addEventListener('click', async () => {
    if (confirm('Clear all scores and zones?')) {
      await resetScores();
      await addDoc(collection(db, 'communications'), {
        teamName: 'Game Master',
        message: '🧹 All scores and zones have been reset by control.',
        timestamp: new Date()
      });
      alert('✅ Scores and zones reset.');
    }
  });

  // 🎲 Randomize Teams
  randomizeBtn.addEventListener('click', async () => {
    const teamSize = Number(document.getElementById('team-size').value);
    if (!teamSize || teamSize < 1) return alert('Enter a valid team size.');

    const snap = await getDocs(collection(db, 'racers'));
    const racers = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.name);

    for (let i = racers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [racers[i], racers[j]] = [racers[j], racers[i]];
    }

    const batch = writeBatch(db);
    racers.forEach((r, i) => {
      const tIndex = Math.floor(i / teamSize);
      const team = allTeams[tIndex % allTeams.length];
      batch.update(doc(db, 'racers', r.id), { team: team.name });
    });

    await batch.commit();
    alert('🎲 Teams randomized!');
  });

  // 📧 Email Teams
  sendBtn.addEventListener('click', async () => {
    const racersSnap = await getDocs(collection(db, 'racers'));
    const racers = racersSnap.docs.map(d => d.data());
    const activeTeams = {};

    racers.forEach(r => {
      if (r.team && r.team !== '-' && r.email) {
        if (!activeTeams[r.team]) activeTeams[r.team] = [];
        activeTeams[r.team].push(r);
      }
    });

    const teamNames = Object.keys(activeTeams);
    if (!teamNames.length) return alert('❌ No racers assigned to teams.');

    const rulesSnap = await getDoc(rulesDocRef);
    const currentRules = rulesSnap.exists() ? rulesSnap.data().content : '';

    if (confirm(`Email links to ${teamNames.length} teams?`)) {
      emailAllTeams(currentRules, activeTeams);
      alert(`📧 Emails prepared for ${teamNames.length} teams.`);
    }
  });
}