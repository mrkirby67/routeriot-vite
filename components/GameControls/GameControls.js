// ============================================================================
// FILE: components/GameControls/GameControls.js
// PURPOSE: Main control dashboard for starting, pausing, ending, and resetting games.
// UPDATED: Integrated gameMaintenance.js (resetFullGame / clearChatsAndScores)
// ============================================================================

import { db } from '../../modules/config.js';
import { allTeams } from '../../data.js';
import { emailAllTeams } from '../../modules/emailTeams.js';
import {
  doc,
  setDoc,
  writeBatch,
  getDocs,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { listenToGameTimer, clearElapsedTimer } from '../../modules/gameTimer.js';
import { pauseGame, resumeGame } from '../../modules/gameStateManager.js';
import {
  clearChatsAndScores
} from '../../modules/gameMaintenance.js'; // 🧹 new imports
import { clearAllCollectionsAndReset } from '../../modules/gameRulesManager.js';

import styles from './GameControls.module.css';

// ============================================================================
// 🎉 Animated Broadcast Banner
// ============================================================================
function showAnimatedBanner(message, color = '#7b1fa2') {
  let banner = document.getElementById('top3-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'top3-banner';
    banner.style.cssText = [
      'position: fixed;',
      'top: 25%;',
      'left: 50%;',
      'transform: translateX(-50%);',
      `background: ${color};`,
      'color: white;',
      'padding: 25px 40px;',
      'border-radius: 10px;',
      'font-size: 2rem;',
      'font-weight: bold;',
      'text-align: center;',
      'opacity: 0;',
      'z-index: 9999;',
      'transition: opacity 1s ease-in-out;',
      'box-shadow: 0 0 25px rgba(0,0,0,0.5);',
      'white-space: pre-line;'
    ].join(' ');
    document.body.appendChild(banner);
  }
  banner.style.background = color;
  banner.innerText = message;
  banner.style.opacity = '1';
  setTimeout(() => (banner.style.opacity = '0'), 4000);
}

// ============================================================================
// 🎊 Confetti Burst (emoji only)
// ============================================================================
function launchConfetti() {
  const emojis = ['🎉', '✨', '🎊', '🥳', '🏁', '🎇', '🏆'];
  const count = 30;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.cssText = [
      'position: fixed;',
      `left: ${Math.random() * 100}vw;`,
      'top: -5vh;',
      `font-size: ${Math.random() * 24 + 16}px;`,
      'opacity: 0.9;',
      `transform: rotate(${Math.random() * 360}deg);`,
      'transition: transform 3s ease-in, top 3s ease-in, opacity 3s ease-out;',
      'z-index: 9999;'
    ].join(' ');
    document.body.appendChild(el);

    setTimeout(() => {
      el.style.top = '110vh';
      el.style.transform = `rotate(${Math.random() * 720}deg)`;
      el.style.opacity = '0';
    }, 50);
    setTimeout(() => el.remove(), 3500 + Math.random() * 500);
  }
}

