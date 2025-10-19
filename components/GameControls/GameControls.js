// ============================================================================
// File: components/GameControls/GameControls.js
// ============================================================================
import { db } from '../../modules/config.js';
import { allTeams } from '../../data.js';
import { emailAllTeams } from '../../modules/emailTeams.js';
// --- THIS IMPORT STATEMENT HAS BEEN CORRECTED ---
import {
  onSnapshot,
  doc,
  setDoc,
  writeBatch,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  getDoc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './GameControls.module.css';

// ============================================================================
// COMPONENT MARKUP
// ============================================================================
export function GameControlsComponent() {
  return `
    <div class="${styles.controlSection}">
      <h2>Game Controls & Setup</h2>

      <div class="${styles.gameControls}">
        <button id="start-btn" class="${styles.controlButton} ${styles.start}">Start Game</button>
        <button id="pause-btn" class="${styles.controlButton} ${styles.pause}">Pause Game</button>
        <button id="end-btn" class="${styles.controlButton} ${styles.end}">End Game</button>
        <button id="reset-game-btn" class="${styles.controlButton} ${styles.pause}">Reset Game Data</button>
        <button id="clear-scores-btn" class="${styles.controlButton} ${styles.warning}">🧹 Clear Scores</button>
      </div>

      <div class="${styles.teamSetup}" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <label for="team-size">Team Size:</label>
        <input type="number" id="team-size" value="2" min="1" style="width:60px;">
        <button id="randomize-btn" class="${styles.controlButton} ${styles.pause}">Randomize Teams</button>
        <button id="send-links-btn" class="${styles.controlButton} ${styles.start}">🏁 Racers Take Your Marks</button>
        <button id="toggle-rules-btn" class="${styles.controlButton} ${styles.pause}">📜 Edit Rules</button>
      </div>

      <div class="${styles.timerSetup}">
        <label for="game-duration">Game Duration (minutes):</label>
        <input type="number" id="game-duration" value="120">
        <div class="${styles.liveTimer}">
          <strong>Live Timer:</strong> <span id="timer-display">00:00:00</span>
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
// LIVE LOGIC
// ============================================================================
export function initializeGameControlsLogic() {
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const endBtn = document.getElementById('end-btn');
  const resetBtn = document.getElementById('reset-game-btn');
  const clearScoresBtn = document.getElementById('clear-scores-btn');
  const randomizeBtn = document.getElementById('randomize-btn');
  const sendBtn = document.getElementById('send-links-btn');
  const timerDisplay = document.getElementById('timer-display');

  // Rules
  const toggleRulesBtn = document.getElementById('toggle-rules-btn');
  const rulesSection = document.getElementById('rules-section');
  const rulesText = document.getElementById('rules-text');
  const saveRulesBtn = document.getElementById('save-rules-btn');
  const rulesDocRef = doc(db, "settings", "rules");

  let gameTimerInterval;

  getDoc(rulesDocRef).then(snap => {
    rulesText.value = snap.exists() ? (snap.data().content || '') : "Enter your Route Riot rules here...";
  });

  toggleRulesBtn.addEventListener('click', () => {
    const open = rulesSection.style.display !== 'none';
    rulesSection.style.display = open ? 'none' : 'block';
    toggleRulesBtn.textContent = open ? '📜 Edit Rules' : '❌ Close Rules';
  });

  saveRulesBtn.addEventListener('click', async () => {
    await setDoc(rulesDocRef, { content: rulesText.value.trim() }, { merge: true });
    alert('✅ Rules saved!');
  });

  onSnapshot(doc(db, "game", "gameState"), (docSnap) => {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    const gs = docSnap.data();
    if (gs && gs.status === 'active' && gs.endTime) {
      gameTimerInterval = setInterval(() => {
        const remaining = gs.endTime - Date.now();
        if (remaining <= 0) {
          timerDisplay.textContent = "00:00:00";
          clearInterval(gameTimerInterval);
        } else {
          const h = Math.floor((remaining / 3_600_000) % 24);
          const m = Math.floor((remaining / 60_000) % 60);
          const s = Math.floor((remaining / 1_000) % 60);
          timerDisplay.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }
      }, 1000);
    } else {
      timerDisplay.textContent = "--:--:--";
    }
  });

  clearScoresBtn.addEventListener('click', async () => {
    if (!confirm("This will clear ALL team scores. Proceed?")) return;
    try {
      const scoresSnap = await getDocs(collection(db, "scores"));
      const batch = writeBatch(db);
      scoresSnap.forEach(s => batch.delete(s.ref));
      await batch.commit();
      await addDoc(collection(db, "communications"), {
        teamName: "Game Master",
        message: "🧹 All scores have been cleared manually by control.",
        timestamp: new Date()
      });
      alert("✅ All scores cleared.");
    } catch (err) {
      console.error("Clear Scores error:", err);
      alert("❌ Failed to clear scores — check console.");
    }
  });

  startBtn.addEventListener('click', async () => {
    const mins = Number(document.getElementById('game-duration').value) || 120;
    const endTime = Date.now() + mins * 60 * 1000;

    const scoreDocs = await getDocs(collection(db, "scores"));
    const clearBatch = writeBatch(db);
    scoreDocs.forEach(s => clearBatch.delete(s.ref));
    await clearBatch.commit();

    const racersSnap = await getDocs(collection(db, "racers"));
    const teamsInPlay = new Set();
    racersSnap.forEach(d => {
      const r = d.data();
      if (r.team && r.team !== '-') teamsInPlay.add(r.team);
    });

    await setDoc(doc(db, "game", "activeTeams"), { list: Array.from(teamsInPlay) }, { merge: true });
    await setDoc(doc(db, "game", "gameState"), {
      status: 'active',
      endTime,
      zonesReleased: true,
      dataVersion: Date.now()
    }, { merge: true });

    await addDoc(collection(db, "communications"), {
      teamName: "Game Master",
      message: '🏁 The race has begun! Zones are now active — good luck racers!',
      timestamp: new Date()
    });

    alert(`🏁 Game Started — Zones Released!\nScores cleared.\n${teamsInPlay.size} teams active.`);
  });

  pauseBtn.addEventListener('click', async () => {
    await setDoc(doc(db, "game", "gameState"), { status: 'paused' }, { merge: true });
    alert('Game Paused!');
  });

  endBtn.addEventListener('click', async () => {
    try {
      await setDoc(doc(db, "game", "gameState"), { status: 'finished' }, { merge: true });

      const scoresSnap = await getDocs(collection(db, "scores"));
      const scores = scoresSnap.docs
        .map(d => ({ team: d.id, ...d.data() }))
        .filter(s => typeof s.score === 'number')
        .sort((a, b) => b.score - a.score);

      if (scores.length === 0) {
        await addDoc(collection(db, "communications"), {
          teamName: "Game Master",
          message: "🏁 Game Ended — No scores found.",
          timestamp: new Date()
        });
        alert("Game Ended — no scores recorded.");
        return;
      }

      const places = [];
      let currentRank = 1;
      for (let i = 0; i < scores.length && currentRank <= 3; i++) {
        if (i > 0 && scores[i].score < scores[i - 1].score) currentRank++;
        if (currentRank <= 3) places.push({ rank: currentRank, ...scores[i] });
      }

      const medals = ["🥇 1st Place", "🥈 2nd Place", "🥉 3rd Place"];
      const lines = places.map(p => `${medals[p.rank - 1]} — ${p.team} (${p.score} pts)`);
      const blankLines = Array(10).fill(" ").join("\n");

      const message = `
🏁 ROUTE RIOT FINAL STANDINGS 🏁

${lines.join("\n")}
${blankLines}
— Route Riot Control`;

      await addDoc(collection(db, "communications"), {
        teamName: "Game Master",
        message,
        timestamp: new Date()
      });

      alert("🏁 Game Ended — Winners broadcasted!");
    } catch (err) {
      console.error("End Game error:", err);
      alert("Error ending game — see console.");
    }
  });

  resetBtn.addEventListener('click', async () => {
    if (!confirm("ARE YOU SURE?\nThis will permanently delete all game data.")) return;
    alert("Resetting game data...");

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "game", "gameState"), {
        status: 'not started',
        zonesReleased: false,
        dataVersion: Date.now()
      });
      batch.delete(doc(db, "game", "activeTeams"));

      const racers = await getDocs(collection(db, "racers"));
      racers.forEach(r => batch.update(r.ref, { name: '', cell: '', email: '', team: '-' }));

      const zones = await getDocs(collection(db, "zones"));
      zones.forEach(z => batch.update(z.ref, {
        name: '', gps: '', diameter: '0.05', status: 'Available', controllingTeam: ''
      }));

      const scores = await getDocs(collection(db, "scores"));
      scores.forEach(s => batch.delete(s.ref));

      await batch.commit();
      alert('✅ Game has been reset.');
    } catch (err) {
      console.error("Reset error:", err);
      alert("An error occurred while resetting. Check console.");
    }
  });

  randomizeBtn.addEventListener('click', async () => {
    const teamSize = Number(document.getElementById('team-size').value);
    if (!teamSize || teamSize < 1) return alert("Enter a valid team size.");

    const snap = await getDocs(collection(db, "racers"));
    const racers = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.name);

    for (let i = racers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [racers[i], racers[j]] = [racers[j], racers[i]];
    }

    const batch = writeBatch(db);
    racers.forEach((r, i) => {
      const tIndex = Math.floor(i / teamSize);
      const team = allTeams[tIndex % allTeams.length];
      batch.update(doc(db, "racers", r.id), { team: team.name });
    });

    await batch.commit();
    alert("Teams randomized!");
  });

  sendBtn.addEventListener('click', async () => {
    const racersSnap = await getDocs(collection(db, "racers"));
    const racers = racersSnap.docs.map(d => d.data());
    const activeTeams = {};

    racers.forEach(r => {
      if (r.team && r.team !== '-' && r.email) {
        if (!activeTeams[r.team]) activeTeams[r.team] = [];
        activeTeams[r.team].push(r);
      }
    });

    const teamNames = Object.keys(activeTeams);
    if (teamNames.length === 0) {
      alert("❌ No racers assigned to teams yet.\nPlease randomize teams first.");
      return;
    }

    await setDoc(doc(db, "game", "gameState"), { zonesReleased: true }, { merge: true });
    await setDoc(doc(db, "game", "activeTeams"), { list: teamNames }, { merge: true });

    const rulesSnap = await getDoc(rulesDocRef);
    const currentRules = rulesSnap.exists() ? rulesSnap.data().content : '';

    const ok = confirm(`Email links to ${teamNames.length} active teams now?`);
    if (!ok) return;

    emailAllTeams(currentRules, activeTeams);
    alert(`📧 Emails prepared for ${teamNames.length} active teams.\nCheck your Gmail tabs.`);
  });
}

