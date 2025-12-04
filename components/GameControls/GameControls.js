// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/GameControls/GameControls.js
// PURPOSE: 🎉 Animated Broadcast Banner
// DEPENDS_ON: /core/config.js, ../../data.js, ../../modules/emailTeams.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../modules/gameTimer.js, ../../modules/gameStateManager.js, ../../modules/gameMaintenance.js, ../../modules/gameRulesManager.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { db } from '/core/config.js';
import { allTeams } from '../../data.js';
import { emailAllTeams } from '../../modules/emailTeams.js';
import {
  doc,
  setDoc,
  writeBatch,
  getDocs,
  getDoc,
  collection,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { clearCountdownTimer } from '../../modules/gameTimer.js';
import {
  pauseGame,
  resumeGame,
  listenForGameStatus
} from '../../modules/gameStateManager.js';
import {
  clearChatsAndScores
} from '../../modules/gameMaintenance.js'; // 🧹 new imports
import { clearAllCollectionsAndReset } from '../../modules/gameRulesManager.js';
import { saveRules, loadRules, runPreRaceMarksSequence } from '../../services/gameRulesManager.js';
import { getGameStatus, setGameStatus, listenToGameStateUpdates } from '../../features/game-state/gameStateController.js';
import { announceTopThree } from '../../modules/scoreboardManager.js';
import { notify, subscribe } from '/core/eventBus.js';


import styles from './GameControls.module.css';

function buildTeamSizes(playerCount, preferredSize) {
  const baseSize = Math.max(2, Number(preferredSize) || 2);
  if (playerCount <= 0) return [];
  if (playerCount <= baseSize) return [playerCount];

  const sizes = [];
  const fullTeams = Math.floor(playerCount / baseSize);
  let assignedPlayers = fullTeams * baseSize;

  for (let i = 0; i < fullTeams; i += 1) {
    sizes.push(baseSize);
  }

  let remainder = playerCount - assignedPlayers;
  if (remainder === 0) return sizes;

  if (remainder === 1 && sizes.length > 0) {
    sizes[0] += 1;
    return sizes;
  }

  while (remainder > 0) {
    const chunk = Math.min(baseSize, remainder);
    if (chunk === 1 && sizes.length > 0) {
      sizes[sizes.length - 1] += 1;
      remainder -= 1;
    } else {
      sizes.push(chunk);
      remainder -= chunk;
    }
  }

  return sizes;
}

// ============================================================================
// 🎲 Randomize Teams
// ============================================================================
async function randomizeTeams() {
  console.log('🎲 Randomizing teams...');

  const teamSizeInput = document.getElementById('team-size');
  const teamSizeValue = parseInt(teamSizeInput?.value, 10);
  const teamSize = Number.isFinite(teamSizeValue) && teamSizeValue > 0 ? teamSizeValue : 2;

  try {
    const racersSnap = await getDocs(collection(db, 'racers'));
    const racers = [];
    racersSnap.forEach(doc => {
      const data = doc.data();
      // Only include racers who have been assigned a name
      if (data.name) {
        racers.push({ id: doc.id, ...data });
      }
    });

    if (racers.length === 0) {
      showAnimatedBanner('No racers with names found!', '#c62828');
      return;
    }

    // Fisher-Yates (aka Knuth) Shuffle for true randomization
    for (let i = racers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [racers[i], racers[j]] = [racers[j], racers[i]];
    }

    const batch = writeBatch(db);
    const teamNames = allTeams.map((t) => t.name);
    const assignedTeams = new Set();
    const teamSizes = buildTeamSizes(racers.length, teamSize);
    let cursor = 0;

    teamSizes.forEach((size, bucketIndex) => {
      const teamName = teamNames[bucketIndex % teamNames.length];
      assignedTeams.add(teamName);
      for (let offset = 0; offset < size && cursor < racers.length; offset += 1) {
        const racer = racers[cursor++];
        const racerRef = doc(db, 'racers', racer.id);
        batch.update(racerRef, { team: teamName });
      }
    });

    // Safety net for any remaining racers (shouldn't occur but keeps assignments consistent).
    while (cursor < racers.length && teamSizes.length > 0) {
      const fallbackTeam = teamNames[(teamSizes.length - 1) % teamNames.length];
      const racer = racers[cursor++];
      const racerRef = doc(db, 'racers', racer.id);
      batch.update(racerRef, { team: fallbackTeam });
    }

    const activeTeamsRef = doc(db, 'game', 'activeTeams');
    batch.set(activeTeamsRef, { list: Array.from(assignedTeams).sort() });

    await batch.commit();
    const teamCount = teamSizes.length;
    const breakdown = teamSizes.join(' / ');
    showAnimatedBanner(
      `✅ Teams randomized!\n${teamCount} team(s)\nSplit: ${breakdown}`,
      '#2e7d32',
    );
    console.log('✅ Teams randomized and updated in Firestore.');

  } catch (err) {
    console.error('Error randomizing teams:', err);
    showAnimatedBanner('❌ Team randomization failed. Check console.', '#c62828');
  }
}

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

function showResultsCountdown() {
    let remaining = 10;
    showAnimatedBanner('GAME OVER', '#c62828');

    const countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            showAnimatedBanner(`Showing results in ${remaining}...`, '#c62828');
        } else {
            clearInterval(countdownInterval);
            announceTopThree({ ui: true, chat: true });
        }
    }, 1000);
}

