// ============================================================================
// MODULE 1: gameRulesManager.js
// Purpose: Handles loading, editing, and saving Route Riot game rules.
// ============================================================================
import { db } from '../modules/config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function loadRules(rulesTextArea) {
  const rulesDocRef = doc(db, 'settings', 'rules');
  const snap = await getDoc(rulesDocRef);
  rulesTextArea.value = snap.exists()
    ? (snap.data().content || '')
    : 'Enter your Route Riot rules here...';
}

export async function saveRules(rulesTextArea) {
  const rulesDocRef = doc(db, 'settings', 'rules');
  await setDoc(rulesDocRef, { content: rulesTextArea.value.trim() }, { merge: true });
  // Replace blocking alert with inline UI feedback if preferred
  alert('✅ Rules saved!');
}

export function toggleRules(rulesSection, toggleButton) {
  const open = rulesSection.style.display !== 'none';
  rulesSection.style.display = open ? 'none' : 'block';
  toggleButton.textContent = open ? '📜 Edit Rules' : '❌ Close Rules';
}

// ============================================================================
// MODULE 2: gameTimer.js
// Purpose: Handles real-time countdown display for active games.
// ============================================================================
import { onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function initializeGameTimer(timerDisplay) {
  const gameDocRef = doc(db, 'game', 'gameState');
  let gameTimerInterval;

  onSnapshot(gameDocRef, (docSnap) => {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    const gs = docSnap.data();

    if (gs && gs.status === 'active' && gs.endTime) {
      const endMs = gs.endTime?.toMillis ? gs.endTime.toMillis() : gs.endTime;

      gameTimerInterval = setInterval(() => {
        const remaining = endMs - Date.now();
        if (remaining <= 0) {
          timerDisplay.textContent = '00:00:00';
          clearInterval(gameTimerInterval);
        } else {
          const h = Math.floor((remaining / 3_600_000) % 24);
          const m = Math.floor((remaining / 60_000) % 60);
          const s = Math.floor((remaining / 1_000) % 60);
          timerDisplay.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
      }, 1000);
    } else {
      timerDisplay.textContent = '--:--:--';
    }
  });
}

// ============================================================================
// MODULE 3: teamManager.js
// Purpose: Randomizes teams and sends player emails.
// ============================================================================
import { allTeams } from '../data.js';
import { emailAllTeams } from './emailTeams.js';
import { db } from './config.js';
import {
  getDocs,
  collection,
  writeBatch,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function randomizeTeams(teamSize = 2) {
  const snap = await getDocs(collection(db, 'racers'));
  const racers = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.name);

  if (racers.length === 0) {
    alert('⚠️ No racers found in Firestore.');
    return;
  }

  // Shuffle racers
  for (let i = racers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [racers[i], racers[j]] = [racers[j], racers[i]];
  }

  // Assign teams
  const batch = writeBatch(db);
  racers.forEach((r, i) => {
    const tIndex = Math.floor(i / teamSize);
    const team = allTeams[tIndex % allTeams.length];
    batch.set(doc(db, 'racers', r.id), { team: team.name }, { merge: true });
  });

  await batch.commit();
  alert(`🎲 ${Math.ceil(racers.length / teamSize)} teams randomized!`);
}

export async function emailTeams(rulesDocRef) {
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
  if (teamNames.length === 0) {
    alert('❌ No racers assigned to teams yet.\nPlease randomize teams first.');
    return;
  }

  await setDoc(doc(db, 'game', 'gameState'), { zonesReleased: true }, { merge: true });
  await setDoc(doc(db, 'game', 'activeTeams'), { list: teamNames }, { merge: true });

  const rulesSnap = await getDoc(rulesDocRef);
  const currentRules = rulesSnap.exists() ? rulesSnap.data().content : '';

  if (confirm(`Email links to ${teamNames.length} active teams now?`)) {
    emailAllTeams(currentRules, activeTeams);
    alert(`📧 Emails prepared for ${teamNames.length} active teams.\nCheck your Gmail tabs.`);
  }
}

// ============================================================================
// MODULE 4: gameStateManager.js
// Purpose: Handles start, pause, and end states of the game.
// ============================================================================
import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function startGame(gameDuration = 120) {
  const mins = Number(gameDuration) || 120;
  const endTime = Timestamp.fromMillis(Date.now() + mins * 60 * 1000);

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
    dataVersion: Date.now()
  }, { merge: true });

  await addDoc(collection(db, 'communications'), {
    teamName: 'Game Master',
    message: '🏁 The race has begun! Zones are now active — good luck racers!',
    timestamp: new Date()
  });

  alert(`🏁 Game Started — Zones Released!\n${teamsInPlay.size} teams active.`);
}

export async function pauseGame() {
  await setDoc(doc(db, 'game', 'gameState'), { status: 'paused' }, { merge: true });
  alert('⏸️ Game Paused!');
}

export async function endGame() {
  try {
    await setDoc(doc(db, 'game', 'gameState'), { status: 'finished' }, { merge: true });

    const scoresSnap = await getDocs(collection(db, 'scores'));
    const scores = scoresSnap.docs
      .map(d => ({ team: d.id, ...d.data() }))
      .filter(s => typeof s.score === 'number')
      .sort((a, b) => b.score - a.score);

    if (scores.length === 0) {
      await addDoc(collection(db, 'communications'), {
        teamName: 'Game Master',
        message: '🏁 Game Ended — No scores found.',
        timestamp: new Date()
      });
      alert('Game Ended — no scores recorded.');
      return;
    }

    const medals = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];
    const lines = scores.slice(0, 3).map((s, i) => `${medals[i]} — ${s.team} (${s.score} pts)`);

    await addDoc(collection(db, 'communications'), {
      teamName: 'Game Master',
      message: `🏁 FINAL STANDINGS 🏁\n\n${lines.join('\n')}\n\n— Route Riot Control`,
      timestamp: new Date()
    });

    alert('🏁 Game Ended — Winners broadcasted!');
  } catch (err) {
    console.error('End Game error:', err);
    alert('Error ending game — see console.');
  }
}

// ============================================================================
// MODULE 5: gameMaintenance.js
// Purpose: Handles resets, wipes, and maintenance tasks.
// ============================================================================
import {
  writeBatch,
  getDocs,
  doc,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './config.js';

export async function resetFullGame() {
  if (!confirm('ARE YOU SURE?\nThis will permanently delete all game data.')) return;
  alert('Resetting game data...');

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'game', 'gameState'), {
      status: 'not started',
      zonesReleased: false,
      dataVersion: Date.now()
    });
    batch.delete(doc(db, 'game', 'activeTeams'));

    const racers = await getDocs(collection(db, 'racers'));
    racers.forEach(r => batch.set(r.ref, { team: '-' }, { merge: true }));

    const zones = await getDocs(collection(db, 'zones'));
    zones.forEach(z => batch.set(z.ref, { status: 'Available', controllingTeam: '' }, { merge: true }));

    const scores = await getDocs(collection(db, 'scores'));
    scores.forEach(s => batch.delete(s.ref));

    await batch.commit();
    alert('✅ Game has been reset.');
  } catch (err) {
    console.error('Reset error:', err);
    alert('An error occurred while resetting. Check console.');
  }
}