// ============================================================================
// 🏆 Announce Top 3 Finishers
// ============================================================================
async function announceTopThree() {
  const scoresSnap = await getDocs(collection(db, 'scores'));
  const teams = [];
  scoresSnap.forEach(docSnap => {
    const d = docSnap.data();
    teams.push({ name: docSnap.id, score: d.score || 0 });
  });

  if (teams.length === 0) {
    showAnimatedBanner('No teams found — no results to announce.', '#555');
    return;
  }

  teams.sort((a, b) => b.score - a.score);
  const podium = teams.slice(0, 3);
  const max = podium[0]?.score || 0;

  let message = '🏁 FINAL STANDINGS 🏁\n';
  if (max === 0) {
    message += 'No winners this round — all teams scored 0.';
  } else if (
    podium.length >= 3 &&
    podium[0].score === podium[1].score &&
    podium[1].score === podium[2].score
  ) {
    message += '🤝 It’s a 3-way tie for first place!\n';
    podium.forEach(t => (message += `🏅 ${t.name} — ${t.score} pts\n`));
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    podium.forEach((t, i) => (message += `${medals[i] || '🏅'} ${t.name} — ${t.score} pts\n`));
  }

  showAnimatedBanner(message, '#6a1b9a');
  launchConfetti();

  await addDoc(collection(db, 'communications'), {
    teamName: 'Game Master',
    sender: 'Game Master',
    senderDisplay: 'Game Master',
    message,
    isBroadcast: true,
    timestamp: serverTimestamp()
  });
}

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
        <button id="clear-chat-btn" class="${styles.controlButton} ${styles.pause}">💬 Clear Chat</button>
        <button id="reset-game-btn" class="${styles.controlButton} ${styles.pause}">🔄 Reset Game Data</button>
        <button id="clear-scores-btn" class="${styles.controlButton} ${styles.warning}">🧹 Clear All</button>
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
          <span id="control-timer-display" class="${styles.liveTimerValue}" hidden>00:00:00</span>
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
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const resetBtn = document.getElementById('reset-game-btn');
  const clearScoresBtn = document.getElementById('clear-scores-btn');

  const rulesBtn = document.getElementById('toggle-rules-btn');
  const rulesSection = document.getElementById('rules-section');
  const rulesText = document.getElementById('rules-text');
  const saveRulesBtn = document.getElementById('save-rules-btn');
  const rulesDocRef = doc(db, 'settings', 'rules');

  listenToGameTimer();

  // 📜 Toggle rules
  rulesBtn.addEventListener('click', () => {
    const open = rulesSection.style.display !== 'none';
    rulesSection.style.display = open ? 'none' : 'block';
    rulesBtn.textContent = open ? '📜 Edit Rules' : '❌ Close Rules';
  });

  // 💾 Save rules
  saveRulesBtn.addEventListener('click', async () => {
    await setDoc(rulesDocRef, { content: rulesText.value.trim() }, { merge: true });
    showAnimatedBanner('✅ Rules Saved!', '#388e3c');
  });

  // ▶️ START GAME
  startBtn.addEventListener('click', async () => {
    const mins = Number(document.getElementById('game-duration').value) || 120;
    const endTime = new Date(Date.now() + mins * 60 * 1000);
    const racersSnap = await getDocs(collection(db, 'racers'));
    const teams = new Set();
    racersSnap.forEach(d => {
      const r = d.data();
      if (r.team && r.team !== '-') teams.add(r.team);
    });

    await setDoc(doc(db, 'game', 'activeTeams'), { list: Array.from(teams) }, { merge: true });
    await setDoc(doc(db, 'game', 'gameState'), {
      status: 'active',
      startTime: serverTimestamp(),
      endTime,
      zonesReleased: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await addDoc(collection(db, 'communications'), {
      teamName: 'Game Master',
      sender: 'Game Master',
      senderDisplay: 'Game Master',
      message: '🏁 The race has begun! Zones are active — good luck racers!',
      isBroadcast: true,
      timestamp: serverTimestamp()
    });

    showAnimatedBanner('🏁 Race Started!', '#2e7d32');
  });

  // ⏸️ PAUSE / RESUME GAME
  pauseBtn.addEventListener('click', async () => {
    try {
      const isPaused = pauseBtn.textContent.includes('Resume');
      if (isPaused) {
        await resumeGame();
        pauseBtn.textContent = '⏸️ Pause Game';
        showAnimatedBanner('▶️ Game Resumed!', '#2e7d32');
      } else {
        await pauseGame();
        pauseBtn.textContent = '▶️ Resume Game';
        showAnimatedBanner('⏸️ Game Paused!', '#ff9800');
      }
    } catch (err) {
      console.error(err);
      showAnimatedBanner('❌ Pause/Resume Error', '#c62828');
    }
  });

  // 🏁 END GAME → Top 3
  endBtn.addEventListener('click', async () => {
    await setDoc(doc(db, 'game', 'gameState'), { status: 'over' }, { merge: true });
    clearElapsedTimer();
    await announceTopThree();
  });

  // 💬 CLEAR CHAT ONLY
  clearChatBtn.addEventListener('click', async () => {
    if (confirm('Clear all chat messages?')) {
      await clearChatsAndScores(); // uses maintenance.js function
      await addDoc(collection(db, 'communications'), {
        teamName: 'Game Master',
        sender: 'Game Master',
        senderDisplay: 'Game Master',
        message: '💬 All chats cleared by Control.',
        isBroadcast: true,
        timestamp: serverTimestamp()
      });
      showAnimatedBanner('💬 Chats Cleared!', '#2196f3');
    }
  });

  // 🔄 RESET GAME (full reset)
  resetBtn.addEventListener('click', async () => {
    const confirmReset = confirm(
      '⚠️  This will clear all game data, scores, zones, and statuses.\nContinue?'
    );
    if (!confirmReset) return;
    resetBtn.disabled = true;
    try {
      await clearAllCollectionsAndReset();
      showAnimatedBanner('🔄 Game Reset', '#ffa000');
    } finally {
      resetBtn.disabled = false;
    }
  });

  // 🧹 CLEAR ALL (chat + scores)
  clearScoresBtn.addEventListener('click', async () => {
    if (!confirm('⚠️ Clear ALL chat, scores, zones, and team status?')) return;
    await clearChatsAndScores();
    const teamSnap = await getDocs(collection(db, 'teamStatus'));
    for (const t of teamSnap.docs) await deleteDoc(t.ref);
    await addDoc(collection(db, 'communications'), {
      teamName: 'Game Master',
      sender: 'Game Master',
      senderDisplay: 'Game Master',
      message: '🧹 All chat, scores, zones & team data cleared by Control.',
      isBroadcast: true,
      timestamp: serverTimestamp()
    });
    showAnimatedBanner('🧹 All Data Cleared!', '#c62828');
  });
}