function renderTopThreeBanner(standings = []) {
  if (!Array.isArray(standings) || standings.length === 0) {
    showAnimatedBanner('No teams found — no results to announce.', '#555');
    return;
  }

  const podium = standings.slice(0, 3);
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
    podium.forEach((t) => (message += `🏅 ${t.team} — ${t.score} pts\n`));
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    podium.forEach((t, i) => {
      message += `${medals[i] || '🏅'} ${t.team} — ${t.score} pts\n`;
    });
  }

  showAnimatedBanner(message, '#6a1b9a');
  launchConfetti();
}

// ============================================================================
// COMPONENT MARKUP
// ============================================================================
export function GameControlsComponent() {
  return `
    <div class="${styles.controlSection}">
      <h2>Game Controls & Setup</h2>

      <div class="${styles.timerSetup}" style="margin-bottom:12px;">
        <label for="home-base-input"><strong>Home Base:</strong></label>
        <input type="text" id="home-base-input" placeholder="Enter Home Base location" style="margin-left:8px;max-width:360px;">
        <button id="home-base-save-btn" class="${styles.controlButton} ${styles.pause}" style="margin-left:8px;">Save</button>
        <span id="home-base-status" style="margin-left:10px;font-size:0.9em;color:#9baec8;"></span>
      </div>

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
        <input type="number" id="team-size" value="2" min="2" style="width:70px;">
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
let isGameActive = false;
let lastAppliedStatus = 'idle';
let detachGameStatus = null;
let detachLegacyStatus = null;
let detachTopThreeFeed = null;

export function initializeGameControlsLogic() {
  const startBtn = document.getElementById('start-btn') || document.getElementById('start-game');
  const pauseBtn = document.getElementById('pause-btn');
  const endBtn = document.getElementById('end-btn') || document.getElementById('end-game');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const resetBtn = document.getElementById('reset-game-btn');
  const clearScoresBtn = document.getElementById('clear-scores-btn');
  const sendLinksBtn = document.getElementById('send-links-btn');
  const homeBaseInput = document.getElementById('home-base-input');
  const homeBaseSaveBtn = document.getElementById('home-base-save-btn');
  const homeBaseStatus = document.getElementById('home-base-status');
  const rulesBtn = document.getElementById('toggle-rules-btn');
  const rulesSection = document.getElementById('rules-section');
  const rulesText = document.getElementById('rules-text');
  const saveRulesBtn = document.getElementById('save-rules-btn');
  const randomizeBtn = document.getElementById('randomize-btn');




  if (!startBtn || !endBtn) {
    console.warn('⚠️ Game control buttons missing. Initialization skipped.');
    return () => {};
  }

  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', randomizeTeams);
  }

  detachGameStatus?.();
  detachLegacyStatus?.();
  detachGameStatus = null;
  detachLegacyStatus = null;
  lastAppliedStatus = 'idle';

  const applyStatus = (rawStatus = 'idle') => {
    const status = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : 'idle';
    const previousStatus = lastAppliedStatus;
    isGameActive = status === 'active';

    if (lastAppliedStatus !== status) {
      console.info(`🎮 GameControls status → ${status}`);
      lastAppliedStatus = status;
    }

    if ((status === 'over' || status === 'ended') && previousStatus === 'active') {
        console.log('🏆 Game ended, starting 10s countdown for results...');
        showResultsCountdown();
    }

    const disableStart = status === 'active' || status === 'paused';
    startBtn.disabled = disableStart;
    startBtn.setAttribute('aria-disabled', String(disableStart));

    const endDisabled = !(status === 'active' || status === 'paused');
    endBtn.disabled = endDisabled;
    endBtn.setAttribute('aria-disabled', String(endDisabled));

    if (pauseBtn) {
      pauseBtn.disabled = status === 'idle' || status === 'ended' || status === 'over';
      pauseBtn.textContent = status === 'paused' ? '▶️ Resume Game' : '⏸️ Pause Game';
    }
  };

  getGameStatus()
    .then((status) => applyStatus(status ?? 'idle'))
    .catch((err) => {
      console.warn('⚠️ Failed to read game status:', err);
      applyStatus('idle');
    });

  detachGameStatus = listenToGameStateUpdates((status) => {
    applyStatus(status ?? 'idle');
  });

  detachLegacyStatus = listenForGameStatus((state) => {
    if (homeBaseInput && typeof state?.homeBase === 'string') {
      homeBaseInput.value = state.homeBase;
      if (homeBaseStatus) homeBaseStatus.textContent = 'Saved';
    }
    applyStatus(state?.status ?? 'idle');
  });

  detachTopThreeFeed?.();
  detachTopThreeFeed = subscribe('ui:topThree', (standings) => {
    renderTopThreeBanner(standings);
  });

  if (rulesBtn && rulesSection && rulesText) {
    rulesBtn.addEventListener('click', async () => {
      const open = rulesSection.style.display !== 'none';
      if (!open) { // If opening the section
        try {
          const data = await loadRules();
          if (data && typeof data.content === 'string') {
            rulesText.value = data.content;
          }
        } catch (err) {
          console.warn('⚠️ Failed to load rules content on toggle:', err);
        }
      }
      rulesSection.style.display = open ? 'none' : 'block';
      rulesBtn.textContent = open ? '📜 Edit Rules' : '❌ Close Rules';
    });
  }

  if (saveRulesBtn && rulesText) {
    saveRulesBtn.addEventListener('click', async () => {
      await saveRules({ content: rulesText.value.trim() });
      showAnimatedBanner('✅ Rules Saved!', '#388e3c');
    });
  }

  if (sendLinksBtn) {
    sendLinksBtn.addEventListener('click', async (event) => {
      event?.preventDefault?.();
      try {
        notify({ kind: 'info', text: 'Marks sequence started…' });
        const result = await runPreRaceMarksSequence('global');
        if (result?.ok !== false) {
          notify({ kind: 'info', text: 'Marks sequence triggered.' });
        } else {
          notify({ kind: 'info', text: 'Marks ignored — game not active.' });
        }
      } catch (err) {
        console.error('❌ Marks sequence failed:', err);
        notify({ kind: 'info', text: 'Marks sequence failed. Check console.' });
      }
    });
  }

  if (homeBaseSaveBtn && homeBaseInput) {
    // Prefill from Firestore
    getDoc(doc(db, 'game', 'gameState')).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() || {};
        if (typeof data.homeBase === 'string') {
          homeBaseInput.value = data.homeBase;
          if (homeBaseStatus) homeBaseStatus.textContent = 'Saved';
        }
      }
    }).catch((err) => console.warn('⚠️ Failed to load Home Base:', err));

    const saveHomeBase = async () => {
      const value = homeBaseInput.value?.trim() || '';
      try {
        await setDoc(doc(db, 'game', 'gameState'), { homeBase: value }, { merge: true });
        if (homeBaseStatus) {
          homeBaseStatus.textContent = value ? 'Saved' : 'Cleared';
          setTimeout(() => { homeBaseStatus.textContent = ''; }, 2500);
        }
      } catch (err) {
        console.error('❌ Failed to save Home Base:', err);
        if (homeBaseStatus) homeBaseStatus.textContent = 'Save failed';
      }
    };

    homeBaseSaveBtn.addEventListener('click', saveHomeBase);
    homeBaseInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveHomeBase();
      }
    });
  }

  endBtn.addEventListener('click', async (event) => {
    const status = isGameActive ? 'active' : await getGameStatus().catch(() => 'idle');
    if (status !== 'active' && status !== 'paused') {
      event?.preventDefault?.();
      notify({ kind: 'info', text: 'No active game found.' });
      applyStatus(status);
      return;
    }

    console.log('🛑 Ending game...');
    try {
      await setGameStatus('ended');
      applyStatus('ended');
      notify({ kind: 'info', text: 'Game end requested.' });
      clearCountdownTimer();
      await announceTopThree({ ui: true, chat: true });
    } catch (err) {
      console.error('❌ Failed to end game:', err);
      notify({ kind: 'info', text: 'Unable to update game status.' });
      applyStatus(status);
    }
  });

  if (pauseBtn) {
    pauseBtn.addEventListener('click', async () => {
      try {
        const isPaused = pauseBtn.textContent.includes('Resume');
        if (isPaused) {
          await resumeGame();
          applyStatus('active');
          showAnimatedBanner('▶️ Game Resumed!', '#2e7d32');
        } else {
          await pauseGame();
          applyStatus('paused');
          showAnimatedBanner('⏸️ Game Paused!', '#ff9800');
        }
      } catch (err) {
        console.error('❌ Pause/Resume error:', err);
        showAnimatedBanner('❌ Pause/Resume Error', '#c62828');
      }
    });
  }

  clearChatBtn?.addEventListener('click', async () => {
    try {
      await clearChatsAndScores();
      showAnimatedBanner('💬 Chat + Scores cleared!', '#1976d2');
    } catch (err) {
      console.error('❌ Failed to clear chats/scores:', err);
      showAnimatedBanner('❌ Clear failed. Check console.', '#c62828');
    }
  });

  resetBtn?.addEventListener('click', async () => {
    try {
      await clearAllCollectionsAndReset();
      showAnimatedBanner('🔄 Game data reset!', '#1976d2');
    } catch (err) {
      console.error('❌ Reset failed:', err);
      showAnimatedBanner('❌ Reset failed. Check console.', '#c62828');
    }
  });

  clearScoresBtn?.addEventListener('click', async () => {
    try {
      await clearChatsAndScores();
      showAnimatedBanner('🧹 Scores cleared!', '#1976d2');
    } catch (err) {
      console.error('❌ Score clear failed:', err);
      showAnimatedBanner('❌ Score clear failed.', '#c62828');
    }
  });

  return () => {
    detachGameStatus?.();
    detachGameStatus = null;
    detachLegacyStatus?.();
    detachLegacyStatus = null;
    detachTopThreeFeed?.();
    detachTopThreeFeed = null;
  };
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/GameControls/GameControls.js
// ai_role: UI Layer
// aicp_category (sanitized) component
// aicp_version: 3.0
// export_bridge: services
// exports (sanitized) GameControlsComponent, initializeGameControlsLogic
// linked_files (sanitized) []
// owner: RouteRiot-AICP
// review_status: pending_alignment
// status (sanitized) stable
// sync_state (sanitized) aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
